
import type {
  PublisherApplication,
  PublisherApplicationStatus,
} from "@library-flow/shared";

// Store only the fields needed for an offline status summary.
export type CachedReaderApplication = Pick<
  PublisherApplication,
  | "id"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "expiresAt"
  | "revision"
>;

export interface ReaderApplicationSnapshot {
  userId: string;
  savedAt: string;
  applications: CachedReaderApplication[];
}

const DB_NAME = "LibraryFlowReaderApplicationCache";
const STORE_NAME = "applicationSnapshots";
const DB_VERSION = 1;

const VALID_STATUSES: PublisherApplicationStatus[] = [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
  "expired",
];

// Open IndexedDB without crashing when storage is unavailable.
function openCacheDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, {
            keyPath: "userId",
          });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// Validate stored data before displaying it.
function isValidSnapshot(
  value: unknown,
  userId: string,
): value is ReaderApplicationSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<ReaderApplicationSnapshot>;

  return (
    record.userId === userId &&
    typeof record.savedAt === "string" &&
    Number.isFinite(Date.parse(record.savedAt)) &&
    Array.isArray(record.applications) &&
    record.applications.every((application) => {
      if (!application || typeof application !== "object") {
        return false;
      }

      return (
        typeof application.id === "string" &&
        VALID_STATUSES.includes(application.status) &&
        typeof application.createdAt === "string" &&
        typeof application.updatedAt === "string" &&
        typeof application.expiresAt === "string" &&
        Number.isInteger(application.revision) &&
        application.revision > 0
      );
    })
  );
}

// Retrieve the last saved status for one authenticated reader.
export async function getReaderApplicationCache(
  userId: string,
): Promise<ReaderApplicationSnapshot | null> {
  if (!userId) {
    return null;
  }

  const db = await openCacheDatabase();

  if (!db) {
    return null;
  }

  try {
    return await new Promise((resolve) => {
      const transaction = db.transaction(
        STORE_NAME,
        "readonly",
      );

      const request = transaction
        .objectStore(STORE_NAME)
        .get(userId);

      request.onsuccess = () => {
        const value: unknown = request.result;

        resolve(
          isValidSnapshot(value, userId) ? value : null,
        );
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db.close();
  }
}

// Save a minimal summary after a successful authenticated API read.
export async function saveReaderApplicationCache(
  userId: string,
  applications: PublisherApplication[],
): Promise<boolean> {
  if (
    !userId ||
    applications.some(
      (application) =>
        application.applicantUid !== userId ||
        !application.id ||
        !VALID_STATUSES.includes(application.status) ||
        !Number.isInteger(application.revision) ||
        application.revision <= 0,
    )
  ) {
    return false;
  }

  const snapshot: ReaderApplicationSnapshot = {
    userId,
    savedAt: new Date().toISOString(),
    applications: applications.map((application) => ({
      id: application.id,
      status: application.status,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      expiresAt: application.expiresAt,
      revision: application.revision,
    })),
  };

  const db = await openCacheDatabase();

  if (!db) {
    return false;
  }

  try {
    return await new Promise((resolve) => {
      const transaction = db.transaction(
        STORE_NAME,
        "readwrite",
      );

      transaction.objectStore(STORE_NAME).put(snapshot);

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    });
  } catch {
    return false;
  } finally {
    db.close();
  }
}

// Remove saved data when a reader logs out.
export async function clearReaderApplicationCache(
  userId: string,
): Promise<void> {
  if (!userId) {
    return;
  }

  const db = await openCacheDatabase();

  if (!db) {
    return;
  }

  try {
    await new Promise<void>((resolve) => {
      const transaction = db.transaction(
        STORE_NAME,
        "readwrite",
      );

      transaction.objectStore(STORE_NAME).delete(userId);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  } catch {
    // Cache cleanup must not crash the application.
  } finally {
    db.close();
  }
}
