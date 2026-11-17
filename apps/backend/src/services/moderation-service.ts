import {
  REJECTED_FILE_DELETION_HOURS,
  REJECTION_REASON_MAX_LENGTH,
} from "@library-flow/shared";
import type { Book, BookComment, InAppNotification } from "@library-flow/shared";
import {
  bookRepository as defaultBookRepository,
  BookRepository,
} from "../repositories/book-repository.js";
import {
  commentRepository as defaultCommentRepository,
  CommentRepository,
} from "../repositories/comment-repository.js";
import {
  notificationRepository as defaultNotificationRepository,
  NotificationRepository,
} from "../repositories/notification-repository.js";

export class ModerationService {
  public constructor(
    private readonly books: BookRepository = defaultBookRepository,
    private readonly comments: CommentRepository = defaultCommentRepository,
    private readonly notifications: NotificationRepository =
      defaultNotificationRepository,
  ) {}

  async getPendingBooks(): Promise<Book[]> {
    return this.books.findPending();
  }

  async approveBook(bookId: string, _moderatorId: string): Promise<Book> {
    const book = await this.getPendingBook(bookId);
    const updatedBook = await this.books.update(book.id, {
      status: "approved",
      updatedAt: new Date().toISOString(),
    });
    if (!updatedBook) {
      throw new Error("Book could not be approved.");
    }
    return updatedBook;
  }

  async rejectBook(
    bookId: string,
    reason: string,
    _moderatorId: string,
  ): Promise<Book> {
    const book = await this.getPendingBook(bookId);
    const normalizedReason = this.validateReason(reason);
    const rejectionDate = new Date();
    const scheduledDeletionDate = new Date(rejectionDate);
    scheduledDeletionDate.setHours(
      scheduledDeletionDate.getHours() + REJECTED_FILE_DELETION_HOURS,
    );

    const updatedBook = await this.books.update(book.id, {
      status: "rejected",
      rejectionReason: normalizedReason,
      rejectionDate: rejectionDate.toISOString(),
      scheduledDeletionDate: scheduledDeletionDate.toISOString(),
      updatedAt: rejectionDate.toISOString(),
    });
    if (!updatedBook) {
      throw new Error("Book could not be rejected.");
    }

    await this.notifications.create({
      id: crypto.randomUUID(),
      userId: book.ownerId,
      type: "book_rejected",
      message: `Your book was rejected: ${normalizedReason}`,
      read: false,
      createdAt: rejectionDate.toISOString(),
    });
    return updatedBook;
  }

  async removeComment(
    commentId: string,
    reason: string,
    moderatorId: string,
  ): Promise<BookComment> {
    const comment = await this.comments.findById(commentId);
    if (!comment) {
      throw new Error("Comment not found.");
    }

    const normalizedReason = this.validateReason(reason);
    const moderatedAt = new Date().toISOString();
    const deletedComment = await this.comments.softDelete(commentId, {
      moderatorId,
      reason: normalizedReason,
      moderatedAt,
    });
    if (!deletedComment) {
      throw new Error("Comment could not be removed.");
    }

    await this.notifications.create({
      id: crypto.randomUUID(),
      userId: comment.authorId,
      type: "comment_removed",
      message: `Your comment was removed by moderation: ${normalizedReason}`,
      read: false,
      createdAt: moderatedAt,
    });
    return deletedComment;
  }

  private async getPendingBook(bookId: string): Promise<Book> {
    const book = await this.books.findById(bookId);
    if (!book) {
      throw new Error("Book not found.");
    }
    if (book.status !== "pending") {
      throw new Error("Only pending books can be moderated.");
    }
    return book;
  }

  private validateReason(reason: string): string {
    const normalizedReason = reason.trim();
    if (
      normalizedReason.length === 0 ||
      normalizedReason.length > REJECTION_REASON_MAX_LENGTH
    ) {
      throw new Error(
        `Moderation reason must contain between 1 and ${REJECTION_REASON_MAX_LENGTH} characters.`,
      );
    }
    return normalizedReason;
  }
}

export const moderationService = new ModerationService();
