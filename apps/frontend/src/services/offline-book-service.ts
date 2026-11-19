import { bookRepository } from "../repositories/book-repository";
import type { AllowedBookFileFormat, BookRecord } from "../types/book";

export type DownloadState = "Not Started" | "In Progress" | "Completed" | "Failed";

export interface OfflineBook {
  id: string;
  title: string;
  author: string;
  fileName: string;
  fileFormat: AllowedBookFileFormat;
  fileBlob: Blob;
  downloadedAt: string;
}

const OFFLINE_DB = "LibraryFlowOfflineDB";
const OFFLINE_STORE = "offlineBooks";
const MAX_FILE_SIZE = 20 * 1024 * 1024;

function openOfflineDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
        db.createObjectStore(OFFLINE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the offline library."));
  });
}

export async function listOfflineBookIds(): Promise<string[]> {
  const db = await openOfflineDatabase();
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const request = db.transaction(OFFLINE_STORE, "readonly")
        .objectStore(OFFLINE_STORE).getAllKeys();
      request.onsuccess = () => resolve(request.result.map(String));
      request.onerror = () => reject(request.error ?? new Error("Could not retrieve downloads."));
    });
  } finally {
    db.close();
  }
}

export async function getOfflineBook(bookId: string): Promise<OfflineBook | null> {
  const db = await openOfflineDatabase();
  try {
    return await new Promise<OfflineBook | null>((resolve, reject) => {
      const request = db.transaction(OFFLINE_STORE, "readonly")
        .objectStore(OFFLINE_STORE).get(bookId);
      request.onsuccess = () => resolve((request.result as OfflineBook | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Could not read the offline book."));
    });
  } finally {
    db.close();
  }
}

/**
 * Local mode: the original file must exist in LibraryFlowDB in this browser.
 * Cloud mode must replace the source lookup with an authorized endpoint.
 * Completed is set only after the IndexedDB transaction completes.
 */
export async function downloadBookForOffline(book: BookRecord): Promise<void> {
  if (book.status !== "approved") {
    throw new Error("Only approved books can be downloaded.");
  }

  const stored = await bookRepository.getStoredEntryById(book.id);
  if (!stored || stored.status !== "approved" || !(stored.fileBlob instanceof Blob)) {
    throw new Error("The file is unavailable in this browser. Download it from the server.");
  }
  if (stored.fileBlob.size === 0 || stored.fileBlob.size > MAX_FILE_SIZE) {
    throw new Error("The file is empty or exceeds the 20 MB limit.");
  }
  if (stored.fileFormat !== "pdf" && stored.fileFormat !== "epub") {
    throw new Error("Unsupported format. Only PDF or EPUB is allowed.");
  }

  const offlineCopy: OfflineBook = {
    id: stored.id,
    title: stored.title,
    author: stored.author,
    fileName: stored.fileName,
    fileFormat: stored.fileFormat,
    fileBlob: stored.fileBlob,
    downloadedAt: new Date().toISOString(),
  };

  const db = await openOfflineDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(OFFLINE_STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("Could not complete the offline download."));
      tx.onerror = () => reject(tx.error ?? new Error("Could not save the offline book."));
      tx.objectStore(OFFLINE_STORE).put(offlineCopy);
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new Error("Not enough browser storage. Free space and try again.");
    }
    throw error;
  } finally {
    db.close();
  }
}
