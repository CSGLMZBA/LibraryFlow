import { bookRepository } from "../repositories/book-repository";
import { CLOUD_CONTENT } from "../utils/content-mode";
import type { AllowedBookFileFormat, BookRecord } from "../types/book";
import { cloudContentApi } from "./cloud-content-api";

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

export interface OfflineSource {
  fileBlob: Blob;
  fileName: string;
  fileFormat: AllowedBookFileFormat;
}

/** Cloud mode: a short-lived signed URL is requested for the authorized reader, then the file is fetched. */
async function loadCloudSource(book: BookRecord): Promise<OfflineSource> {
  const { downloadUrl } = await cloudContentApi.requestDownloadUrl(book.id);
  return {
    fileBlob: await cloudContentApi.fetchSignedFile(downloadUrl),
    fileName: book.fileName,
    fileFormat: book.fileFormat,
  };
}

/** Local mode: the original file must exist in LibraryFlowDB in this browser. */
async function loadLocalSource(book: BookRecord): Promise<OfflineSource> {
  const stored = await bookRepository.getStoredEntryById(book.id);
  if (!stored || stored.status !== "approved" || !(stored.fileBlob instanceof Blob)) {
    throw new Error("The file is unavailable in this browser. Download it from the server.");
  }
  return { fileBlob: stored.fileBlob, fileName: stored.fileName, fileFormat: stored.fileFormat };
}

/**
 * Completed is set only after the IndexedDB transaction completes.
 * The source is injectable so both modes share the same validation and storage.
 */
export async function downloadBookForOffline(
  book: BookRecord,
  loadSource: (book: BookRecord) => Promise<OfflineSource> = CLOUD_CONTENT ? loadCloudSource : loadLocalSource,
): Promise<void> {
  if (book.status !== "approved") {
    throw new Error("Only approved books can be downloaded.");
  }

  const source = await loadSource(book);
  if (!(source.fileBlob instanceof Blob) || source.fileBlob.size === 0 || source.fileBlob.size > MAX_FILE_SIZE) {
    throw new Error("The file is empty or exceeds the 20 MB limit.");
  }
  if (source.fileFormat !== "pdf" && source.fileFormat !== "epub") {
    throw new Error("Unsupported format. Only PDF or EPUB is allowed.");
  }

  const offlineCopy: OfflineBook = {
    id: book.id,
    title: book.title,
    author: book.author,
    fileName: source.fileName,
    fileFormat: source.fileFormat,
    fileBlob: source.fileBlob,
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
