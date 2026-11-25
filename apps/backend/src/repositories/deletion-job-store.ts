/**
 * Persisted deletion jobs (SPEC-002 §5, S2-T08).
 *
 * Jobs live in Firestore `deletionJobs/{jobId}` when FIREBASE_PROJECT_ID is
 * set, so they survive restarts and are shared with the account lifecycle
 * jobs written by S2-T06. Local mode keeps them in memory. Jobs are never
 * deleted: their history is the audit trail.
 *
 * firebase-admin is loaded only when the Firestore store is first used, so
 * local mode and tests do not need Firebase.
 */

export type DeletionJobKind = "rejected-book-file" | "deleted-book-file" | "account-data";
export type DeletionJobStatus = "pending" | "processing" | "completed" | "failed";

export type DeletionJob = {
  id: string;
  kind: DeletionJobKind;
  /** Book file kinds: the object key in the private bucket. account-data: the user UID. */
  targetId: string;
  dueAt: string;
  status: DeletionJobStatus;
  attempts: number;
  lastError?: string;
  nextAttemptAt?: string;
  claimedAt?: string;
  completedAt?: string;
};

export const DELETION_JOBS_COLLECTION = "deletionJobs";

export interface DeletionJobStore {
  /** Creates the job unless one with the same id exists. Returns the stored job. */
  createIfAbsent(job: DeletionJob): Promise<DeletionJob>;
  get(id: string): Promise<DeletionJob | null>;
  /** Jobs in any of `statuses`, at most `limit`. Completed jobs are never listed. */
  listByStatus(statuses: DeletionJobStatus[], limit: number): Promise<DeletionJob[]>;
  /**
   * Re-reads the job atomically and writes `claim` only when `canClaim`
   * accepts the current value. Returns the claimed job, or null when another
   * worker changed it first.
   */
  claim(
    id: string,
    canClaim: (job: DeletionJob) => boolean,
    claim: Partial<DeletionJob>,
  ): Promise<DeletionJob | null>;
  update(id: string, patch: Partial<DeletionJob>): Promise<void>;
}

/** Firestore rejects `undefined` values; drop those keys before writing. */
function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

export class MemoryDeletionJobStore implements DeletionJobStore {
  private readonly jobs = new Map<string, DeletionJob>();

  async createIfAbsent(job: DeletionJob): Promise<DeletionJob> {
    const existing = this.jobs.get(job.id);
    if (existing) {
      return { ...existing };
    }
    this.jobs.set(job.id, { ...job });
    return { ...job };
  }

  async get(id: string): Promise<DeletionJob | null> {
    const job = this.jobs.get(id);
    return job ? { ...job } : null;
  }

  async listByStatus(statuses: DeletionJobStatus[], limit: number): Promise<DeletionJob[]> {
    return [...this.jobs.values()]
      .filter((job) => statuses.includes(job.status))
      .slice(0, limit)
      .map((job) => ({ ...job }));
  }

  async claim(
    id: string,
    canClaim: (job: DeletionJob) => boolean,
    claim: Partial<DeletionJob>,
  ): Promise<DeletionJob | null> {
    const job = this.jobs.get(id);
    if (!job || !canClaim({ ...job })) {
      return null;
    }
    const claimed = { ...job, ...claim };
    this.jobs.set(id, claimed);
    return { ...claimed };
  }

  async update(id: string, patch: Partial<DeletionJob>): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Deletion job ${id} does not exist.`);
    }
    this.jobs.set(id, withoutUndefined({ ...job, ...patch }));
  }
}

type Firestore = import("firebase-admin/firestore").Firestore;

export class FirestoreDeletionJobStore implements DeletionJobStore {
  private dbPromise: Promise<Firestore> | null = null;

  private db(): Promise<Firestore> {
    this.dbPromise ??= (async () => {
      const { authAdmin } = await import("../services/firebase-auth-service.js");
      const { getFirestore } = await import("firebase-admin/firestore");
      authAdmin(); // initializes the Firebase Admin app with the backend credentials
      return getFirestore();
    })();
    return this.dbPromise;
  }

  async createIfAbsent(job: DeletionJob): Promise<DeletionJob> {
    const db = await this.db();
    const reference = db.collection(DELETION_JOBS_COLLECTION).doc(job.id);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (snapshot.exists) {
        return snapshot.data() as DeletionJob;
      }
      transaction.create(reference, withoutUndefined(job));
      return job;
    });
  }

  async get(id: string): Promise<DeletionJob | null> {
    const db = await this.db();
    const snapshot = await db.collection(DELETION_JOBS_COLLECTION).doc(id).get();
    return snapshot.exists ? (snapshot.data() as DeletionJob) : null;
  }

  async listByStatus(statuses: DeletionJobStatus[], limit: number): Promise<DeletionJob[]> {
    const db = await this.db();
    const snapshot = await db
      .collection(DELETION_JOBS_COLLECTION)
      .where("status", "in", statuses)
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => doc.data() as DeletionJob);
  }

  async claim(
    id: string,
    canClaim: (job: DeletionJob) => boolean,
    claim: Partial<DeletionJob>,
  ): Promise<DeletionJob | null> {
    const db = await this.db();
    const reference = db.collection(DELETION_JOBS_COLLECTION).doc(id);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) {
        return null;
      }
      const job = snapshot.data() as DeletionJob;
      if (!canClaim(job)) {
        return null;
      }
      transaction.update(reference, withoutUndefined(claim));
      return { ...job, ...claim };
    });
  }

  async update(id: string, patch: Partial<DeletionJob>): Promise<void> {
    const db = await this.db();
    const { FieldValue } = await import("firebase-admin/firestore");
    // `undefined` in a patch means "remove the field" (for example nextAttemptAt).
    const data = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [key, value === undefined ? FieldValue.delete() : value]),
    );
    await db.collection(DELETION_JOBS_COLLECTION).doc(id).update(data);
  }
}

/** Firestore when FIREBASE_PROJECT_ID is set; memory otherwise (local mode). */
export function createDeletionJobStore(
  env: Record<string, string | undefined> = process.env,
): DeletionJobStore {
  return env.FIREBASE_PROJECT_ID?.trim()
    ? new FirestoreDeletionJobStore()
    : new MemoryDeletionJobStore();
}

export const deletionJobStore: DeletionJobStore = createDeletionJobStore();
