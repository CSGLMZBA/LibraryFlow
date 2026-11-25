/**
 * Book file upload and signed download rules (SPEC-002 §4.1, S2-T07).
 *
 * Authentication, account restriction, and the publisher role are checked by
 * the route guards before these methods run. This service checks ownership,
 * visibility, book state, revision, and input, in that order.
 */
import {
  BOOK_MAX_FILE_SIZE_BYTES,
  type Book,
  type BookFileDownloadUrlResponse,
  type BookFileType,
  type BookFileUploadUrlResponse,
} from "@library-flow/shared";
import {
  bookRepository as defaultBookRepository,
  type BookRepository,
} from "../repositories/book-repository.js";
import { RevisionConflictError } from "./book-service.js";
import {
  StorageUnavailableError,
  createBookFileStorageFromEnv,
  type BookFileStorage,
} from "./storage-service.js";
import {
  DeletionScheduleError,
  deletionJobService,
  type BookFileDeletionScheduler,
} from "./deletion-job-service.js";
import { publicContentVisibility, type PublicContentVisibility } from "./public-content-visibility.js";

/** Signed download URLs expire after at most 10 minutes (SPEC-002 §4). */
export const DOWNLOAD_URL_TTL_SECONDS = 600;
export const BOOK_FILE_NAME_MAX_LENGTH = 255;

export const BOOK_FILE_MIME_TYPES: Readonly<Record<BookFileType, string>> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
};

export type BookFileRequester = {
  uid: string;
  role: "reader" | "publisher" | "moderator";
};

/** A contract error with an HTTP status, error code, and optional field. */
export class BookFileError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly field: string | undefined;

  public constructor(status: number, code: string, message: string, field?: string) {
    super(message);
    this.name = "BookFileError";
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

function notFound(): BookFileError {
  return new BookFileError(404, "NOT_FOUND", "The book file was not found.");
}

function invalidField(field: string, message: string): BookFileError {
  return new BookFileError(400, "VALIDATION_ERROR", message, field);
}

function readObject(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BookFileError(400, "VALIDATION_ERROR", "The request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

function readRevision(body: Record<string, unknown>): number {
  const revision = body.revision;
  if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) {
    throw invalidField("revision", "Revision must be a non-negative integer.");
  }
  return revision;
}

function fileTypeFromName(fileName: string): BookFileType | null {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "pdf";
  if (lowerName.endsWith(".epub")) return "epub";
  return null;
}

/**
 * Keeps only [A-Za-z0-9._-], replaces other characters with "-", and keeps the
 * lowercase .pdf or .epub extension (SPEC-002 §4.1).
 */
export function sanitizeBookFileName(fileName: string, fileType: BookFileType): string {
  const extension = `.${fileType}`;
  const baseName = fileName.slice(0, fileName.length - extension.length);
  const safeBase = baseName
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
  return `${safeBase || "book"}${extension}`;
}

export class BookFileService {
  private readonly repository: BookRepository;
  private readonly storage: BookFileStorage | null;
  private readonly now: () => Date;
  private readonly deletions: BookFileDeletionScheduler;
  private readonly visible: PublicContentVisibility;

  public constructor(
    repository: BookRepository = defaultBookRepository,
    storage: BookFileStorage | null = createBookFileStorageFromEnv(),
    now: () => Date = () => new Date(),
    deletions: BookFileDeletionScheduler = deletionJobService,
    visible: PublicContentVisibility = publicContentVisibility,
  ) {
    this.repository = repository;
    this.storage = storage;
    this.now = now;
    this.deletions = deletions;
    this.visible = visible;
  }

  async createUploadUrl(
    bookId: string,
    requester: BookFileRequester,
    body: unknown,
  ): Promise<BookFileUploadUrlResponse> {
    const book = await this.requireOwnedPendingBook(bookId, requester);
    const input = readObject(body);
    this.requireRevision(book, readRevision(input));

    const { fileName, fileType, fileSizeBytes } = input;
    if (
      typeof fileName !== "string" ||
      fileName.trim().length === 0 ||
      fileName.length > BOOK_FILE_NAME_MAX_LENGTH ||
      fileName.includes("/") ||
      fileName.includes("\\")
    ) {
      throw invalidField("fileName", "File name must be 1 to 255 characters without slashes.");
    }
    if (fileType !== "pdf" && fileType !== "epub") {
      throw invalidField("fileType", "File type must be epub or pdf.");
    }
    if (fileTypeFromName(fileName) !== fileType) {
      throw invalidField("fileName", "File name extension must match the file type.");
    }
    if (
      typeof fileSizeBytes !== "number" ||
      !Number.isInteger(fileSizeBytes) ||
      fileSizeBytes < 1 ||
      fileSizeBytes > BOOK_MAX_FILE_SIZE_BYTES
    ) {
      throw invalidField("fileSizeBytes", "File size must be between 1 byte and 20 MB.");
    }

    const objectPath = `books/${book.id}/${book.revision}/${sanitizeBookFileName(fileName, fileType)}`;
    const uploadUrl = await this.requireStorage().createSignedUploadUrl(objectPath);
    return { objectPath, uploadUrl };
  }

  async completeUpload(
    bookId: string,
    requester: BookFileRequester,
    body: unknown,
  ): Promise<Book> {
    const book = await this.requireOwnedPendingBook(bookId, requester);
    const input = readObject(body);
    this.requireRevision(book, readRevision(input));

    const objectPath = input.objectPath;
    const expectedPrefix = `books/${book.id}/${book.revision}/`;
    if (
      typeof objectPath !== "string" ||
      !objectPath.startsWith(expectedPrefix) ||
      objectPath.slice(expectedPrefix.length).length === 0 ||
      objectPath.slice(expectedPrefix.length).includes("/") ||
      objectPath.includes("..")
    ) {
      throw invalidField("objectPath", "The object path does not belong to this book revision.");
    }

    const fileType = fileTypeFromName(objectPath);
    if (!fileType) {
      throw invalidField("objectPath", "The object path must end in .pdf or .epub.");
    }

    const storage = this.requireStorage();
    const info = await storage.getObjectInfo(objectPath);
    if (!info) {
      throw new BookFileError(409, "INVALID_STATE", "The file has not been uploaded yet.");
    }

    if (
      info.sizeBytes < 1 ||
      info.sizeBytes > BOOK_MAX_FILE_SIZE_BYTES ||
      info.mimeType !== BOOK_FILE_MIME_TYPES[fileType]
    ) {
      await storage.deleteObject(objectPath);
      throw invalidField("file", "The uploaded file must be an EPUB or PDF of at most 20 MB.");
    }

    const updated = await this.repository.update(book.id, {
      fileObjectPath: objectPath,
      fileSizeBytes: info.sizeBytes,
      fileType,
      revision: book.revision + 1,
      updatedAt: this.now().toISOString(),
    });
    if (!updated) {
      throw notFound();
    }
    // S2-T08: the replaced previous object is deleted immediately by the worker.
    const previousPath = book.fileObjectPath;
    if (previousPath && previousPath !== objectPath) {
      await this.deletions.scheduleDeletedBookFile(previousPath).catch((error: unknown) => {
        console.error(`[deletion-worker] Could not schedule cleanup of a replaced file for book ${book.id}: ${error instanceof Error ? error.name : typeof error}`);
        throw new DeletionScheduleError("replaced");
      });
    }
    return updated;
  }

  async createDownloadUrl(
    bookId: string,
    requester: BookFileRequester,
  ): Promise<BookFileDownloadUrlResponse> {
    const book = await this.repository.findById(bookId);
    if (!book || book.status === "deleted" || !book.fileObjectPath) {
      throw notFound();
    }

    const canRead =
      book.status === "approved" ||
      requester.role === "moderator" ||
      book.ownerId === requester.uid;
    if (!canRead) {
      throw notFound();
    }
    if (requester.role !== "moderator" && requester.uid !== book.ownerId && !await this.visible(book.ownerId)) {
      throw notFound();
    }

    const issuedAt = this.now();
    const downloadUrl = await this.requireStorage().createSignedDownloadUrl(
      book.fileObjectPath,
      DOWNLOAD_URL_TTL_SECONDS,
    );
    const expiresAt = new Date(issuedAt.getTime() + DOWNLOAD_URL_TTL_SECONDS * 1000);
    return { downloadUrl, expiresAt: expiresAt.toISOString() };
  }

  private async requireOwnedPendingBook(
    bookId: string,
    requester: BookFileRequester,
  ): Promise<Book> {
    const book = await this.repository.findById(bookId);
    if (!book || book.status === "deleted") {
      throw notFound();
    }
    if (book.ownerId !== requester.uid) {
      throw new BookFileError(403, "FORBIDDEN", "Only the owner publisher can upload this book file.");
    }
    if (book.status !== "pending") {
      throw new BookFileError(409, "INVALID_STATE", "A file can be uploaded only while the book is pending.");
    }
    return book;
  }

  private requireRevision(book: Book, revision: number): void {
    if (revision !== book.revision) {
      throw new RevisionConflictError(book.id, book.revision, book);
    }
  }

  private requireStorage(): BookFileStorage {
    if (!this.storage) {
      throw new StorageUnavailableError("not-configured");
    }
    return this.storage;
  }
}

export const bookFileService = new BookFileService();
