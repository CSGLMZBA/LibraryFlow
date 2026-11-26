export type InAppNotificationType =
  | "book_rejected"
  | "comment_removed"
  | "publisher_application_approved"
  | "publisher_application_rejected"
  | "publisher_application_expired"
  | "publisher_revoked"
  | "book_deleted"
  | "account_restored"
  | "ban_changed";

export type InAppNotification = {
  id: string;
  userId: string;
  type: InAppNotificationType;
  message: string;
  read: boolean;
  createdAt: string;
};
