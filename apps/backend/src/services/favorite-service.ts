import type { Favorite } from "@library-flow/shared";
import {
  favoriteRepository,
  type FavoriteRepository,
} from "../repositories/favorite-repository.js";
import {
  bookRepository,
  type BookRepository,
} from "../repositories/book-repository.js";

export class FavoriteService {
  constructor(
    private readonly repository: FavoriteRepository = favoriteRepository,
    private readonly bookRepo: BookRepository = bookRepository,
  ) {}

  async addFavorite(readerUid: string, bookId: string): Promise<Favorite> {
    if (!readerUid?.trim() || !bookId?.trim()) {
      throw new Error("Validation error: readerUid and bookId are required.");
    }

    const book = await this.bookRepo.findById(bookId);
    if (!book || book.status !== "approved") {
      throw new Error("Book not found or not available.");
    }

    const existing = await this.repository.findByReaderAndBook(
      readerUid,
      bookId,
    );
    if (existing) {
      return existing;
    }

    const newFavorite: Favorite = {
      id: `${readerUid}_${bookId}`,
      readerUid,
      bookId,
      createdAt: new Date().toISOString(),
    };
    return this.repository.save(newFavorite);
  }

  async removeFavorite(readerUid: string, bookId: string): Promise<boolean> {
    if (!readerUid?.trim() || !bookId?.trim()) {
      throw new Error("Validation error: readerUid and bookId are required.");
    }
    return this.repository.delete(readerUid, bookId);
  }

  async getFavorites(readerUid: string): Promise<Favorite[]> {
    if (!readerUid?.trim()) {
      throw new Error("Validation error: readerUid is required.");
    }

    const favorites = await this.repository.findByReaderId(readerUid);
    const availableFavorites = await Promise.all(
      favorites.map(async (favorite) => {
        const book = await this.bookRepo.findById(favorite.bookId);
        return book?.status === "approved" ? favorite : null;
      }),
    );
    return availableFavorites.filter(
      (favorite): favorite is Favorite => favorite !== null,
    );
  }
}

export const favoriteService = new FavoriteService();
