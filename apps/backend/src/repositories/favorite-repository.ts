import type { Favorite } from "@library-flow/shared";

export interface FavoriteRepository {
  save(favorite: Favorite): Promise<Favorite>;
  findByReaderAndBook(readerUid: string, bookId: string): Promise<Favorite | null>;
  findByReaderId(readerUid: string): Promise<Favorite[]>;
  delete(readerUid: string, bookId: string): Promise<boolean>;
  clear(): void;
}

export class InMemoryFavoriteRepository implements FavoriteRepository {
  private favorites = new Map<string, Favorite>();

  async save(favorite: Favorite): Promise<Favorite> {
    const id = `${favorite.readerUid}_${favorite.bookId}`;
    const storedFavorite = { ...favorite, id };
    this.favorites.set(id, storedFavorite);
    return { ...storedFavorite };
  }

  async findByReaderAndBook(
    readerUid: string,
    bookId: string,
  ): Promise<Favorite | null> {
    const favorite = this.favorites.get(`${readerUid}_${bookId}`);
    return favorite ? { ...favorite } : null;
  }

  async findByReaderId(readerUid: string): Promise<Favorite[]> {
    return Array.from(this.favorites.values())
      .filter((favorite) => favorite.readerUid === readerUid)
      .map((favorite) => ({ ...favorite }));
  }

  async delete(readerUid: string, bookId: string): Promise<boolean> {
    return this.favorites.delete(`${readerUid}_${bookId}`);
  }

  clear(): void {
    this.favorites.clear();
  }
}

export const favoriteRepository: FavoriteRepository =
  new InMemoryFavoriteRepository();
