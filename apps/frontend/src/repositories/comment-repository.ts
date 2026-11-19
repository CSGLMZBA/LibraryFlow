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
  async getAllComments(): Promise<BookComment[]> {
    const db = await openLibraryDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(COMMENTS_STORE, "readonly");
      const request = tx.objectStore(COMMENTS_STORE).getAll();
      request.onsuccess = () => resolve((request.result as BookComment[]) ?? []);
      request.onerror = () =>
        reject(request.error ?? new Error("Failed to load comments from IndexedDB."));
    });
  },

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
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

  async moderateComment(commentId: string, moderatorId: string, reason: string): Promise<BookComment | null> {
    const db = await openLibraryDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(COMMENTS_STORE, "readwrite");
      const store = tx.objectStore(COMMENTS_STORE);
      const getRequest = store.get(commentId);
      getRequest.onerror = () =>
        reject(getRequest.error ?? new Error("Failed to load the comment."));
      getRequest.onsuccess = () => {
        const existing = getRequest.result as BookComment | undefined;
        if (!existing) {
          resolve(null);
          return;
        }
        const moderated: BookComment = {
          ...existing,
          isDeleted: true,
          moderationReason: reason,
          moderatedBy: moderatorId,
          moderatedAt: new Date().toISOString(),
        };
        const putRequest = store.put(moderated);
        putRequest.onsuccess = () => resolve(moderated);
        putRequest.onerror = () =>
          reject(putRequest.error ?? new Error("Failed to moderate the comment."));
      };
    });
  },
};