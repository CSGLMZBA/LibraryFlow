import { getFirestore } from "firebase-admin/firestore";
import type { InAppNotification } from "@library-flow/shared";
import { authAdmin } from "../services/firebase-auth-service.js";

export class NotificationRepository {
  private readonly notifications = new Map<string, InAppNotification>();

  async create(
    notification: InAppNotification,
  ): Promise<InAppNotification> {
    const storedNotification = { ...notification };
    this.notifications.set(storedNotification.id, storedNotification);
    return { ...storedNotification };
  }

  async findByUserId(userId: string): Promise<InAppNotification[]> {
    return Array.from(this.notifications.values())
      .filter((notification) => notification.userId === userId)
      .map((notification) => ({ ...notification }));
  }

  async markAsRead(id: string): Promise<void> {
    const notification = this.notifications.get(id);
    if (notification) {
      this.notifications.set(id, { ...notification, read: true });
    }
  }
}

export class NotificationStoreError extends Error {
  constructor() {
    super("Notification storage is temporarily unavailable.");
    this.name = "NotificationStoreError";
  }
}

/** Durable Firestore notifications, shown by the private inbox. Opt in with ENABLE_CLOUD_CONTENT=true. */
export class FirestoreNotificationRepository extends NotificationRepository {
  constructor(private readonly database: () => FirebaseFirestore.Firestore = () => {
    authAdmin();
    return getFirestore();
  }) {
    super();
  }

  private async storage<T>(operation: (db: FirebaseFirestore.Firestore) => Promise<T>): Promise<T> {
    try {
      return await operation(this.database());
    } catch (error) {
      console.error(`[notifications] Storage failed: ${error instanceof Error ? error.name : typeof error}`);
      throw new NotificationStoreError();
    }
  }

  override async create(notification: InAppNotification): Promise<InAppNotification> {
    await this.storage(db => db.collection("notifications").doc(notification.id).create({ ...notification }));
    return { ...notification };
  }

  override async findByUserId(userId: string): Promise<InAppNotification[]> {
    const snapshot = await this.storage(db => db.collection("notifications").where("userId", "==", userId).get());
    return snapshot.docs.map(doc => ({ ...(doc.data() as InAppNotification), id: doc.id }));
  }

  override async markAsRead(id: string): Promise<void> {
    await this.storage(db => db.runTransaction(async tx => {
      const ref = db.collection("notifications").doc(id);
      const snapshot = await tx.get(ref);
      if (snapshot.exists) tx.update(ref, { read: true });
    }));
  }
}

export const notificationRepository: NotificationRepository = process.env.ENABLE_CLOUD_CONTENT === "true"
  ? new FirestoreNotificationRepository()
  : new NotificationRepository();
