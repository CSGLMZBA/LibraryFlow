import { AuthError, type AuthSession, type AuthUser } from '../types/auth';
export interface StoredAuthUser extends AuthUser { salt: number[]; passwordHash: number[] }
const DB_NAME = 'libraryflow-auth-sprint1';
const DB_VERSION = 1;
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new AuthError('STORAGE_UNAVAILABLE', 'IndexedDB no está disponible.')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('users')) db.createObjectStore('users', { keyPath: 'email' });
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new AuthError('STORAGE_ERROR', 'No se puede acceder al almacenamiento local.'));
    req.onblocked = () => reject(new AuthError('STORAGE_BLOCKED', 'Cierra las demás pestañas de LibraryFlow.'));
  });
}
export async function transaction<T>(store: 'users' | 'sessions', mode: IDBTransactionMode, task: (os: IDBObjectStore, done: (v: T) => void) => void): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    let result: T;
    let hasResult = false;
    const tx = db.transaction(store, mode);
    try { task(tx.objectStore(store), v => {result = v; hasResult = true;}); }
    catch (e) { tx.abort(); reject(e); }
    tx.oncomplete = () => {db.close(); if (hasResult) resolve(result!); else reject(new AuthError('STORAGE_ERROR', 'No se completó la operación.'));};
    tx.onerror = () => {db.close(); reject(new AuthError('STORAGE_ERROR', 'La operación de almacenamiento falló.'));};
    tx.onabort = () => {db.close(); reject(new AuthError('STORAGE_ERROR', 'Se canceló la operación de almacenamiento.'));};
  });
}
export function getUser(email: string): Promise<StoredAuthUser | undefined> {
  return transaction('users','readonly',(os,done)=>{const req=os.get(email);req.onsuccess=()=>done(req.result as StoredAuthUser | undefined);});
}
export async function insertAuthUser(user: Omit<StoredAuthUser, 'displayName'>): Promise<StoredAuthUser> {
  const base = user.email.split('@')[0];
  const start = crypto.getRandomValues(new Uint32Array(1))[0] % 9000;
  // IndexedDB serializes write transactions on this store across tabs.
  const result = await transaction<StoredAuthUser | 'duplicate' | 'exhausted'>('users', 'readwrite', (store, done) => {
    const read = store.getAll();
    read.onsuccess = () => {
      const users: StoredAuthUser[] = read.result;
      if (users.some(existing => existing.email === user.email)) {
        done('duplicate');
        return;
      }
      const names = new Set(users.map(existing => existing.displayName?.toLowerCase()));
      for (let offset = 0; offset < 9000; offset++) {
        const displayName = base + (1000 + (start + offset) % 9000);
        if (names.has(displayName)) continue;
        const record = { ...user, displayName };
        store.add(record).onsuccess = () => done(record);
        return;
      }
      done('exhausted');
    };
  });
  if (result === 'duplicate') throw new AuthError('EMAIL_ALREADY_EXISTS', 'Este correo ya está registrado.', 'email');
  if (result === 'exhausted') throw new AuthError('NAME_UNAVAILABLE', 'No hay un nombre de usuario disponible.');
  return result;
}
export function getAllUsers(): Promise<StoredAuthUser[]> {
  return transaction('users','readonly',(os,done)=>{const req=os.getAll();req.onsuccess=()=>done(req.result as StoredAuthUser[]);});
}
export function readSession(): Promise<AuthSession | null> {
  return transaction('sessions','readonly',(os,done)=>{const req=os.get('current');req.onsuccess=()=>done((req.result as AuthSession | undefined)??null);});
}
export function saveSession(session: AuthSession): Promise<void> {
  return transaction('sessions','readwrite',(os,done)=>{const req=os.put(session,'current');req.onsuccess=()=>done();});
}
export function clearSession(): Promise<void> {
  return transaction('sessions','readwrite',(os,done)=>{const req=os.delete('current');req.onsuccess=()=>done();});
}
