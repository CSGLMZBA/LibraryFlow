import type { Book, BookFilterQuery } from "@library-flow/shared";

export class BookRepository {
  private readonly books = new Map<string, Book>();

  async save(book: Book): Promise<Book> {
    const storedBook = this.clone(book);
    this.books.set(storedBook.id, storedBook);
    return this.clone(storedBook);
  }

  async findById(id: string): Promise<Book | null> {
    const book = this.books.get(id);
    return book ? this.clone(book) : null;
  }

  async findApproved(filters?: BookFilterQuery): Promise<Book[]> {
    const normalizedSearch = filters?.search?.trim().toLocaleLowerCase();

    return Array.from(this.books.values())
      .filter((book) => book.status === "approved")
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
      .filter((book) => book.status === "pending")
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

  private clone(book: Book): Book {
    return {
      ...book,
      categoryIds: [...book.categoryIds],
      genreIds: [...book.genreIds],
    };
  }
}

export const bookRepository = new BookRepository();
