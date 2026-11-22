import {
  APPLICATION_EXPIRATION_DAYS,
  APPLICATION_WEBSITE_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  LEGAL_REP_NAME_MAX_LENGTH,
  PUBLISHER_NAME_MAX_LENGTH,
  REJECTION_REASON_MAX_LENGTH,
} from "@library-flow/shared";
import type {
  CreatePublisherApplicationDto,
  InAppNotificationType,
  PublisherApplication,
} from "@library-flow/shared";
import {
  notificationRepository as defaultNotificationRepository,
  NotificationRepository,
} from "../repositories/notification-repository.js";
import {
  publisherApplicationRepository as defaultPublisherApplicationRepository,
  PublisherApplicationRepository,
} from "../repositories/publisher-application-repository.js";

type PublisherApplicationAuditAction =
  | "submitted"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "expired"
  | "publisher_revoked";

export type PublisherApplicationAuditRecord = {
  action: PublisherApplicationAuditAction;
  actorUid: string;
  targetUid: string;
  applicationId?: string;
  reason?: string;
  createdAt: string;
};

export class PublisherApplicationService {
  private readonly auditRecords: PublisherApplicationAuditRecord[] = [];

  public constructor(
    private readonly applications: PublisherApplicationRepository =
      defaultPublisherApplicationRepository,
    private readonly notifications: NotificationRepository =
      defaultNotificationRepository,
  ) {}

  async submitApplication(
    applicantUid: string,
    dto: CreatePublisherApplicationDto,
  ): Promise<PublisherApplication> {
    const existingApplications = await this.getMyApplications(applicantUid);
    if (
      existingApplications.some(
        (application) =>
          application.status === "pending" ||
          application.status === "approved",
      )
    ) {
      throw new Error("DUPLICATE_ACTIVE_APPLICATION");
    }

    const applicationData = this.validateCreateDto(dto);
    const createdAt = new Date();
    const application: PublisherApplication = {
      id: crypto.randomUUID(),
      applicantUid,
      ...applicationData,
      status: "pending",
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      expiresAt: new Date(
        createdAt.getTime() +
          APPLICATION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
      revision: 1,
    };

    const savedApplication = await this.applications.save(application);
    this.recordAudit({
      action: "submitted",
      actorUid: applicantUid,
      targetUid: applicantUid,
      applicationId: savedApplication.id,
      createdAt: savedApplication.createdAt,
    });
    return savedApplication;
  }

  async getMyApplications(
    applicantUid: string,
  ): Promise<PublisherApplication[]> {
    const applications = await this.applications.findByApplicant(applicantUid);
    const now = new Date();

    for (const application of applications) {
      if (
        application.status === "pending" &&
        now.getTime() > new Date(application.expiresAt).getTime()
      ) {
        await this.expireApplication(application);
      }
    }

    return this.applications.findByApplicant(applicantUid);
  }

  async withdrawApplication(
    id: string,
    applicantUid: string,
  ): Promise<PublisherApplication> {
    const application = await this.getApplication(id);
    if (application.applicantUid !== applicantUid) {
      throw new Error("FORBIDDEN");
    }
    this.requirePending(application);

    const updatedApplication = await this.updateApplication(id, {
      status: "withdrawn",
      updatedAt: new Date().toISOString(),
      revision: application.revision + 1,
    });
    this.recordAudit({
      action: "withdrawn",
      actorUid: applicantUid,
      targetUid: applicantUid,
      applicationId: id,
      createdAt: updatedApplication.updatedAt,
    });
    return updatedApplication;
  }

  async getPendingApplications(): Promise<PublisherApplication[]> {
    return this.applications.findPending();
  }

  async approveApplication(
    id: string,
    reviewerUid: string,
  ): Promise<PublisherApplication> {
    const application = await this.getApplication(id);
    this.requirePending(application);
    const reviewedAt = new Date().toISOString();
    const updatedApplication = await this.updateApplication(id, {
      status: "approved",
      reviewedAt,
      reviewerUid,
      updatedAt: reviewedAt,
      revision: application.revision + 1,
    });
    this.recordAudit({
      action: "approved",
      actorUid: reviewerUid,
      targetUid: application.applicantUid,
      applicationId: id,
      createdAt: reviewedAt,
    });
    await this.dispatchNotification(
      application.applicantUid,
      "publisher_application_approved",
      "Your publisher application was approved.",
      reviewedAt,
    );
    return updatedApplication;
  }

  async rejectApplication(
    id: string,
    reviewerUid: string,
    reason: string,
  ): Promise<PublisherApplication> {
    const application = await this.getApplication(id);
    this.requirePending(application);
    const normalizedReason = this.validateReason(reason);
    const reviewedAt = new Date().toISOString();
    const updatedApplication = await this.updateApplication(id, {
      status: "rejected",
      decisionReason: normalizedReason,
      reviewedAt,
      reviewerUid,
      updatedAt: reviewedAt,
      revision: application.revision + 1,
    });
    this.recordAudit({
      action: "rejected",
      actorUid: reviewerUid,
      targetUid: application.applicantUid,
      applicationId: id,
      reason: normalizedReason,
      createdAt: reviewedAt,
    });
    await this.dispatchNotification(
      application.applicantUid,
      "publisher_application_rejected",
      `Your publisher application was rejected: ${normalizedReason}`,
      reviewedAt,
    );
    return updatedApplication;
  }

  async revokePublisher(
    publisherUid: string,
    reviewerUid: string,
    reason: string,
  ): Promise<void> {
    const normalizedReason = this.validateReason(reason);
    const revokedAt = new Date().toISOString();
    this.recordAudit({
      action: "publisher_revoked",
      actorUid: reviewerUid,
      targetUid: publisherUid,
      reason: normalizedReason,
      createdAt: revokedAt,
    });
    await this.dispatchNotification(
      publisherUid,
      "publisher_revoked",
      `Your publisher access was revoked: ${normalizedReason}`,
      revokedAt,
    );
  }

  private async expireApplication(
    application: PublisherApplication,
  ): Promise<void> {
    const expiredAt = new Date().toISOString();
    const updatedApplication = await this.updateApplication(application.id, {
      status: "expired",
      updatedAt: expiredAt,
      revision: application.revision + 1,
    });
    this.recordAudit({
      action: "expired",
      actorUid: "system",
      targetUid: application.applicantUid,
      applicationId: application.id,
      createdAt: updatedApplication.updatedAt,
    });
    await this.dispatchNotification(
      application.applicantUid,
      "publisher_application_expired",
      "Your publisher application expired without a decision.",
      expiredAt,
    );
  }

  private validateCreateDto(
    dto: CreatePublisherApplicationDto,
  ): Omit<
    PublisherApplication,
    | "id"
    | "applicantUid"
    | "status"
    | "createdAt"
    | "updatedAt"
    | "expiresAt"
    | "revision"
  > {
    const publisherName = this.validateText(
      dto.publisherName,
      "publisherName",
      PUBLISHER_NAME_MAX_LENGTH,
    );
    const legalRepresentativeName = this.validateText(
      dto.legalRepresentativeName,
      "legalRepresentativeName",
      LEGAL_REP_NAME_MAX_LENGTH,
    );
    if (typeof dto.independentPublisher !== "boolean") {
      throw new Error("independentPublisher must be a boolean.");
    }

    const publisherEmail = this.validateText(
      dto.publisherEmail,
      "publisherEmail",
      EMAIL_MAX_LENGTH,
    );
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publisherEmail)) {
      throw new Error("publisherEmail must be a valid email address.");
    }

    const website = dto.website?.trim();
    if (website) {
      if (website.length > APPLICATION_WEBSITE_MAX_LENGTH) {
        throw new Error(
          `website must contain at most ${APPLICATION_WEBSITE_MAX_LENGTH} characters.`,
        );
      }
      let parsedWebsite: URL;
      try {
        parsedWebsite = new URL(website);
      } catch {
        throw new Error("website must be a valid HTTPS URL.");
      }
      if (parsedWebsite.protocol !== "https:") {
        throw new Error("website must be a valid HTTPS URL.");
      }
    }

    return {
      publisherName,
      legalRepresentativeName,
      independentPublisher: dto.independentPublisher,
      publisherEmail,
      ...(website ? { website } : {}),
    };
  }

  private validateReason(reason: string): string {
    const normalizedReason = reason.trim();
    if (
      normalizedReason.length === 0 ||
      normalizedReason.length > REJECTION_REASON_MAX_LENGTH
    ) {
      throw new Error(
        `decisionReason must contain between 1 and ${REJECTION_REASON_MAX_LENGTH} characters.`,
      );
    }
    return normalizedReason;
  }

  private validateText(value: string, field: string, maxLength: number): string {
    const normalizedValue = value.trim();
    if (
      normalizedValue.length === 0 ||
      normalizedValue.length > maxLength
    ) {
      throw new Error(
        `${field} must contain between 1 and ${maxLength} characters.`,
      );
    }
    return normalizedValue;
  }

  private async getApplication(id: string): Promise<PublisherApplication> {
    const application = await this.applications.findById(id);
    if (!application) {
      throw new Error("APPLICATION_NOT_FOUND");
    }
    return application;
  }

  private requirePending(application: PublisherApplication): void {
    if (application.status !== "pending") {
      throw new Error("INVALID_STATE");
    }
  }

  private async updateApplication(
    id: string,
    updates: Partial<PublisherApplication>,
  ): Promise<PublisherApplication> {
    const updatedApplication = await this.applications.update(id, updates);
    if (!updatedApplication) {
      throw new Error("APPLICATION_NOT_FOUND");
    }
    return updatedApplication;
  }

  private async dispatchNotification(
    userId: string,
    type: InAppNotificationType,
    message: string,
    createdAt: string,
  ): Promise<void> {
    await this.notifications.create({
      id: crypto.randomUUID(),
      userId,
      type,
      message,
      read: false,
      createdAt,
    });
  }

  private recordAudit(record: PublisherApplicationAuditRecord): void {
    this.auditRecords.push({ ...record });
  }
}

export const publisherApplicationService = new PublisherApplicationService();
