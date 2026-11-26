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

/** The decision is stored but the Firebase role change has not completed; retrying the same action is safe. */
export class RoleSyncPendingError extends Error {
  constructor() {
    super("The decision was recorded, but the role change is still pending. Retry the same action.");
    this.name = "RoleSyncPendingError";
  }
}

export interface RoleAdmin {
  getRole(uid: string): Promise<string | null>;
  /** Fails with INVALID_STATE unless the current role is one of `allowedCurrent`, so a moderator is never changed. */
  setRole(uid: string, role: "publisher" | "reader", allowedCurrent: string[]): Promise<void>;
}

export const firebaseRoleAdmin: RoleAdmin = {
  async getRole(uid) {
    const role = (await authAdmin().getUser(uid)).customClaims?.role;
    return typeof role === "string" ? role : null;
  },
  async setRole(uid, role, allowedCurrent) {
    const auth = authAdmin();
    const user = await auth.getUser(uid);
    const current = user.customClaims?.role;
    if (typeof current !== "string" || !allowedCurrent.includes(current)) throw new Error("INVALID_STATE");
    await auth.setCustomUserClaims(uid, { ...(user.customClaims ?? {}), role });
  },
};

export class CloudPublisherApplicationService extends PublisherApplicationService {
  constructor(private readonly database: () => FirebaseFirestore.Firestore = () => {
    authAdmin();
    return getFirestore();
  }, private readonly now: () => number = Date.now,
  private readonly roles: RoleAdmin = firebaseRoleAdmin) {
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
        if (existing.docs.some(doc => {
          const value = doc.data();
          return value.status === "pending" || (value.status === "approved" && !value.revokedAt);
        })) {
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

  override async approveApplication(id: string, reviewerUid: string, revision?: number): Promise<PublisherApplication> {
    const preliminary = await this.storage(db => db.collection("publisherApplications").doc(id).get());
    if (!preliminary.exists) throw new Error("APPLICATION_NOT_FOUND");
    const applicantUid = (preliminary.data() as PublisherApplication).applicantUid;
    const role = await this.currentRole(applicantUid);
    if (role !== "reader" && role !== "publisher") throw new Error("INVALID_STATE");
    const changeId = `approve-${id}`;
    const at = new Date(this.now()).toISOString();
    const application = await this.storage(db => {
      const ref = db.collection("publisherApplications").doc(id);
      const change = db.collection("publisherRoleChanges").doc(changeId);
      const audit = db.collection("publisherApplicationAudit").doc();
      const notification = db.collection("notifications").doc();
      return db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        const changeSnapshot = await tx.get(change);
        if (!snapshot.exists) throw new Error("APPLICATION_NOT_FOUND");
        const current = snapshot.data() as PublisherApplication;
        if (current.status === "approved") {
          // Completing an approval whose role change did not finish is idempotent.
          if (changeSnapshot.exists && changeSnapshot.data()?.status === "pending") return current;
          throw new Error("INVALID_STATE");
        }
        if (revision !== undefined && current.revision !== revision) throw new ApplicationRevisionConflictError(current);
        if (current.status !== "pending") throw new Error("INVALID_STATE");
        const updated: PublisherApplication = {
          ...current, status: "approved", revision: current.revision + 1, updatedAt: at,
          reviewedAt: at, reviewerUid,
        };
        tx.set(ref, updated);
        tx.set(change, {kind: "approve", uid: current.applicantUid, role: "publisher", applicationId: id,
          status: "pending", createdAt: at});
        tx.create(audit, {action: "approved", actorUid: reviewerUid, targetUid: current.applicantUid,
          applicationId: id, createdAt: at});
        tx.create(notification, {id: notification.id, userId: current.applicantUid,
          type: "publisher_application_approved", message: "Your publisher application was approved.",
          read: false, createdAt: at});
        return updated;
      });
    });
    await this.applyRole(changeId, applicantUid, "publisher", ["reader", "publisher"]);
    return application;
  }

  override async revokePublisher(uid: string, reviewerUid: string, reason: string): Promise<void> {
    const normalizedReason = this.validateReason(reason);
    const role = await this.currentRole(uid);
    if (role !== "publisher" && role !== "reader") throw new Error("INVALID_STATE");
    const changeId = `revoke-${uid}`;
    const at = new Date(this.now()).toISOString();
    await this.storage(db => {
      const change = db.collection("publisherRoleChanges").doc(changeId);
      const audit = db.collection("publisherApplicationAudit").doc();
      const notification = db.collection("notifications").doc();
      return db.runTransaction(async tx => {
        const changeSnapshot = await tx.get(change);
        if (changeSnapshot.exists && changeSnapshot.data()?.status === "pending") return;
        if (role !== "publisher") throw new Error("INVALID_STATE");
        const applications = await tx.get(db.collection("publisherApplications").where("applicantUid", "==", uid));
        for (const doc of applications.docs) {
          const value = doc.data() as PublisherApplication;
          if (value.status === "approved" && !value.revokedAt) {
            tx.set(db.collection("publisherApplications").doc(doc.id),
              {...value, revokedAt: at, updatedAt: at, revision: value.revision + 1});
          }
        }
        tx.set(change, {kind: "revoke", uid, role: "reader", status: "pending", createdAt: at});
        tx.create(audit, {action: "publisher_revoked", actorUid: reviewerUid, targetUid: uid,
          reason: normalizedReason, createdAt: at});
        tx.create(notification, {id: notification.id, userId: uid, type: "publisher_revoked",
          message: `Your publisher access was revoked: ${normalizedReason}`, read: false, createdAt: at});
      });
    });
    await this.applyRole(changeId, uid, "reader", ["publisher", "reader"]);
  }

  private async currentRole(uid: string): Promise<string | null> {
    try {
      return await this.roles.getRole(uid);
    } catch (error) {
      if ((error as {code?: string}).code === "auth/user-not-found") throw new Error("INVALID_STATE");
      console.error(`[publisher-applications] Role lookup failed: ${error instanceof Error ? error.name : typeof error}`);
      throw new PublisherApplicationStoreError();
    }
  }

  private async applyRole(changeId: string, uid: string, role: "publisher" | "reader", allowed: string[]): Promise<void> {
    try {
      await this.roles.setRole(uid, role, allowed);
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_STATE") throw error;
      console.error(`[publisher-applications] Role change pending: ${error instanceof Error ? error.name : typeof error}`);
      throw new RoleSyncPendingError();
    }
    try {
      await this.storage(db => db.runTransaction(async tx => {
        const ref = db.collection("publisherRoleChanges").doc(changeId);
        const snapshot = await tx.get(ref);
        if (snapshot.exists && snapshot.data()?.status === "pending") {
          tx.set(ref, {...snapshot.data(), status: "completed", completedAt: new Date(this.now()).toISOString()});
        }
      }));
    } catch {
      // The role is already correct; a later retry completes the marker idempotently.
    }
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
