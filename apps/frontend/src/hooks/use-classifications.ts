import { useEffect, useState } from "react";
import { bookService } from "../services/book-service";
import type { BookCategory, BookGenre } from "../types/book";

export interface ClassificationState {
  categories: BookCategory[];
  genres: BookGenre[];
  loading: boolean;
  error: string | null;
}

/** Categories and genres for the forms and filters; loaded from the server first in cloud mode. */
export function useClassifications(): ClassificationState {
  const [state, setState] = useState<ClassificationState>(() => {
    const categories = bookService.getAvailableCategories();
    return { categories, genres: bookService.getAvailableGenres(), loading: categories.length === 0, error: null };
  });

  useEffect(() => {
    let active = true;
    bookService.loadClassifications().then(
      ({ categories, genres }) => {
        if (active) setState({ categories, genres, loading: false, error: null });
      },
      () => {
        if (active) {
          setState((previous) => ({ ...previous, loading: false, error: "Could not load categories and genres. Reload the page to try again." }));
        }
      },
    );
    return () => { active = false; };
  }, []);

  return state;
}
