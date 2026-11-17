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
export function putUserIfAbsent(user: StoredAuthUser): Promise<void> {
  // add(), not put(): an existing email causes the transaction to abort.
  return transaction('users','readwrite',(os,done)=>{const req=os.add(user);req.onsuccess=()=>done();});
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
