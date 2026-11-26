import { FieldPath, getFirestore } from "firebase-admin/firestore";
import type { InAppNotification } from "@library-flow/shared";
import { authAdmin } from "./firebase-auth-service.js";

const INBOX_LIMIT = 100;
const SCAN_PAGE_SIZE = 200;
// Bounds the work per request: the newest INBOX_LIMIT are exact for up to this many stored records.
const MAX_SCAN_PAGES = 10;

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
    // Equality plus document-ID ordering needs no composite index; sort newest-first after paging.
    const records: InAppNotification[] = [];
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    for (let page = 0; page < MAX_SCAN_PAGES; page++) {
      let query = this.database().collection("notifications").where("userId", "==", uid)
        .orderBy(FieldPath.documentId()).limit(SCAN_PAGE_SIZE);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      for (const doc of snapshot.docs) records.push(this.parse(doc, uid));
      if (snapshot.docs.length < SCAN_PAGE_SIZE) break;
      cursor = snapshot.docs[snapshot.docs.length - 1];
    }
    return records.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id))
      .slice(0, INBOX_LIMIT);
  }

  private parse(doc: FirebaseFirestore.QueryDocumentSnapshot, uid: string): InAppNotification {
    const value = doc.data();
    if (value.userId !== uid || !isNotificationType(value.type) ||
        typeof value.message !== "string" || typeof value.read !== "boolean" ||
        typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))) {
      throw new Error("Invalid notification record.");
    }
    return {id: doc.id, userId: uid, type: value.type, message: value.message,
      read: value.read, createdAt: value.createdAt};
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
