import type { AuthUser } from "../types/auth";
import type {
  BookCategory,
  BookGenre,
  BookOperationResult,
  BookRecord,
  CreateBookInput,
  UpdateBookInput,
} from "../types/book";

/** What the screens need from a book backend; implemented by the IndexedDB and cloud services. */
export interface BookServicePort {
  /** Resolves the categories and genres, loading them first in cloud mode. */
  loadClassifications(): Promise<{ categories: BookCategory[]; genres: BookGenre[] }>;
  /** Synchronous snapshot of the classifications loaded so far. */
  getAvailableCategories(): BookCategory[];
  getAvailableGenres(): BookGenre[];
  listApprovedBooks(): Promise<BookRecord[]>;
  listPendingBooks(moderator: AuthUser): Promise<BookRecord[]>;
  approveBook(moderator: AuthUser, bookId: string): Promise<BookOperationResult<BookRecord>>;
  rejectBook(moderator: AuthUser, bookId: string, reason: string): Promise<BookOperationResult<BookRecord>>;
  listPublisherBooks(publisher: AuthUser): Promise<BookRecord[]>;
  publishBook(publisher: AuthUser, input: CreateBookInput): Promise<BookOperationResult<BookRecord>>;
  updateBookDetails(publisher: AuthUser, bookId: string, input: UpdateBookInput): Promise<BookOperationResult<BookRecord>>;
  deleteOwnedBook(publisher: AuthUser, bookId: string): Promise<BookOperationResult<null>>;
}
