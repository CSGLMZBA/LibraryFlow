import type { BookComment } from "@library-flow/shared";

type CommentModeration = {
  moderatorId: string;
  reason: string;
  moderatedAt: string;
};

export class CommentRepository {
  private readonly comments = new Map<string, BookComment>();

  async create(comment: BookComment): Promise<BookComment> {
    const storedComment = this.clone(comment);
    this.comments.set(storedComment.id, storedComment);
    return this.clone(storedComment);
  }

  async findByBookId(
    bookId: string,
    includeDeleted = false,
  ): Promise<BookComment[]> {
    return Array.from(this.comments.values())
      .filter(
        (comment) =>
          comment.bookId === bookId && (includeDeleted || !comment.isDeleted),
      )
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      )
      .map((comment) => this.clone(comment));
  }

  async findById(id: string): Promise<BookComment | null> {
    const comment = this.comments.get(id);
    return comment ? this.clone(comment) : null;
  }

  async softDelete(
    id: string,
    moderation: CommentModeration,
  ): Promise<BookComment | null> {
    const comment = this.comments.get(id);
    if (!comment) {
      return null;
    }

    const deletedComment = this.clone({
      ...comment,
      isDeleted: true,
      moderationReason: moderation.reason,
      moderatedBy: moderation.moderatorId,
      moderatedAt: moderation.moderatedAt,
    });
    this.comments.set(id, deletedComment);
    return this.clone(deletedComment);
  }

  async redactAuthor(uid: string): Promise<void> {
    for (const [id, comment] of this.comments) {
      if (comment.authorId === uid) this.comments.set(id, {...comment, authorDisplayName: 'Deleted user', content: '', isDeleted: true});
    }
  }

  private clone(comment: BookComment): BookComment {
    return { ...comment };
  }
}

export const commentRepository = new CommentRepository();
