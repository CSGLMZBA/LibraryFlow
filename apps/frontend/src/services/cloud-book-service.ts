import type { Book } from "@library-flow/shared";
import { detectAllowedBookFormat, validateCreateBookInput, validateUpdateBookInput } from "../schemas/book-schema";
import type { AuthUser } from "../types/auth";
import type {
  BookCategory,
  BookGenre,
  BookOperationResult,
  BookRecord,
  CreateBookInput,
  UpdateBookInput,
} from "../types/book";
import type { BookServicePort } from "./book-service-port";
import { cloudContentApi, ContentApiError, type CloudContentApi } from "./cloud-content-api";

const CONTENT_TYPES = { pdf: "application/pdf", epub: "application/epub+zip" } as const;

/** Maps a server book to the screens' record. Permanently deleted books are never shown. */
export function toBookRecord(book: Book): BookRecord | null {
  if (book.status === "deleted") return null;
  return {
    id: book.id,
    ownerId: book.ownerId,
    ownerDisplayName: "Publisher",
    title: book.title,
    author: book.author,
    description: book.description ?? "",
    categoryId: book.categoryIds[0] ?? "",
    genreId: book.genreIds[0] ?? "",
    fileName: book.fileObjectPath?.split("/").pop() ?? `${book.title}.${book.fileType}`,
    fileFormat: book.fileType,
    fileSizeBytes: book.fileSizeBytes,
    accessKey: book.accessKey,
    status: book.status === "pending" ? "pending-approval" : book.status,
    ...(book.rejectionReason ? { rejectionReason: book.rejectionReason } : {}),
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    revision: book.revision,
  };
}

function records(books: Book[]): BookRecord[] {
  return books.map(toBookRecord).filter((record): record is BookRecord => record !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function failure(error: unknown): { success: false; error: { code: string; message: string; field: "general" } } {
  if (error instanceof ContentApiError) {
    const message = error.code === "REVISION_CONFLICT"
      ? "This book was changed elsewhere. Reload it and try again."
      : error.message;
    return { success: false, error: { code: error.code, message, field: "general" } };
  }
  return { success: false, error: { code: "SERVICE_UNAVAILABLE", message: "The request could not be completed. Try again.", field: "general" } };
}

/** Book screens backed by the Sprint 2 API (Firestore books, private Supabase files). */
export function createCloudBookService(api: CloudContentApi = cloudContentApi): BookServicePort {
  let categories: BookCategory[] = [];
  let genres: BookGenre[] = [];
  let loading: Promise<{ categories: BookCategory[]; genres: BookGenre[] }> | undefined;

  function loadClassifications() {
    return loading ??= api.listClassifications().then((result) => {
      categories = result.categories.map((category) => ({ id: category.id, name: category.name }));
      genres = result.genres.map((genre) => ({ id: genre.id, name: genre.name, categoryId: "" }));
      return { categories: [...categories], genres: [...genres] };
    }).catch((error: unknown) => {
      loading = undefined;
      throw error;
    });
  }

  return {
    loadClassifications,
    getAvailableCategories: () => [...categories],
    getAvailableGenres: () => [...genres],

    async listApprovedBooks() {
      return records(await api.listCatalog());
    },

    async listPendingBooks(moderator: AuthUser) {
      if (moderator.role !== "moderator") return [];
      return records(await api.listPendingBooks());
    },

    async approveBook(moderator: AuthUser, bookId: string) {
      if (moderator.role !== "moderator") {
        return { success: false, error: { code: "FORBIDDEN_ROLE", message: "Only moderators can approve books.", field: "general" } };
      }
      try {
        const record = toBookRecord(await api.approveBook(bookId));
        if (!record) return failure(new ContentApiError("BOOK_NOT_FOUND", "The selected book could not be found.", 404));
        return { success: true, data: record, message: `"${record.title}" is now public.` };
      } catch (error) {
        return failure(error);
      }
    },

    async rejectBook(moderator: AuthUser, bookId: string, reason: string) {
      if (moderator.role !== "moderator") {
        return { success: false, error: { code: "FORBIDDEN_ROLE", message: "Only moderators can reject books.", field: "general" } };
      }
      const normalizedReason = reason.trim();
      if (!normalizedReason || normalizedReason.length > 500) {
        return { success: false, error: { code: "VALIDATION_ERROR", message: "Rejection reason must contain 1–500 characters.", field: "general" } };
      }
      try {
        const record = toBookRecord(await api.rejectBook(bookId, normalizedReason));
        if (!record) return failure(new ContentApiError("BOOK_NOT_FOUND", "The selected book could not be found.", 404));
        return { success: true, data: record, message: `"${record.title}" was rejected and the owner was notified.` };
      } catch (error) {
        return failure(error);
      }
    },

    async listPublisherBooks(publisher: AuthUser) {
      if (publisher.role !== "publisher") return [];
      return records(await api.listMyBooks());
    },

    async publishBook(publisher: AuthUser, input: CreateBookInput): Promise<BookOperationResult<BookRecord>> {
      if (publisher.role !== "publisher") {
        return { success: false, error: { code: "FORBIDDEN_ROLE", message: "Only authenticated publishers can share books.", field: "general" } };
      }
      try {
        await loadClassifications();
      } catch (error) {
        return failure(error);
      }
      const problems = validateCreateBookInput(input, categories, genres);
      const firstField = Object.keys(problems)[0] as keyof typeof problems | undefined;
      if (firstField) {
        return { success: false, error: { code: "VALIDATION_ERROR", message: problems[firstField] ?? "Invalid book submission.", field: firstField } };
      }

      const file = input.file!;
      const fileType = detectAllowedBookFormat(file)!;
      let created: Book;
      try {
        created = await api.createBook({
          title: input.title.trim(),
          author: input.author.trim(),
          description: input.description.trim(),
          fileType,
          fileSizeBytes: file.size,
          categoryIds: [input.categoryId],
          genreIds: [input.genreId],
        });
      } catch (error) {
        return failure(error);
      }

      try {
        const target = await api.requestUploadUrl(created.id, {
          fileName: file.name, fileType, fileSizeBytes: file.size, revision: created.revision,
        });
        await api.uploadToSignedUrl(target.uploadUrl, file, CONTENT_TYPES[fileType]);
        const completed = toBookRecord(await api.completeUpload(created.id, {
          objectPath: target.objectPath, revision: created.revision,
        }));
        if (!completed) throw new ContentApiError("REQUEST_FAILED", "The upload could not be completed.", 500);
        return {
          success: true,
          data: completed,
          message: `Book "${completed.title}" submitted for moderator approval (Access Key: ${completed.accessKey}).`,
        };
      } catch (error) {
        const reason = failure(error).error.message;
        return {
          success: false,
          error: {
            code: "UPLOAD_FAILED",
            message: `"${created.title}" was saved as Pending, but its file was not uploaded (${reason}) so it cannot be approved. Ask a moderator to remove it, then publish it again.`,
            field: "general",
          },
        };
      }
    },

    async updateBookDetails(publisher: AuthUser, bookId: string, input: UpdateBookInput): Promise<BookOperationResult<BookRecord>> {
      if (publisher.role !== "publisher") {
        return { success: false, error: { code: "FORBIDDEN_ROLE", message: "Only authenticated publishers can update book details.", field: "general" } };
      }
      try {
        await loadClassifications();
        const problems = validateUpdateBookInput(input, categories, genres);
        const firstField = Object.keys(problems)[0] as keyof typeof problems | undefined;
        if (firstField) {
          return { success: false, error: { code: "VALIDATION_ERROR", message: problems[firstField] ?? "Invalid metadata update.", field: firstField } };
        }
        const clientRevision = input.revision ?? (await api.getBook(bookId)).revision;
        const record = toBookRecord(await api.updateBook(bookId, {
          title: input.title.trim(),
          author: input.author.trim(),
          description: input.description.trim(),
          categoryIds: [input.categoryId],
          genreIds: [input.genreId],
          clientRevision,
          mutationId: crypto.randomUUID(),
        }));
        if (!record) return failure(new ContentApiError("BOOK_NOT_FOUND", "The requested book could not be found.", 404));
        return { success: true, data: record, message: `Book "${record.title}" details and classification updated.` };
      } catch (error) {
        return failure(error);
      }
    },

    async deleteOwnedBook() {
      return {
        success: false,
        error: { code: "NOT_SUPPORTED", message: "Books can be removed by moderators only. Contact a moderator to remove this book." },
      };
    },
  };
}
