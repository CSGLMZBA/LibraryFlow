import { bookRepository } from "../repositories/book-repository";
import {
  detectAllowedBookFormat,
  validateCreateBookInput,
  validateUpdateBookInput,
} from "../schemas/book-schema";
import type { AuthUser } from "../types/auth";
import type {
  BookCategory,
  BookGenre,
  BookOperationResult,
  BookRecord,
  CreateBookInput,
  StoredBookEntry,
  UpdateBookInput,
} from "../types/book";

function generateUniqueAccessKey(
  title: string,
  author: string,
  existingBooks: BookRecord[]
): string {
  const titleSlug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 16);
  const authorSlug = author
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);

  let key = "";
  let attempts = 0;

  do {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    key = `LF-${titleSlug || "book"}-${authorSlug || "author"}-${randomSuffix}`;
    attempts += 1;
  } while (existingBooks.some((b) => b.accessKey === key) && attempts < 50);

  return key;
}

export const bookService = {
  async listPendingBooks(moderator: AuthUser): Promise<BookRecord[]> {
    if (moderator.role !== "moderator") return [];
    const books = await bookRepository.getAllBooks();
    return books
      .filter((book) => book.status === "pending-approval")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async approveBook(
    moderator: AuthUser,
    bookId: string
  ): Promise<BookOperationResult<BookRecord>> {
    if (moderator.role !== "moderator") {
      return {
        success: false,
        error: { code: "FORBIDDEN_ROLE", message: "Only moderators can approve books.", field: "general" },
      };
    }
    const stored = await bookRepository.getStoredEntryById(bookId);
    if (!stored) {
      return {
        success: false,
        error: { code: "BOOK_NOT_FOUND", message: "The selected book could not be found.", field: "general" },
      };
    }
    const updated = { ...stored, status: "approved" as const, updatedAt: new Date().toISOString() };
    const saved = await bookRepository.saveBookEntry(updated);
    return { success: true, data: saved, message: `"${saved.title}" is now public.` };
  },

  async rejectBook(
    moderator: AuthUser,
    bookId: string,
    reason: string
  ): Promise<BookOperationResult<BookRecord>> {
    if (moderator.role !== "moderator") {
      return {
        success: false,
        error: { code: "FORBIDDEN_ROLE", message: "Only moderators can reject books.", field: "general" },
      };
    }
    const normalizedReason = reason.trim();
    if (!normalizedReason || normalizedReason.length > 500) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Rejection reason must contain 1–500 characters.", field: "general" },
      };
    }
    const stored = await bookRepository.getStoredEntryById(bookId);
    if (!stored) {
      return {
        success: false,
        error: { code: "BOOK_NOT_FOUND", message: "The selected book could not be found.", field: "general" },
      };
    }
    const updated = {
      ...stored,
      status: "rejected" as const,
      rejectionReason: normalizedReason,
      updatedAt: new Date().toISOString(),
    };
    const saved = await bookRepository.saveBookEntry(updated);
    return { success: true, data: saved, message: `"${saved.title}" was rejected and the owner was notified.` };
  },

  getAvailableCategories(): BookCategory[] {
    return bookRepository.getCategories();
  },

  getAvailableGenres(): BookGenre[] {
    return bookRepository.getGenres();
  },

  async listPublisherBooks(publisher: AuthUser): Promise<BookRecord[]> {
    if (publisher.role !== "publisher") {
      return [];
    }
    return bookRepository.getBooksByOwner(publisher.id);
  },

  async publishBook(
    publisher: AuthUser,
    input: CreateBookInput
  ): Promise<BookOperationResult<BookRecord>> {
    // US-PUB-001 RN-001: Only authenticated publishers may publish books
    if (publisher.role !== "publisher") {
      return {
        success: false,
        error: {
          code: "FORBIDDEN_ROLE",
          message: "Only authenticated publishers can share books.",
          field: "general",
        },
      };
    }

    const categories = bookRepository.getCategories();
    const genres = bookRepository.getGenres();
    const validationErrors = validateCreateBookInput(input, categories, genres);
    const firstField = Object.keys(validationErrors)[0] as
      | keyof typeof validationErrors
      | undefined;

    if (firstField) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: validationErrors[firstField] ?? "Invalid book submission.",
          field: firstField,
        },
      };
    }

    const normalizedTitle = input.title.trim();
    const normalizedAuthor = input.author.trim();
    const allBooks = await bookRepository.getAllBooks();

    // US-PUB-001 RN-008: Combination of title and author must be unique
    const isDuplicateTitleAuthor = allBooks.some(
      (b) =>
        b.title.trim().toLowerCase() === normalizedTitle.toLowerCase() &&
        b.author.trim().toLowerCase() === normalizedAuthor.toLowerCase()
    );

    if (isDuplicateTitleAuthor) {
      return {
        success: false,
        error: {
          code: "DUPLICATE_BOOK",
          message: "A book with the same title and author already exists.",
          field: "title",
        },
      };
    }

    const file = input.file!;
    const fileFormat = detectAllowedBookFormat(file)!;
    const now = new Date().toISOString();

    const newEntry: StoredBookEntry = {
      id: `bk-${crypto.randomUUID()}`,
      ownerId: publisher.id,
      ownerDisplayName: publisher.displayName,
      title: normalizedTitle,
      author: normalizedAuthor,
      description: input.description.trim(),
      categoryId: input.categoryId,
      genreId: input.genreId,
      fileName: file.name,
      fileFormat,
      fileSizeBytes: file.size,
      accessKey: generateUniqueAccessKey(normalizedTitle, normalizedAuthor, allBooks),
      status: "pending-approval", // US-PUB-001 CA-001
      createdAt: now,
      updatedAt: now,
      fileBlob: file,
    };

    const saved = await bookRepository.saveBookEntry(newEntry);
    return {
      success: true,
      data: saved,
      message: `Book "${saved.title}" submitted for moderator approval (Access Key: ${saved.accessKey}).`,
    };
  },

  async updateBookDetails(
    publisher: AuthUser,
    bookId: string,
    input: UpdateBookInput
  ): Promise<BookOperationResult<BookRecord>> {
    if (publisher.role !== "publisher") {
      return {
        success: false,
        error: {
          code: "FORBIDDEN_ROLE",
          message: "Only authenticated publishers can update book details.",
          field: "general",
        },
      };
    }

    const existing = await bookRepository.getStoredEntryById(bookId);
    if (!existing) {
      return {
        success: false,
        error: {
          code: "BOOK_NOT_FOUND",
          message: "The requested book could not be found.",
          field: "general",
        },
      };
    }

    // US-PUB-004 CA-003 & RN-001: Preserve ownership enforcement
    if (existing.ownerId !== publisher.id) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN_OWNER",
          message: "You can only update details for books you own.",
          field: "general",
        },
      };
    }

    const categories = bookRepository.getCategories();
    const genres = bookRepository.getGenres();
    const validationErrors = validateUpdateBookInput(input, categories, genres);
    const firstField = Object.keys(validationErrors)[0] as
      | keyof typeof validationErrors
      | undefined;

    if (firstField) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: validationErrors[firstField] ?? "Invalid metadata update.",
          field: firstField,
        },
      };
    }

    const normalizedTitle = input.title.trim();
    const normalizedAuthor = input.author.trim();
    const allBooks = await bookRepository.getAllBooks();

    const isDuplicateTitleAuthor = allBooks.some(
      (b) =>
        b.id !== bookId &&
        b.title.trim().toLowerCase() === normalizedTitle.toLowerCase() &&
        b.author.trim().toLowerCase() === normalizedAuthor.toLowerCase()
    );

    if (isDuplicateTitleAuthor) {
      return {
        success: false,
        error: {
          code: "DUPLICATE_BOOK",
          message: "Another book already uses this title and author combination.",
          field: "title",
        },
      };
    }

    // US-PUB-004 CA-002: Preserve id, ownerId, accessKey, and creation history
    const updatedEntry: StoredBookEntry = {
      ...existing,
      title: normalizedTitle,
      author: normalizedAuthor,
      description: input.description.trim(),
      categoryId: input.categoryId,
      genreId: input.genreId,
      updatedAt: new Date().toISOString(),
    };

    const saved = await bookRepository.saveBookEntry(updatedEntry);
    return {
      success: true,
      data: saved,
      message: `Book "${saved.title}" details and classification updated.`,
    };
  },

  async deleteOwnedBook(
    publisher: AuthUser,
    bookId: string
  ): Promise<BookOperationResult<null>> {
    const existing = await bookRepository.getStoredEntryById(bookId);
    if (!existing) {
      return {
        success: false,
        error: {
          code: "BOOK_NOT_FOUND",
          message: "Book not found.",
        },
      };
    }

    if (publisher.role !== "publisher" || existing.ownerId !== publisher.id) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN_OWNER",
          message: "You can only delete books that you own.",
        },
      };
    }

    await bookRepository.deleteBookById(bookId);
    return {
      success: true,
      data: null,
      message: `Book "${existing.title}" was deleted.`,
    };
  },
};