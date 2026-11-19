import {
  COMMENT_MAX_LENGTH,
  type BookComment,
  type CreateCommentDto,
} from "@library-flow/shared";
import { bookRepository } from "../repositories/book-repository";
import { commentRepository } from "../repositories/comment-repository";
import type { AuthUser } from "../types/auth";

export type CommentServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export const commentService = {
  async moderateComment(
    moderator: AuthUser,
    commentId: string,
    reason: string
  ): Promise<CommentServiceResult<BookComment>> {
    if (moderator.role !== "moderator") {
      return {
        success: false,
        error: { code: "FORBIDDEN_ROLE", message: "Only moderators can remove comments." },
      };
    }
    const normalizedReason = reason.trim();
    if (!normalizedReason || normalizedReason.length > 500) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Removal reason must contain 1–500 characters." },
      };
    }
    const moderated = await commentRepository.moderateComment(
      commentId,
      moderator.id,
      normalizedReason
    );
    if (!moderated) {
      return {
        success: false,
        error: { code: "COMMENT_NOT_FOUND", message: "The selected comment could not be found." },
      };
    }
    return { success: true, data: moderated };
  },

  async getPublisherBookComments(
    publisher: AuthUser,
    bookId: string
  ): Promise<CommentServiceResult<BookComment[]>> {
    if (publisher.role !== "publisher") {
      return {
        success: false,
        error: {
          code: "FORBIDDEN_ROLE",
          message: "Only authenticated publishers can access this comment section.",
        },
      };
    }

    const book = await bookRepository.getStoredEntryById(bookId);
    if (!book) {
      return {
        success: false,
        error: {
          code: "BOOK_NOT_FOUND",
          message: "The selected book could not be found.",
        },
      };
    }

    // RN-001 & ownership check: only load comments belonging to the selected publisher book
    if (book.ownerId !== publisher.id) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN_OWNER",
          message: "You can only view the publisher comment panel for books you own.",
        },
      };
    }

    const comments = await commentRepository.getCommentsByBookId(bookId);
    return { success: true, data: comments };
  },

  // Helper compatible with US-REA-012 / CreateCommentDto for testing reader feedback flow
  async addReaderComment(
    bookId: string,
    author: { id: string; displayName: string },
    dto: CreateCommentDto
  ): Promise<CommentServiceResult<BookComment>> {
    const trimmed = dto.content.trim();
    if (!trimmed) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Comment content cannot be empty.",
        },
      };
    }

    if (trimmed.length > COMMENT_MAX_LENGTH) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: `Comment must not exceed ${COMMENT_MAX_LENGTH} characters.`,
        },
      };
    }

    const book = await bookRepository.getStoredEntryById(bookId);
    if (!book) {
      return {
        success: false,
        error: {
          code: "BOOK_NOT_FOUND",
          message: "Cannot post a comment on a book that does not exist.",
        },
      };
    }
    if (book.status !== "approved") {
      return {
        success: false,
        error: {
          code: "BOOK_NOT_APPROVED",
          message: "Comments are allowed only on approved books.",
        },
      };
    }

    const comment: BookComment = {
      id: `cmt-${crypto.randomUUID()}`,
      bookId,
      authorId: author.id,
      authorDisplayName: author.displayName,
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const saved = await commentRepository.saveComment(comment);
    return { success: true, data: saved };
  },
};