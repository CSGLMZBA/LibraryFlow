import type { BookRecord } from "../types/book";

export interface CatalogFilters {
  search: string;
  categoryId: string;
  genreId: string;
}

// Match text, category, and genre together; never return unapproved books.
export function filterCatalogBooks(books: BookRecord[], filters: CatalogFilters): BookRecord[] {
  const query = filters.search.trim().toLocaleLowerCase();
  return books.filter((book) =>
    book.status === "approved" &&
    (!query || [book.title, book.author, book.ownerDisplayName]
      .some((field) => field.toLocaleLowerCase().includes(query))) &&
    (!filters.categoryId || book.categoryId === filters.categoryId) &&
    (!filters.genreId || book.genreId === filters.genreId)
  );
}
