export type BookComment = {
  id: string;
  bookId: string;
  authorId: string;
  authorDisplayName: string;
  content: string;
  createdAt: string;
  isDeleted?: boolean;
  moderationReason?: string;
  moderatedBy?: string;
  moderatedAt?: string;
};

export type CreateCommentDto = {
  content: string;
};

export type ModerateCommentDto = {
  reason: string;
};
