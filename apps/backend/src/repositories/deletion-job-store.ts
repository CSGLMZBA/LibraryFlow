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
  claimToken?: string;
  completedAt?: string;
};

export const DELETION_JOBS_COLLECTION = "deletionJobs";

export interface DeletionJobStore {
  /** Creates the job unless one with the same id exists. Returns the stored job. */
  createIfAbsent(job: DeletionJob): Promise<DeletionJob>;
  get(id: string): Promise<DeletionJob | null>;
  /** Jobs in any of `statuses`, at most `limit`. Completed jobs are never listed. */
  listByStatus(statuses: DeletionJobStatus[], limit: number): Promise<DeletionJob[]>;
  /** Advances a shared cursor by at most limit open jobs, wrapping at the end. */
  nextOpenJobPage(limit: number): Promise<DeletionJob[]>;
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
  finishClaim(id: string, claimToken: string, patch: Partial<DeletionJob>): Promise<boolean>;
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
  private scanCursor: string | null = null;

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

  async nextOpenJobPage(limit: number): Promise<DeletionJob[]> {
    const jobs = [...this.jobs.entries()]
      .filter(([id, job]) => ["pending", "failed", "processing"].includes(job.status) && (this.scanCursor === null || id > this.scanCursor))
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .slice(0, limit);
    this.scanCursor = jobs.length === limit ? jobs[jobs.length - 1][0] : null;
    return jobs.map(([, job]) => ({...job}));
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

  async finishClaim(id: string, claimToken: string, patch: Partial<DeletionJob>): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job || job.status !== "processing" || job.claimToken !== claimToken) return false;
    this.jobs.set(id, withoutUndefined({...job, ...patch}));
    return true;
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

  async nextOpenJobPage(limit: number): Promise<DeletionJob[]> {
    const db = await this.db();
    const { FieldPath } = await import("firebase-admin/firestore");
    const cursorRef = db.collection("workerState").doc("book-file-scan");
    return db.runTransaction(async transaction => {
      const state = await transaction.get(cursorRef);
      const cursor: unknown = state.data()?.cursor;
      if (cursor !== undefined && cursor !== null && typeof cursor !== "string") {
        throw new Error("Deletion worker scan cursor is invalid.");
      }
      let query = db.collection(DELETION_JOBS_COLLECTION)
        .where("status", "in", ["pending", "failed", "processing"])
        .orderBy(FieldPath.documentId()).limit(limit);
      if (typeof cursor === "string" && cursor) query = query.startAfter(cursor);
      const snapshot = await transaction.get(query);
      const next = snapshot.size === limit ? snapshot.docs[snapshot.size - 1].id : null;
      transaction.set(cursorRef, {cursor: next});
      return snapshot.docs.map(doc => doc.data() as DeletionJob);
    });
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

  async finishClaim(id: string, claimToken: string, patch: Partial<DeletionJob>): Promise<boolean> {
    const db = await this.db();
    const { FieldValue } = await import("firebase-admin/firestore");
    const reference = db.collection(DELETION_JOBS_COLLECTION).doc(id);
    return db.runTransaction(async transaction => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return false;
      const job = snapshot.data() as DeletionJob;
      if (job.status !== "processing" || job.claimToken !== claimToken) return false;
      const data = Object.fromEntries(
        Object.entries(patch).map(([key, value]) => [key, value === undefined ? FieldValue.delete() : value]),
      );
      transaction.update(reference, data);
      return true;
    });
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
