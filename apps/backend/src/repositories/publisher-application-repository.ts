import type { PublisherApplication } from "@library-flow/shared";

export class ApplicationRevisionConflictError extends Error {
  constructor(public readonly application: PublisherApplication) {
    super("The record changed. Reload it before retrying.");
    this.name = "ApplicationRevisionConflictError";
  }
}

export class PublisherApplicationRepository {
  private readonly applications = new Map<string, PublisherApplication>();

  async save(application: PublisherApplication): Promise<PublisherApplication> {
    const storedApplication = this.clone(application);
    this.applications.set(storedApplication.id, storedApplication);
    return this.clone(storedApplication);
  }

  async findById(id: string): Promise<PublisherApplication | null> {
    const application = this.applications.get(id);
    return application ? this.clone(application) : null;
  }

  async findActiveByApplicant(
    applicantUid: string,
  ): Promise<PublisherApplication | null> {
    const application = Array.from(this.applications.values()).find(
      (candidate) =>
        candidate.applicantUid === applicantUid &&
        candidate.status === "pending",
    );
    return application ? this.clone(application) : null;
  }

  async findByApplicant(applicantUid: string): Promise<PublisherApplication[]> {
    return Array.from(this.applications.values())
      .filter((application) => application.applicantUid === applicantUid)
      .map((application) => this.clone(application));
  }

  async findPending(): Promise<PublisherApplication[]> {
    return Array.from(this.applications.values())
      .filter((application) => application.status === "pending")
      .map((application) => this.clone(application));
  }

  async update(
    id: string,
    updates: Partial<PublisherApplication>,
    expectedRevision?: number,
  ): Promise<PublisherApplication | null> {
    const currentApplication = this.applications.get(id);
    if (!currentApplication) {
      return null;
    }
    if (expectedRevision !== undefined && currentApplication.revision !== expectedRevision) {
      throw new ApplicationRevisionConflictError(this.clone(currentApplication));
    }

    if (updates.id !== undefined && updates.id !== id) {
      throw new Error("Application ID cannot be changed.");
    }

    const updatedApplication = this.clone({
      ...currentApplication,
      ...updates,
      id: currentApplication.id,
    });
    this.applications.set(id, updatedApplication);
    return this.clone(updatedApplication);
  }

  private clone(application: PublisherApplication): PublisherApplication {
    return { ...application };
  }
}

export const publisherApplicationRepository =
  new PublisherApplicationRepository();
