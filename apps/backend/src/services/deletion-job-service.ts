/**
 * Deletion job scheduling and worker (SPEC-002 §5 and §5.1, S2-T08).
 *
 * - A rejected book's file is deleted 24 hours after rejection.
 * - A deleted book's file, and a file replaced by a new upload, are deleted
 *   immediately.
 * - The worker claims due jobs one at a time in a transaction, deletes the
 *   object, and records the result. Completed jobs are never processed again.
 * - Failures keep the job, store a safe error, and retry with exponential
 *   backoff, up to MAX_ATTEMPTS. A job left in `processing` by a crashed run is
 *   reclaimed after STALE_CLAIM_MS. Deleting an object that is already gone
 *   succeeds, so a reclaimed job is safe to repeat.
 * - `account-data` jobs (created by S2-T06) are not processed yet: their scope
 *   is pending team agreement. They stay `pending` and untouched, so account
 *   restoration keeps working.
 */
import { createHash } from "node:crypto";
import {
  deletionJobStore as defaultStore,
  type DeletionJob,
  type DeletionJobKind,
  type DeletionJobStore,
} from "../repositories/deletion-job-store.js";
import {
  StorageUnavailableError,
  createBookFileStorageFromEnv,
  type BookFileStorage,
} from "./storage-service.js";

export const REJECTED_BOOK_FILE_DELAY_MS = 24 * 60 * 60 * 1000;
export const RETRY_BASE_DELAY_MS = 60 * 1000;
export const RETRY_MAX_DELAY_MS = 6 * 60 * 60 * 1000;
export const MAX_ATTEMPTS = 8;
export const STALE_CLAIM_MS = 15 * 60 * 1000;
export const WORKER_BATCH_SIZE = 10;
/** Upper bound of open jobs read per run. Completed jobs are never read. */
export const CANDIDATE_SCAN_LIMIT = 200;
const SAFE_ERROR_MAX_LENGTH = 200;

type BookFileKind = "rejected-book-file" | "deleted-book-file";
const BOOK_FILE_KINDS: readonly DeletionJobKind[] = ["rejected-book-file", "deleted-book-file"];

export type DeletionRunSummary = {
  claimed: number;
  completed: number;
  failed: number;
};

/** Delay before the retry that follows attempt number `attempts`: 1, 2, 4 ... minutes, capped at 6 h. */
export function retryDelayMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** exponent);
}

/** Same kind and object always give the same job id, so scheduling is idempotent. */
export function bookFileJobId(kind: BookFileKind, objectPath: string): string {
  return createHash("sha256").update(`${kind}:${objectPath}`).digest("hex").slice(0, 40);
}

function safeErrorMessage(error: unknown): string {
  const message =
    error instanceof StorageUnavailableError
      ? error.message
      : `Deletion failed (${error instanceof Error ? error.name : typeof error}).`;
  return message.slice(0, SAFE_ERROR_MAX_LENGTH);
}

export function isBookObjectPath(value: string): boolean {
  return /^books\/[^/]+\/\d+\/[^/]+$/.test(value) && !value.includes("..");
}

export class DeletionJobService {
  private readonly store: DeletionJobStore;
  private readonly storage: BookFileStorage | null;
  private readonly now: () => Date;

  public constructor(
    store: DeletionJobStore = defaultStore,
    storage: BookFileStorage | null = createBookFileStorageFromEnv(),
    now: () => Date = () => new Date(),
  ) {
    this.store = store;
    this.storage = storage;
    this.now = now;
  }

  /** Schedules the file of a rejected book for deletion 24 hours after `rejectedAt`. */
  scheduleRejectedBookFile(objectPath: string, rejectedAt: Date): Promise<DeletionJob> {
    return this.schedule(
      "rejected-book-file",
      objectPath,
      new Date(rejectedAt.getTime() + REJECTED_BOOK_FILE_DELAY_MS),
    );
  }

  /** Schedules a deleted book's file, or a replaced file, for immediate deletion. */
  scheduleDeletedBookFile(objectPath: string): Promise<DeletionJob> {
    return this.schedule("deleted-book-file", objectPath, this.now());
  }

  /** Runs up to `limit` due jobs. Safe to call repeatedly and concurrently. */
  async runDueJobs(limit: number = WORKER_BATCH_SIZE): Promise<DeletionRunSummary> {
    const summary: DeletionRunSummary = { claimed: 0, completed: 0, failed: 0 };
    const nowMs = this.now().getTime();

    const candidates = (
      await this.store.listByStatus(["pending", "failed", "processing"], CANDIDATE_SCAN_LIMIT)
    )
      .filter((job) => this.isClaimable(job, nowMs))
      .sort((first, second) => this.readyAt(first) - this.readyAt(second));

    for (const candidate of candidates) {
      if (summary.claimed >= limit) {
        break;
      }
      const claimedAt = this.now();
      const claimToken = crypto.randomUUID();
      const job = await this.store.claim(
        candidate.id,
        (current) => this.isClaimable(current, claimedAt.getTime()),
        { status: "processing", claimedAt: claimedAt.toISOString(), claimToken },
      );
      if (!job) {
        continue; // another run claimed or finished it first
      }
      summary.claimed += 1;

      let deletionError: unknown;
      let deletionFailed = false;
      try {
        await this.requireStorage().deleteObject(job.targetId);
      } catch (error) {
        deletionFailed = true;
        deletionError = error;
      }
      if (deletionFailed) {
        const attempts = job.attempts + 1;
        const lastError = safeErrorMessage(deletionError);
        const exhausted = attempts >= MAX_ATTEMPTS;
        const recorded = await this.store.finishClaim(job.id, claimToken, {
          status: "failed",
          attempts,
          lastError,
          claimToken: undefined,
          nextAttemptAt: exhausted
            ? undefined
            : new Date(this.now().getTime() + retryDelayMs(attempts)).toISOString(),
        });
        if (!recorded) {
          console.error(`[deletion-worker] Job ${job.id} failure was not recorded because its claim changed.`);
          continue;
        }
        console.error(
          `[deletion-worker] Job ${job.id} failed (attempt ${attempts}${exhausted ? ", no more retries" : ""}): ${lastError}`,
        );
        summary.failed += 1;
      } else {
        const recorded = await this.store.finishClaim(job.id, claimToken, {
          status: "completed",
          completedAt: this.now().toISOString(),
          nextAttemptAt: undefined,
          claimToken: undefined,
        });
        if (!recorded) {
          console.error(`[deletion-worker] Job ${job.id} completion was not recorded because its claim changed.`);
          continue;
        }
        summary.completed += 1;
      }
    }
    return summary;
  }

  private async schedule(kind: BookFileKind, objectPath: string, dueAt: Date): Promise<DeletionJob> {
    if (!isBookObjectPath(objectPath)) {
      throw new Error("Deletion jobs accept only book object paths.");
    }
    return this.store.createIfAbsent({
      id: bookFileJobId(kind, objectPath),
      kind,
      targetId: objectPath,
      dueAt: dueAt.toISOString(),
      status: "pending",
      attempts: 0,
    });
  }

  private readyAt(job: DeletionJob): number {
    if (job.status === "failed" && job.nextAttemptAt) {
      return Date.parse(job.nextAttemptAt);
    }
    return Date.parse(job.dueAt);
  }

  private isClaimable(job: DeletionJob, nowMs: number): boolean {
    if (!BOOK_FILE_KINDS.includes(job.kind) || !isBookObjectPath(job.targetId)) {
      return false; // account-data jobs wait for their agreed scope
    }
    if (job.status === "pending") {
      return this.readyAt(job) <= nowMs;
    }
    if (job.status === "failed") {
      // A failed job without nextAttemptAt has used all its retries.
      return job.nextAttemptAt !== undefined && this.readyAt(job) <= nowMs;
    }
    if (job.status === "processing") {
      const claimedAtMs = job.claimedAt ? Date.parse(job.claimedAt) : 0;
      return nowMs - claimedAtMs >= STALE_CLAIM_MS;
    }
    return false; // completed jobs are never processed again
  }

  private requireStorage(): BookFileStorage {
    if (!this.storage) {
      throw new StorageUnavailableError("not-configured");
    }
    return this.storage;
  }
}

export const deletionJobService = new DeletionJobService();

/** Narrow interface used by the book and moderation services. */
export type BookFileDeletionScheduler = Pick<
  DeletionJobService,
  "scheduleRejectedBookFile" | "scheduleDeletedBookFile"
>;

/** Raised when a book changed state but its file cleanup could not be recorded. */
export class DeletionScheduleError extends Error {
  public constructor(action: "rejected" | "deleted" | "replaced") {
    super(
      action === "deleted"
        ? "The book was deleted, but its file cleanup could not be scheduled. Delete the book again to retry."
        : action === "rejected"
          ? "The book was rejected, but its file cleanup could not be scheduled. Delete the book to schedule cleanup."
          : "The new file was saved, but cleanup of the previous file could not be scheduled.",
    );
    this.name = "DeletionScheduleError";
  }
}
