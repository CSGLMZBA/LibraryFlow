import type { Book, BookFilterQuery } from "@library-flow/shared";

type MetadataUpdateResult =
  | { kind: "updated"; book: Book }
  | { kind: "conflict"; book: Book }
  | { kind: "not_found" }
  | { kind: "forbidden" };

export class BookRepository {
  private readonly restrictedOwners = new Set<string>();
  private readonly books = new Map<string, Book>();
  private readonly processedMetadataMutations = new Map<string, Book>();

  async save(book: Book): Promise<Book> {
    const storedBook = this.clone(book);
    this.books.set(storedBook.id, storedBook);
    return this.clone(storedBook);
  }

  async findById(id: string): Promise<Book | null> {
    const book = this.books.get(id);
    return book && !this.restrictedOwners.has(book.ownerId) ? this.clone(book) : null;
  }

  async findApproved(filters?: BookFilterQuery): Promise<Book[]> {
    const normalizedSearch = filters?.search?.trim().toLocaleLowerCase();

    return Array.from(this.books.values())
      .filter((book) => book.status === "approved" && !this.restrictedOwners.has(book.ownerId))
      .filter((book) => {
        if (!normalizedSearch) {
          return true;
        }

        return (
          book.title.toLocaleLowerCase().includes(normalizedSearch) ||
          book.author.toLocaleLowerCase().includes(normalizedSearch)
        );
      })
      .filter((book) =>
        filters?.categoryId
          ? book.categoryIds.includes(filters.categoryId)
          : true,
      )
      .filter((book) =>
        filters?.genreId ? book.genreIds.includes(filters.genreId) : true,
      )
      .map((book) => this.clone(book));
  }

  async findByOwner(ownerId: string): Promise<Book[]> {
    return Array.from(this.books.values())
      .filter((book) => book.ownerId === ownerId)
      .map((book) => this.clone(book));
  }

  async findPending(): Promise<Book[]> {
    return Array.from(this.books.values())
      .filter((book) => book.status === "pending" && !this.restrictedOwners.has(book.ownerId))
      .map((book) => this.clone(book));
  }

  async update(id: string, updates: Partial<Book>): Promise<Book | null> {
    const currentBook = this.books.get(id);
    if (!currentBook) {
      return null;
    }

    if (updates.id !== undefined && updates.id !== id) {
      throw new Error("Book ID cannot be changed.");
    }

    if (
      updates.ownerId !== undefined &&
      updates.ownerId !== currentBook.ownerId
    ) {
      throw new Error("Book owner cannot be changed.");
    }

    const updatedBook = this.clone({
      ...currentBook,
      ...updates,
      id: currentBook.id,
      ownerId: currentBook.ownerId,
    });
    this.books.set(id, updatedBook);
    return this.clone(updatedBook);
  }

  async updateMetadata(
    id: string,
    requesterId: string,
    isModerator: boolean,
    clientRevision: number | undefined,
    mutationId: string | undefined,
    prepareUpdates: () => Pick<Partial<Book>, "title" | "author" | "categoryIds" | "genreIds">,
    updatedAt: string,
  ): Promise<MetadataUpdateResult> {
    const currentBook = this.books.get(id);
    if (!currentBook || this.restrictedOwners.has(currentBook.ownerId)) {
      return { kind: "not_found" };
    }
    if (!isModerator && currentBook.ownerId !== requesterId) {
      return { kind: "forbidden" };
    }

    const key = mutationId ? JSON.stringify([requesterId, id, mutationId]) : undefined;
    const cached = key ? this.processedMetadataMutations.get(key) : undefined;
    if (cached) return { kind: "updated", book: this.clone(cached) };
    if (clientRevision !== undefined && currentBook.revision !== clientRevision) {
      return { kind: "conflict", book: this.clone(currentBook) };
    }

    const updatedBook = this.clone({
      ...currentBook,
      ...prepareUpdates(),
      revision: currentBook.revision + 1,
      updatedAt,
    });
    this.books.set(id, updatedBook);
    if (key) this.processedMetadataMutations.set(key, this.clone(updatedBook));
    return { kind: "updated", book: this.clone(updatedBook) };
  }

  async redactOwner(uid: string): Promise<void> {
    this.restrictedOwners.add(uid);
    for (const [id, book] of this.books) {
      if (book.ownerId === uid) this.books.set(id, {...book, author: 'Deleted user', status: 'pending'});
    }
  }

  private clone(book: Book): Book {
    return {
      ...book,
      categoryIds: [...book.categoryIds],
      genreIds: [...book.genreIds],
    };
  }
}

export const bookRepository = new BookRepository();
