export type InAppNotificationType = "book_rejected" | "comment_removed";

export type InAppNotification = {
  id: string;
  userId: string;
  type: InAppNotificationType;
  message: string;
  read: boolean;
  createdAt: string;
};
