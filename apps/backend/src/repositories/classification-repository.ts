import type { Category, Genre } from "@library-flow/shared";

const initialCategories: Category[] = [
  { id: "category-fiction", name: "Fiction" },
  { id: "category-non-fiction", name: "Non-Fiction" },
  { id: "category-science", name: "Science" },
  { id: "category-history", name: "History" },
];

const initialGenres: Genre[] = [
  { id: "genre-novel", name: "Novel" },
  { id: "genre-essay", name: "Essay" },
  { id: "genre-sci-fi", name: "Sci-Fi" },
  { id: "genre-biography", name: "Biography" },
];

export class ClassificationRepository {
  private readonly categories = new Map(
    initialCategories.map((category) => [category.id, category]),
  );
  private readonly genres = new Map(
    initialGenres.map((genre) => [genre.id, genre]),
  );

  getCategories(): Category[] {
    return Array.from(this.categories.values()).map((category) => ({
      ...category,
    }));
  }

  getGenres(): Genre[] {
    return Array.from(this.genres.values()).map((genre) => ({ ...genre }));
  }

  findCategoryById(id: string): Category | null {
    const category = this.categories.get(id);
    return category ? { ...category } : null;
  }

  findGenreById(id: string): Genre | null {
    const genre = this.genres.get(id);
    return genre ? { ...genre } : null;
  }

  createCategory(name: string): Category {
    const category = { id: `category-${crypto.randomUUID()}`, name };
    this.categories.set(category.id, category);
    return { ...category };
  }

  createGenre(name: string): Genre {
    const genre = { id: `genre-${crypto.randomUUID()}`, name };
    this.genres.set(genre.id, genre);
    return { ...genre };
  }

  updateCategory(id: string, name: string): Category | null {
    const category = this.categories.get(id);
    if (!category) {
      return null;
    }

    const updatedCategory = { ...category, name };
    this.categories.set(id, updatedCategory);
    return { ...updatedCategory };
  }

  updateGenre(id: string, name: string): Genre | null {
    const genre = this.genres.get(id);
    if (!genre) {
      return null;
    }

    const updatedGenre = { ...genre, name };
    this.genres.set(id, updatedGenre);
    return { ...updatedGenre };
  }
}

export const classificationRepository = new ClassificationRepository();
