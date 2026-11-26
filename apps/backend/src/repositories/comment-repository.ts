import { getFirestore } from "firebase-admin/firestore";
import type { BookComment } from "@library-flow/shared";
import { authAdmin } from "../services/firebase-auth-service.js";

type CommentModeration = {
  moderatorId: string;
  reason: string;
  moderatedAt: string;
};

export class CommentRepository {
  private readonly comments = new Map<string, BookComment>();

  async create(comment: BookComment): Promise<BookComment> {
    const storedComment = this.clone(comment);
    this.comments.set(storedComment.id, storedComment);
    return this.clone(storedComment);
  }

  async findByBookId(
    bookId: string,
    includeDeleted = false,
  ): Promise<BookComment[]> {
    return Array.from(this.comments.values())
      .filter(
        (comment) =>
          comment.bookId === bookId && (includeDeleted || !comment.isDeleted),
      )
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      )
      .map((comment) => this.clone(comment));
  }

  async findById(id: string): Promise<BookComment | null> {
    const comment = this.comments.get(id);
    return comment ? this.clone(comment) : null;
  }

  async softDelete(
    id: string,
    moderation: CommentModeration,
  ): Promise<BookComment | null> {
    const comment = this.comments.get(id);
    if (!comment) {
      return null;
    }

    const deletedComment = this.clone({
      ...comment,
      isDeleted: true,
      moderationReason: moderation.reason,
      moderatedBy: moderation.moderatorId,
      moderatedAt: moderation.moderatedAt,
    });
    this.comments.set(id, deletedComment);
    return this.clone(deletedComment);
  }

  async redactAuthor(uid: string): Promise<void> {
    for (const [id, comment] of this.comments) {
      if (comment.authorId === uid) this.comments.set(id, {...comment, authorDisplayName: 'Deleted user', content: '', isDeleted: true});
    }
  }

  private clone(comment: BookComment): BookComment {
    return { ...comment };
  }
}

export class CommentStoreError extends Error {
  constructor() {
    super("Comment storage is temporarily unavailable.");
    this.name = "CommentStoreError";
  }
}

/** Durable Firestore comments. Opt in with ENABLE_CLOUD_CONTENT=true. */
export class FirestoreCommentRepository extends CommentRepository {
  constructor(private readonly database: () => FirebaseFirestore.Firestore = () => {
    authAdmin();
    return getFirestore();
  }) {
    super();
  }

  private async storage<T>(operation: (db: FirebaseFirestore.Firestore) => Promise<T>): Promise<T> {
    try {
      return await operation(this.database());
    } catch (error) {
      console.error(`[comments] Storage failed: ${error instanceof Error ? error.name : typeof error}`);
      throw new CommentStoreError();
    }
  }

  private clean(comment: BookComment): BookComment {
    return Object.fromEntries(Object.entries(comment).filter(([, value]) => value !== undefined)) as BookComment;
  }

  override async create(comment: BookComment): Promise<BookComment> {
    const stored = this.clean(comment);
    await this.storage(db => db.collection("comments").doc(comment.id).create(stored));
    return { ...stored };
  }

  override async findByBookId(bookId: string, includeDeleted = false): Promise<BookComment[]> {
    const snapshot = await this.storage(db => db.collection("comments").where("bookId", "==", bookId).get());
    return snapshot.docs.map(doc => doc.data() as BookComment)
      .filter(comment => includeDeleted || !comment.isDeleted)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }

  override async findById(id: string): Promise<BookComment | null> {
    const snapshot = await this.storage(db => db.collection("comments").doc(id).get());
    return snapshot.exists ? snapshot.data() as BookComment : null;
  }

  override async softDelete(id: string, moderation: CommentModeration): Promise<BookComment | null> {
    return this.storage(db => {
      const ref = db.collection("comments").doc(id);
      return db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) return null;
        const next = this.clean({
          ...snapshot.data() as BookComment,
          isDeleted: true,
          moderationReason: moderation.reason,
          moderatedBy: moderation.moderatorId,
          moderatedAt: moderation.moderatedAt,
        });
        tx.set(ref, next);
        return next;
      });
    });
  }

  override async redactAuthor(uid: string): Promise<void> {
    await this.storage(async db => {
      const snapshot = await db.collection("comments").where("authorId", "==", uid).get();
      for (let index = 0; index < snapshot.docs.length; index += 200) {
        const refs = snapshot.docs.slice(index, index + 200).map(doc => db.collection("comments").doc(doc.id));
        await db.runTransaction(async tx => {
          const current = await Promise.all(refs.map(ref => tx.get(ref)));
          current.forEach((doc, position) => {
            if (doc.exists) tx.set(refs[position], { ...doc.data(), authorDisplayName: "Deleted user", content: "", isDeleted: true });
          });
        });
      }
    });
  }
}

export const commentRepository: CommentRepository = process.env.ENABLE_CLOUD_CONTENT === "true"
  ? new FirestoreCommentRepository()
  : new CommentRepository();
