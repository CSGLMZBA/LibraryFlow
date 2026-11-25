import {
  BOOK_AUTHOR_MAX_LENGTH,
  BOOK_MAX_FILE_SIZE_BYTES,
  BOOK_TITLE_MAX_LENGTH,
} from "@library-flow/shared";
import type {
  Book,
  BookFilterQuery,
  CreateBookDto,
  UpdateBookMetadataDto,
} from "@library-flow/shared";
import {
  bookRepository as defaultBookRepository,
  BookRepository,
} from "../repositories/book-repository.js";
import {
  DeletionScheduleError,
  deletionJobService,
  type BookFileDeletionScheduler,
} from "./deletion-job-service.js";

export class RevisionConflictError extends Error {
  public constructor(
    public readonly resourceId: string,
    public readonly serverRevision: number,
    public readonly serverValue: unknown,
  ) {
    super("The record changed. Reload it before retrying.");
    this.name = "RevisionConflictError";
  }
}

export class BookService {
  private readonly processedMutations = new Map<string, Book>();

  public constructor(
    private readonly repository: BookRepository = defaultBookRepository,
    private readonly deletions: BookFileDeletionScheduler = deletionJobService,
  ) {}

  async createBook(dto: CreateBookDto, ownerId: string): Promise<Book> {
    const title = this.validateText(
      dto.title,
      "title",
      BOOK_TITLE_MAX_LENGTH,
    );
    const author = this.validateText(
      dto.author,
      "author",
      BOOK_AUTHOR_MAX_LENGTH,
    );

    if (dto.fileType !== "epub" && dto.fileType !== "pdf") {
      throw new Error("Book file type must be epub or pdf.");
    }

    if (
      !Number.isInteger(dto.fileSizeBytes) ||
      dto.fileSizeBytes < 0 ||
      dto.fileSizeBytes > BOOK_MAX_FILE_SIZE_BYTES
    ) {
      throw new Error(
        `Book file size must be between 0 and ${BOOK_MAX_FILE_SIZE_BYTES} bytes.`,
      );
    }

    if (!ownerId.trim()) {
      throw new Error("Book owner is required.");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const book: Book = {
      id,
      title,
      author,
      ownerId,
      status: "pending",
      accessKey: crypto.randomUUID(),
      shareableUrl: `/books/${id}`,
      fileUrl: "",
      fileType: dto.fileType,
      fileSizeBytes: dto.fileSizeBytes,
      categoryIds: [...dto.categoryIds],
      genreIds: [...dto.genreIds],
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };

    return this.repository.save(book);
  }

  async getApprovedCatalog(filters?: BookFilterQuery): Promise<Book[]> {
    return this.repository.findApproved(filters);
  }

  async getBookDetails(
    id: string,
    requesterId?: string,
    isModerator = false,
  ): Promise<Book> {
    const book = await this.repository.findById(id);
    if (!book) {
      throw new Error("Book not found.");
    }

    if (
      book.status === "approved" ||
      isModerator ||
      book.ownerId === requesterId
    ) {
      return book;
    }

    throw new Error("You are not authorized to view this book.");
  }

  async updateBookMetadata(
    id: string,
    dto: UpdateBookMetadataDto,
    requesterId: string,
    isModerator = false,
  ): Promise<Book> {
    if (dto.mutationId) {
      const cachedResult = this.processedMutations.get(dto.mutationId);
      if (cachedResult) {
        return cachedResult;
      }
    }

    const book = await this.repository.findById(id);
    if (!book) {
      throw new Error("Book not found.");
    }

    if (!isModerator && book.ownerId !== requesterId) {
      throw new Error("You are not authorized to update this book.");
    }

    if (
      dto.clientRevision !== undefined &&
      book.revision !== dto.clientRevision
    ) {
      throw new RevisionConflictError(book.id, book.revision, book);
    }

    const updates: Partial<Book> = {};
    if (dto.title !== undefined) {
      updates.title = this.validateText(
        dto.title,
        "title",
        BOOK_TITLE_MAX_LENGTH,
      );
    }
    if (dto.author !== undefined) {
      updates.author = this.validateText(
        dto.author,
        "author",
        BOOK_AUTHOR_MAX_LENGTH,
      );
    }
    if (dto.categoryIds !== undefined) {
      updates.categoryIds = [...dto.categoryIds];
    }
    if (dto.genreIds !== undefined) {
      updates.genreIds = [...dto.genreIds];
    }

    updates.updatedAt = new Date().toISOString();
    updates.revision = book.revision + 1;
    const updatedBook = await this.repository.update(id, updates);
    if (!updatedBook) {
      throw new Error("Book could not be updated.");
    }
    if (dto.mutationId) {
      this.processedMutations.set(dto.mutationId, updatedBook);
    }
    return updatedBook;
  }

  async deleteBook(id: string, _moderatorUid: string): Promise<Book> {
    const book = await this.repository.findById(id);
    if (!book) {
      throw new Error("Book not found.");
    }

    const updatedBook = await this.repository.update(id, {
      status: "deleted",
      revision: book.revision + 1,
      updatedAt: new Date().toISOString(),
    });
    if (!updatedBook) {
      throw new Error("Book could not be deleted.");
    }
    // S2-T08: delete the stored file immediately (idempotent; retried by deleting again).
    if (book.fileObjectPath) {
      await this.deletions.scheduleDeletedBookFile(book.fileObjectPath).catch((error: unknown) => {
        console.error(`[deletion-worker] Could not schedule file cleanup for book ${id}: ${error instanceof Error ? error.name : typeof error}`);
        throw new DeletionScheduleError("deleted");
      });
    }
    return updatedBook;
  }

  private validateText(value: string, field: string, maxLength: number): string {
    const normalizedValue = value.trim();
    if (
      normalizedValue.length === 0 ||
      normalizedValue.length > maxLength
    ) {
      throw new Error(
        `${field} must contain between 1 and ${maxLength} characters.`,
      );
    }
    return normalizedValue;
  }
}

export const bookService = new BookService();
