import type { BookCategory, BookGenre, BookRecord, StoredBookEntry } from "../types/book";

const DB_NAME = "LibraryFlowDB";
const DB_VERSION = 2;
const BOOKS_STORE = "books";
const COMMENTS_STORE = "comments";

export const SEEDED_CATEGORIES: BookCategory[] = [
  { id: "cat-fiction", name: "Fiction" },
  { id: "cat-non-fiction", name: "Non-Fiction" },
  { id: "cat-science-tech", name: "Science & Technology" },
  { id: "cat-academic", name: "Academic & Reference" },
];

export const SEEDED_GENRES: BookGenre[] = [
  { id: "gen-sci-fi", name: "Science Fiction", categoryId: "cat-fiction" },
  { id: "gen-fantasy", name: "Fantasy", categoryId: "cat-fiction" },
  { id: "gen-mystery", name: "Mystery & Thriller", categoryId: "cat-fiction" },
  { id: "gen-biography", name: "Biography & Memoir", categoryId: "cat-non-fiction" },
  { id: "gen-history", name: "History", categoryId: "cat-non-fiction" },
  { id: "gen-software-eng", name: "Software Engineering", categoryId: "cat-science-tech" },
  { id: "gen-networking", name: "Networks & Security", categoryId: "cat-science-tech" },
  { id: "gen-mathematics", name: "Mathematics", categoryId: "cat-academic" },
];

function openLibraryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        const store = db.createObjectStore(BOOKS_STORE, { keyPath: "id" });
        store.createIndex("ownerId", "ownerId", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }
      if (!db.objectStoreNames.contains(COMMENTS_STORE)) {
        const commentStore = db.createObjectStore(COMMENTS_STORE, { keyPath: "id" });
        commentStore.createIndex("bookId", "bookId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB database."));
  });
}

function stripFileBlob(entry: StoredBookEntry): BookRecord {
  const { fileBlob: _ignored, ...metadata } = entry;
  return metadata;
}

export const bookRepository = {
  getCategories(): BookCategory[] {
    return SEEDED_CATEGORIES;
  },

  getGenres(): BookGenre[] {
    return SEEDED_GENRES;
  },

  async getAllBooks(): Promise<BookRecord[]> {
    const db = await openLibraryDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKS_STORE, "readonly");
      const store = tx.objectStore(BOOKS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = (request.result as StoredBookEntry[]) ?? [];
        resolve(entries.map(stripFileBlob));
      };
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to read books from IndexedDB."));
    });
  },

  async getBooksByOwner(ownerId: string): Promise<BookRecord[]> {
    const all = await this.getAllBooks();
    return all
      .filter((book) => book.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getStoredEntryById(bookId: string): Promise<StoredBookEntry | null> {
    const db = await openLibraryDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKS_STORE, "readonly");
      const store = tx.objectStore(BOOKS_STORE);
      const request = store.get(bookId);

      request.onsuccess = () => {
        resolve((request.result as StoredBookEntry | undefined) ?? null);
      };
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to load book entry from IndexedDB."));
    });
  },

  async saveBookEntry(entry: StoredBookEntry): Promise<BookRecord> {
    const db = await openLibraryDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKS_STORE, "readwrite");
      const store = tx.objectStore(BOOKS_STORE);
      const request = store.put(entry);

      request.onsuccess = () => resolve(stripFileBlob(entry));
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to save book entry to IndexedDB."));
    });
  },

  async deleteBookById(bookId: string): Promise<void> {
    const db = await openLibraryDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(BOOKS_STORE, "readwrite");
      const store = tx.objectStore(BOOKS_STORE);
      const request = store.delete(bookId);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to delete book from IndexedDB."));
    });
  },
};