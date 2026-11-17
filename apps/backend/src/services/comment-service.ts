import { COMMENT_MAX_LENGTH } from "@library-flow/shared";
import type { BookComment } from "@library-flow/shared";
import {
  bookRepository as defaultBookRepository,
  BookRepository,
} from "../repositories/book-repository.js";
import {
  commentRepository as defaultCommentRepository,
  CommentRepository,
} from "../repositories/comment-repository.js";

export class CommentService {
  public constructor(
    private readonly books: BookRepository = defaultBookRepository,
    private readonly comments: CommentRepository = defaultCommentRepository,
  ) {}

  async addComment(
    bookId: string,
    content: string,
    authorId: string,
    authorDisplayName: string,
  ): Promise<BookComment> {
    const book = await this.books.findById(bookId);
    if (!book) {
      throw new Error("Book not found.");
    }
    if (book.status !== "approved") {
      throw new Error("Comments are only allowed on approved books.");
    }

    const normalizedContent = content.trim();
    if (
      normalizedContent.length === 0 ||
      normalizedContent.length > COMMENT_MAX_LENGTH
    ) {
      throw new Error(
        `Comment must contain between 1 and ${COMMENT_MAX_LENGTH} characters.`,
      );
    }

    const comment: BookComment = {
      id: crypto.randomUUID(),
      bookId,
      authorId,
      authorDisplayName,
      content: normalizedContent,
      createdAt: new Date().toISOString(),
      isDeleted: false,
    };

    return this.comments.create(comment);
  }

  async getCommentsForBook(bookId: string): Promise<BookComment[]> {
    const book = await this.books.findById(bookId);
    if (!book) {
      throw new Error("Book not found.");
    }
    if (book.status !== "approved") {
      throw new Error("Comments are only available for approved books.");
    }

    return this.comments.findByBookId(bookId);
  }
}

export const commentService = new CommentService();
