import type { InAppNotification } from "@library-flow/shared";

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

export const notificationRepository = new NotificationRepository();
