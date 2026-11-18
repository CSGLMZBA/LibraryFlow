import type { BookComment } from "@library-flow/shared";

const DB_NAME = "LibraryFlowDB";
const DB_VERSION = 2;
const BOOKS_STORE = "books";
const COMMENTS_STORE = "comments";

function openLibraryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        const bookStore = db.createObjectStore(BOOKS_STORE, { keyPath: "id" });
        bookStore.createIndex("ownerId", "ownerId", { unique: false });
        bookStore.createIndex("status", "status", { unique: false });
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

export const commentRepository = {
  async getCommentsByBookId(bookId: string): Promise<BookComment[]> {
    const db = await openLibraryDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(COMMENTS_STORE, "readonly");
      const store = tx.objectStore(COMMENTS_STORE);
      const index = store.index("bookId");
      const request = index.getAll(IDBKeyRange.only(bookId));

      request.onsuccess = () => {
        const allForBook = (request.result as BookComment[]) ?? [];
        // CA-004: Exclude comments soft-deleted by a moderator (US-MOD-003)
        const visibleComments = allForBook
          .filter((comment) => !comment.isDeleted)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        resolve(visibleComments);
      };
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to load book comments from IndexedDB."));
    });
  },

  async saveComment(comment: BookComment): Promise<BookComment> {
    const db = await openLibraryDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(COMMENTS_STORE, "readwrite");
      const store = tx.objectStore(COMMENTS_STORE);
      const request = store.put(comment);

      request.onsuccess = () => resolve(comment);
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to save comment to IndexedDB."));
    });
  },
};