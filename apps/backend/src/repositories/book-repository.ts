import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import type { Book, BookFilterQuery } from "@library-flow/shared";
import { authAdmin } from "../services/firebase-auth-service.js";

type MetadataUpdateResult =
  | { kind: "updated"; book: Book }
  | { kind: "conflict"; book: Book }
  | { kind: "duplicate" }
  | { kind: "not_found" }
  | { kind: "forbidden" };

/** US-PUB-001 RN-008: a title may repeat, but the title and author combination must be unique. */
export class DuplicateBookError extends Error {
  constructor() {
    super("A book with the same title and author already exists.");
    this.name = "DuplicateBookError";
  }
}

export function titleAuthorKey(title: string, author: string): string {
  return `${title.trim().toLocaleLowerCase()}\u0000${author.trim().toLocaleLowerCase()}`;
}

export class BookRepository {
  private readonly restrictedOwners = new Set<string>();
  private readonly books = new Map<string, Book>();
  private readonly processedMetadataMutations = new Map<string, Book>();

  async save(book: Book): Promise<Book> {
    const storedBook = this.clone(book);
    this.books.set(storedBook.id, storedBook);
    return this.clone(storedBook);
  }

  private titleAuthorTaken(title: string, author: string, exceptId?: string): boolean {
    const key = titleAuthorKey(title, author);
    return Array.from(this.books.values()).some((book) =>
      book.id !== exceptId && book.status !== "deleted" && titleAuthorKey(book.title, book.author) === key);
  }

  /** Saves a new book unless another live book already has the same title and author. */
  async saveIfUnique(book: Book): Promise<Book> {
    if (this.titleAuthorTaken(book.title, book.author, book.id)) throw new DuplicateBookError();
    return this.save(book);
  }

  async findById(id: string): Promise<Book | null> {
    const book = this.books.get(id);
    return book && !this.restrictedOwners.has(book.ownerId) ? this.clone(book) : null;
  }

  async findApproved(filters?: BookFilterQuery): Promise<Book[]> {
    const normalizedSearch = filters?.search?.trim().toLocaleLowerCase();

    return Array.from(this.books.values())
      .filter((book) => book.status === "approved" && !this.restrictedOwners.has(book.ownerId))
      .filter((book) => {
        if (!normalizedSearch) {
          return true;
        }

        return (
          book.title.toLocaleLowerCase().includes(normalizedSearch) ||
          book.author.toLocaleLowerCase().includes(normalizedSearch)
        );
      })
      .filter((book) =>
        filters?.categoryId
          ? book.categoryIds.includes(filters.categoryId)
          : true,
      )
      .filter((book) =>
        filters?.genreId ? book.genreIds.includes(filters.genreId) : true,
      )
      .map((book) => this.clone(book));
  }

  async findByOwner(ownerId: string): Promise<Book[]> {
    return Array.from(this.books.values())
      .filter((book) => book.ownerId === ownerId)
      .map((book) => this.clone(book));
  }

  async findPending(): Promise<Book[]> {
    return Array.from(this.books.values())
      .filter((book) => book.status === "pending" && !this.restrictedOwners.has(book.ownerId))
      .map((book) => this.clone(book));
  }

  async update(id: string, updates: Partial<Book>): Promise<Book | null> {
    const currentBook = this.books.get(id);
    if (!currentBook) {
      return null;
    }

    if (updates.id !== undefined && updates.id !== id) {
      throw new Error("Book ID cannot be changed.");
    }

    if (
      updates.ownerId !== undefined &&
      updates.ownerId !== currentBook.ownerId
    ) {
      throw new Error("Book owner cannot be changed.");
    }

    const updatedBook = this.clone({
      ...currentBook,
      ...updates,
      id: currentBook.id,
      ownerId: currentBook.ownerId,
    });
    this.books.set(id, updatedBook);
    return this.clone(updatedBook);
  }

  async updateMetadata(
    id: string,
    requesterId: string,
    isModerator: boolean,
    clientRevision: number | undefined,
    mutationId: string | undefined,
    prepareUpdates: () => Pick<Partial<Book>, "title" | "author" | "description" | "categoryIds" | "genreIds">,
    updatedAt: string,
  ): Promise<MetadataUpdateResult> {
    const currentBook = this.books.get(id);
    if (!currentBook || this.restrictedOwners.has(currentBook.ownerId)) {
      return { kind: "not_found" };
    }
    if (!isModerator && currentBook.ownerId !== requesterId) {
      return { kind: "forbidden" };
    }

    const key = mutationId ? JSON.stringify([requesterId, id, mutationId]) : undefined;
    const cached = key ? this.processedMetadataMutations.get(key) : undefined;
    if (cached) return { kind: "updated", book: this.clone(cached) };
    if (clientRevision !== undefined && currentBook.revision !== clientRevision) {
      return { kind: "conflict", book: this.clone(currentBook) };
    }

    const updatedBook = this.clone({
      ...currentBook,
      ...prepareUpdates(),
      revision: currentBook.revision + 1,
      updatedAt,
    });
    if (this.titleAuthorTaken(updatedBook.title, updatedBook.author, id)) return { kind: "duplicate" };
    this.books.set(id, updatedBook);
    if (key) this.processedMetadataMutations.set(key, this.clone(updatedBook));
    return { kind: "updated", book: this.clone(updatedBook) };
  }

  async redactOwner(uid: string): Promise<void> {
    this.restrictedOwners.add(uid);
    for (const [id, book] of this.books) {
      if (book.ownerId === uid) this.books.set(id, {...book, author: 'Deleted user', status: 'pending'});
    }
  }

  private clone(book: Book): Book {
    return {
      ...book,
      categoryIds: [...book.categoryIds],
      genreIds: [...book.genreIds],
    };
  }
}

type StoredBook = Book & { ownerRestricted?: boolean };

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

export class BookStoreError extends Error {
  constructor() {
    super("Book storage is temporarily unavailable.");
    this.name = "BookStoreError";
  }
}

/** Durable Firestore books. Opt in with ENABLE_CLOUD_CONTENT=true. */
export class FirestoreBookRepository extends BookRepository {
  constructor(private readonly database: () => FirebaseFirestore.Firestore = () => {
    authAdmin();
    return getFirestore();
  }) {
    super();
  }

  private async storage<T>(
    operation: (db: FirebaseFirestore.Firestore) => Promise<T>,
    isCallerError: (error: unknown) => boolean = () => false,
  ): Promise<T> {
    try {
      return await operation(this.database());
    } catch (error) {
      if (isCallerError(error) || (error instanceof Error && (error.message === "Book ID cannot be changed." || error.message === "Book owner cannot be changed."))) throw error;
      console.error(`[books] Storage failed: ${error instanceof Error ? error.name : typeof error}`);
      throw new BookStoreError();
    }
  }

  private toBook(data: StoredBook): Book {
    const { ownerRestricted: _restricted, ...book } = data;
    return { ...book, categoryIds: [...book.categoryIds], genreIds: [...book.genreIds] };
  }

  override async save(book: Book): Promise<Book> {
    await this.storage(db => db.collection("books").doc(book.id).set(withoutUndefined(book)));
    return this.toBook(book);
  }

  private guardRef(db: FirebaseFirestore.Firestore, title: string, author: string) {
    return db.collection("bookTitleAuthorKeys").doc(createHash("sha256").update(titleAuthorKey(title, author)).digest("hex"));
  }

  /** True when the guard points at a different book that still exists and is not deleted. */
  private async guardTaken(
    db: FirebaseFirestore.Firestore,
    tx: FirebaseFirestore.Transaction,
    guard: FirebaseFirestore.DocumentSnapshot,
    bookId: string,
  ): Promise<boolean> {
    const holder = guard.exists ? (guard.data() as { bookId?: string }).bookId : undefined;
    if (!holder || holder === bookId) return false;
    const other = await tx.get(db.collection("books").doc(holder));
    return other.exists && (other.data() as StoredBook).status !== "deleted";
  }

  /** The guard document is written in the same transaction as the book, so concurrent publishes cannot both win. */
  override async saveIfUnique(book: Book): Promise<Book> {
    await this.storage(db => {
      const guardRef = this.guardRef(db, book.title, book.author);
      return db.runTransaction(async tx => {
        const guard = await tx.get(guardRef);
        if (await this.guardTaken(db, tx, guard, book.id)) throw new DuplicateBookError();
        tx.set(guardRef, { bookId: book.id });
        tx.set(db.collection("books").doc(book.id), withoutUndefined(book));
      });
    }, error => error instanceof DuplicateBookError);
    return this.toBook(book);
  }

  override async findById(id: string): Promise<Book | null> {
    const snapshot = await this.storage(db => db.collection("books").doc(id).get());
    const data = snapshot.exists ? snapshot.data() as StoredBook : undefined;
    return data && !data.ownerRestricted ? this.toBook(data) : null;
  }

  override async findApproved(filters?: BookFilterQuery): Promise<Book[]> {
    const search = filters?.search?.trim().toLocaleLowerCase();
    const snapshot = await this.storage(db => db.collection("books").where("status", "==", "approved").get());
    return snapshot.docs.map(doc => doc.data() as StoredBook)
      .filter(book => !book.ownerRestricted)
      .filter(book => !search || book.title.toLocaleLowerCase().includes(search) ||
        book.author.toLocaleLowerCase().includes(search))
      .filter(book => !filters?.categoryId || book.categoryIds.includes(filters.categoryId))
      .filter(book => !filters?.genreId || book.genreIds.includes(filters.genreId))
      .map(book => this.toBook(book));
  }

  override async findByOwner(ownerId: string): Promise<Book[]> {
    const snapshot = await this.storage(db => db.collection("books").where("ownerId", "==", ownerId).get());
    return snapshot.docs.map(doc => doc.data() as StoredBook).filter(book => !book.ownerRestricted).map(book => this.toBook(book));
  }

  override async findPending(): Promise<Book[]> {
    const snapshot = await this.storage(db => db.collection("books").where("status", "==", "pending").get());
    return snapshot.docs.map(doc => doc.data() as StoredBook).filter(book => !book.ownerRestricted).map(book => this.toBook(book));
  }

  override async update(id: string, updates: Partial<Book>): Promise<Book | null> {
    if (updates.id !== undefined && updates.id !== id) throw new Error("Book ID cannot be changed.");
    return this.storage(db => {
      const ref = db.collection("books").doc(id);
      return db.runTransaction(async tx => {
        const snapshot = await tx.get(ref);
        if (!snapshot.exists) return null;
        const current = snapshot.data() as StoredBook;
        if (updates.ownerId !== undefined && updates.ownerId !== current.ownerId) throw new Error("Book owner cannot be changed.");
        const next = withoutUndefined({ ...current, ...updates, id: current.id, ownerId: current.ownerId });
        tx.set(ref, next);
        return this.toBook(next);
      });
    });
  }

  override async updateMetadata(
    id: string,
    requesterId: string,
    isModerator: boolean,
    clientRevision: number | undefined,
    mutationId: string | undefined,
    prepareUpdates: () => Pick<Partial<Book>, "title" | "author" | "description" | "categoryIds" | "genreIds">,
    updatedAt: string,
  ): Promise<MetadataUpdateResult> {
    const mutationKey = mutationId
      ? createHash("sha256").update(JSON.stringify([requesterId, id, mutationId])).digest("hex")
      : undefined;
    // Validation errors thrown by prepareUpdates are the caller's, not storage failures.
    let validationError: unknown;
    return this.storage(db => {
      const ref = db.collection("books").doc(id);
      const mutationRef = mutationKey ? db.collection("bookMetadataMutations").doc(mutationKey) : undefined;
      return db.runTransaction(async (tx): Promise<MetadataUpdateResult> => {
        const snapshot = await tx.get(ref);
        const replay = mutationRef ? await tx.get(mutationRef) : undefined;
        const current = snapshot.exists ? snapshot.data() as StoredBook : undefined;
        if (!current || current.ownerRestricted) return { kind: "not_found" };
        if (!isModerator && current.ownerId !== requesterId) return { kind: "forbidden" };
        if (replay?.exists) return { kind: "updated", book: this.toBook(replay.data() as StoredBook) };
        if (clientRevision !== undefined && current.revision !== clientRevision) {
          return { kind: "conflict", book: this.toBook(current) };
        }
        let updates: ReturnType<typeof prepareUpdates>;
        try {
          updates = prepareUpdates();
        } catch (error) {
          validationError = error;
          throw error;
        }
        const next = withoutUndefined({ ...current, ...updates, revision: current.revision + 1, updatedAt });
        const keyChanged = titleAuthorKey(current.title, current.author) !== titleAuthorKey(next.title, next.author);
        const newGuardRef = this.guardRef(db, next.title, next.author);
        const oldGuardRef = this.guardRef(db, current.title, current.author);
        // All reads happen before any write in the transaction.
        const newGuard = keyChanged ? await tx.get(newGuardRef) : undefined;
        if (newGuard && await this.guardTaken(db, tx, newGuard, id)) return { kind: "duplicate" };
        const oldGuard = keyChanged ? await tx.get(oldGuardRef) : undefined;
        tx.set(ref, next);
        if (keyChanged) {
          tx.set(newGuardRef, { bookId: id });
          if (oldGuard?.exists && (oldGuard.data() as { bookId?: string }).bookId === id) tx.delete(oldGuardRef);
        }
        if (mutationRef) tx.create(mutationRef, withoutUndefined(this.toBook(next)));
        return { kind: "updated", book: this.toBook(next) };
      });
    }, error => validationError !== undefined && error === validationError);
  }

  override async redactOwner(uid: string): Promise<void> {
    await this.storage(async db => {
      const snapshot = await db.collection("books").where("ownerId", "==", uid).get();
      for (let index = 0; index < snapshot.docs.length; index += 200) {
        const refs = snapshot.docs.slice(index, index + 200).map(doc => db.collection("books").doc(doc.id));
        await db.runTransaction(async tx => {
          const current = await Promise.all(refs.map(ref => tx.get(ref)));
          current.forEach((doc, position) => {
            if (doc.exists) {
              tx.set(refs[position], { ...doc.data(), author: "Deleted user", status: "pending", ownerRestricted: true });
            }
          });
        });
      }
    });
  }
}

export const bookRepository: BookRepository = process.env.ENABLE_CLOUD_CONTENT === "true"
  ? new FirestoreBookRepository()
  : new BookRepository();
