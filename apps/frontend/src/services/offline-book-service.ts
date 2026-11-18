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
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir la biblioteca offline."));
  });
}

export async function listOfflineBookIds(): Promise<string[]> {
  const db = await openOfflineDatabase();
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const request = db.transaction(OFFLINE_STORE, "readonly")
        .objectStore(OFFLINE_STORE).getAllKeys();
      request.onsuccess = () => resolve(request.result.map(String));
      request.onerror = () => reject(request.error ?? new Error("No se pudieron consultar las descargas."));
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
      request.onerror = () => reject(request.error ?? new Error("No se pudo leer el libro offline."));
    });
  } finally {
    db.close();
  }
}

/**
 * Versión local: el archivo original debe existir en LibraryFlowDB en este navegador.
 * En modo nube debe sustituirse la lectura de origen por un endpoint autorizado.
 * El estado Completed solo se asigna tras completarse la transacción IndexedDB.
 */
export async function downloadBookForOffline(book: BookRecord): Promise<void> {
  if (book.status !== "approved") {
    throw new Error("Solo se pueden descargar libros aprobados.");
  }

  const stored = await bookRepository.getStoredEntryById(book.id);
  if (!stored || stored.status !== "approved" || !(stored.fileBlob instanceof Blob)) {
    throw new Error("El archivo no está disponible en este navegador. Se necesita la descarga desde el servidor.");
  }
  if (stored.fileBlob.size === 0 || stored.fileBlob.size > MAX_FILE_SIZE) {
    throw new Error("El archivo está vacío o supera los 20 MB permitidos.");
  }
  if (stored.fileFormat !== "pdf" && stored.fileFormat !== "epub") {
    throw new Error("Formato no compatible. Solo PDF o EPUB.");
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
      tx.onabort = () => reject(tx.error ?? new Error("No se pudo completar la descarga offline."));
      tx.onerror = () => reject(tx.error ?? new Error("Error al guardar el libro offline."));
      tx.objectStore(OFFLINE_STORE).put(offlineCopy);
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new Error("No hay espacio suficiente en el navegador. Libera almacenamiento e inténtalo de nuevo.");
    }
    throw error;
  } finally {
    db.close();
  }
}
