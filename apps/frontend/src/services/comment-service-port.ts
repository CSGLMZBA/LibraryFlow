import type { BookComment, CreateCommentDto } from "@library-flow/shared";
import type { AuthUser } from "../types/auth";

export type CommentServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

/** What the screens need from a comment backend; implemented by the IndexedDB and cloud services. */
export interface CommentServicePort {
  listBookComments(bookId: string): Promise<BookComment[]>;
  listAllForModeration(): Promise<BookComment[]>;
  moderateComment(moderator: AuthUser, commentId: string, reason: string): Promise<CommentServiceResult<BookComment>>;
  getPublisherBookComments(publisher: AuthUser, bookId: string): Promise<CommentServiceResult<BookComment[]>>;
  addReaderComment(
    bookId: string,
    author: { id: string; displayName: string },
    dto: CreateCommentDto,
  ): Promise<CommentServiceResult<BookComment>>;
}
