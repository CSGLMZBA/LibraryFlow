import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { APPLICATION_EXPIRATION_DAYS } from "@library-flow/shared";
import type { CreatePublisherApplicationDto, PublisherApplication } from "@library-flow/shared";
import { ApplicationRevisionConflictError } from "../repositories/publisher-application-repository.js";
import { authAdmin } from "./firebase-auth-service.js";
import { PublisherApplicationService } from "./publisher-application-service.js";

const applicantKey = (uid: string) => createHash("sha256").update(uid).digest("hex");

export class PublisherApplicationStoreError extends Error {
  constructor() {
    super("Publisher applications are temporarily unavailable.");
    this.name = "PublisherApplicationStoreError";
  }
}

export class CloudPublisherApplicationService extends PublisherApplicationService {
  constructor(private readonly database: () => FirebaseFirestore.Firestore = () => {
    authAdmin();
    return getFirestore();
  }, private readonly now: () => number = Date.now) {
    super();
  }

  override async submitApplication(uid: string, dto: CreatePublisherApplicationDto): Promise<PublisherApplication> {
    if (!dto || typeof dto !== "object" || Array.isArray(dto)) throw new Error("Invalid application.");
    const data = this.validateCreateDto(dto);
    await this.getMyApplications(uid);
    const now = this.now();
    const application: PublisherApplication = {
      id: crypto.randomUUID(), applicantUid: uid, ...data, status: "pending", revision: 1,
      createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + APPLICATION_EXPIRATION_DAYS * 86400000).toISOString(),
    };
    await this.storage(async db => {
      const guard = db.collection("publisherApplicationGuards").doc(applicantKey(uid));
      const ref = db.collection("publisherApplications").doc(application.id);
      const audit = db.collection("publisherApplicationAudit").doc();
      await db.runTransaction(async tx => {
        await tx.get(guard);
        const existing = await tx.get(db.collection("publisherApplications").where("applicantUid", "==", uid));
        if (existing.docs.some(doc => ["pending", "approved"].includes(doc.data().status))) {
          throw new Error("DUPLICATE_ACTIVE_APPLICATION");
        }
        tx.set(guard, {uid, updatedAt: application.createdAt});
        tx.create(ref, application);
        tx.create(audit, {action: "submitted", actorUid: uid, targetUid: uid,
          applicationId: application.id, createdAt: application.createdAt});
      });
    });
    return application;
  }

  override async getMyApplications(uid: string): Promise<PublisherApplication[]> {
    const snapshot = await this.storage(db => db.collection("publisherApplications").where("applicantUid", "==", uid).get());
    for (const doc of snapshot.docs) {
      const value = doc.data() as PublisherApplication;
      if (value.status === "pending" && Date.parse(value.expiresAt) <= this.now()) {
        await this.expire(doc.id);
      }
    }
    const refreshed = await this.storage(db => db.collection("publisherApplications").where("applicantUid", "==", uid).get());
    return refreshed.docs.map(doc => doc.data() as PublisherApplication);
  }

  override async getPendingApplications(): Promise<PublisherApplication[]> {
    const snapshot = await this.storage(db => db.collection("publisherApplications").where("status", "==", "pending").get());
    return snapshot.docs.map(doc => doc.data() as PublisherApplication);
  }

  override async withdrawApplication(id: string, uid: string, revision?: number): Promise<PublisherApplication> {
    return this.transition(id, uid, revision, "withdrawn");
  }

  override async rejectApplication(id: string, uid: string, reason: string, revision?: number): Promise<PublisherApplication> {
    return this.transition(id, uid, revision, "rejected", this.validateReason(reason));
  }

  override async approveApplication(): Promise<PublisherApplication> {
    throw new Error("FEATURE_UNAVAILABLE");
  }

  override async revokePublisher(): Promise<void> {
    throw new Error("FEATURE_UNAVAILABLE");
  }

  private async expire(id: string): Promise<void> {
    await this.transition(id, "system", undefined, "expired");
  }

  private async transition(
    id: string, actor: string, revision: number | undefined,
    status: "withdrawn" | "rejected" | "expired", reason?: string,
  ): Promise<PublisherApplication> {
    const at = new Date(this.now()).toISOString();
    return this.storage(db => {
      const ref = db.collection("publisherApplications").doc(id);
      const audit = db.collection("publisherApplicationAudit").doc();
      const notification = db.collection("notifications").doc();
      return db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) throw new Error("APPLICATION_NOT_FOUND");
        const current = snapshot.data() as PublisherApplication;
        if (status === "withdrawn" && current.applicantUid !== actor) throw new Error("FORBIDDEN");
        if (status === "expired") {
          if (current.status !== "pending") return current;
          const expiresAt = Date.parse(current.expiresAt);
          if (!Number.isFinite(expiresAt)) throw new Error("Invalid application expiration.");
          if (expiresAt > this.now()) return current;
        }
        if (revision !== undefined && current.revision !== revision) throw new ApplicationRevisionConflictError(current);
        if (current.status !== "pending") throw new Error("INVALID_STATE");
        const updated: PublisherApplication = {
          ...current, status, revision: current.revision + 1, updatedAt: at,
          ...(status === "rejected" ? {reviewedAt: at, reviewerUid: actor, decisionReason: reason} : {}),
        };
        tx.set(ref, updated);
        tx.create(audit, {action: status, actorUid: actor, targetUid: current.applicantUid,
          applicationId: id, createdAt: at, ...(reason ? {reason} : {})});
        if (status !== "withdrawn") {
          tx.create(notification, {id: notification.id, userId: current.applicantUid,
            type: status === "rejected" ? "publisher_application_rejected" : "publisher_application_expired",
            message: status === "rejected" ? `Your publisher application was rejected: ${reason}` :
              "Your publisher application expired without a decision.", read: false, createdAt: at});
        }
        return updated;
      });
    });
  }

  private async storage<T>(operation: (db: FirebaseFirestore.Firestore) => Promise<T>): Promise<T> {
    try {
      return await operation(this.database());
    } catch (error) {
      if (error instanceof ApplicationRevisionConflictError ||
          (error instanceof Error && ["DUPLICATE_ACTIVE_APPLICATION", "APPLICATION_NOT_FOUND", "FORBIDDEN", "INVALID_STATE"].includes(error.message))) {
        throw error;
      }
      console.error(`[publisher-applications] Storage failed: ${error instanceof Error ? error.name : typeof error}`);
      throw new PublisherApplicationStoreError();
    }
  }
}
