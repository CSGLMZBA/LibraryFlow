import { getFirestore } from "firebase-admin/firestore";
import type { InAppNotification } from "@library-flow/shared";
import { authAdmin } from "./firebase-auth-service.js";

const notificationTypes: ReadonlySet<string> = new Set([
  "book_rejected", "comment_removed", "publisher_application_approved",
  "publisher_application_rejected", "publisher_application_expired",
  "publisher_revoked", "book_deleted", "account_restored", "ban_changed",
]);
function isNotificationType(value: unknown): value is InAppNotification["type"] {
  return typeof value === "string" && notificationTypes.has(value);
}

export interface NotificationInbox {
  list(uid: string): Promise<InAppNotification[]>;
  markRead(uid: string, id: string): Promise<boolean>;
}

export class FirestoreNotificationInbox implements NotificationInbox {
  constructor(private readonly database: () => FirebaseFirestore.Firestore = () => {
    authAdmin();
    return getFirestore();
  }) {}
  async list(uid: string): Promise<InAppNotification[]> {
    const snapshot = await this.database().collection("notifications").where("userId", "==", uid).limit(100).get();
    return snapshot.docs.map(doc => {
      const value = doc.data();
      if (value.userId !== uid || !isNotificationType(value.type) ||
          typeof value.message !== "string" || typeof value.read !== "boolean" ||
          typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))) {
        throw new Error("Invalid notification record.");
      }
      return {id: doc.id, userId: uid, type: value.type, message: value.message,
        read: value.read, createdAt: value.createdAt};
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async markRead(uid: string, id: string): Promise<boolean> {
    const db = this.database();
    const ref = db.collection("notifications").doc(id);
    return db.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists || snapshot.data()?.userId !== uid) return false;
      if (snapshot.data()?.read !== true) tx.update(ref, {read: true});
      return true;
    });
  }
}

export const notificationInbox = new FirestoreNotificationInbox();
