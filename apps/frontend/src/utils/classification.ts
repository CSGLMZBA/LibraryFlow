import type { BookGenre } from "../types/book";

/** Cloud genres are not tied to a category (empty categoryId), so they apply to every category. */
export function genreMatchesCategory(genre: BookGenre, categoryId: string): boolean {
  return genre.categoryId === "" || genre.categoryId === categoryId;
}
