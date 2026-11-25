import { getFirestore } from 'firebase-admin/firestore';

export interface AuthStateTransaction {
  get<T extends object>(path: string): Promise<T | null>;
  query<T extends object>(collection: string, field: string, value: string): Promise<T[]>;
  set(path: string, value: object): void;
  create(path: string, value: object): void;
}
export interface AuthStateStore {
  transaction<T>(operation: (tx: AuthStateTransaction) => Promise<T>): Promise<T>;
}
/** All policy writes are transactional. Storage failures never fall back to memory. */
export class FirestoreAuthStateStore implements AuthStateStore {
  async transaction<T>(operation: (tx: AuthStateTransaction) => Promise<T>): Promise<T> {
    const db = getFirestore();
    return db.runTransaction(transaction => operation({
      async get<U extends object>(path: string) {
        const snapshot = await transaction.get(db.doc(path));
        return snapshot.exists ? snapshot.data() as U : null;
      },
      async query<U extends object>(collection: string, field: string, value: string) {
        const snapshot = await transaction.get(db.collection(collection).where(field, '==', value).limit(100));
        return snapshot.docs.map(doc => doc.data() as U);
      },
      set(path, value) { transaction.set(db.doc(path), {...value}); },
      create(path, value) { transaction.create(db.doc(path), {...value}); },
    }));
  }
}
