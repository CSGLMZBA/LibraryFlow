import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  BOOK_AUTHOR_MAX_LENGTH,
  BOOK_MAX_FILE_SIZE_BYTES,
  BOOK_TITLE_MAX_LENGTH,
  CLASSIFICATION_NAME_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  DEFAULT_TEXT_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  REJECTED_FILE_DELETION_HOURS,
  REJECTION_REASON_MAX_LENGTH,
} from '../../packages/shared/src/schemas/limits.ts';
import {
  getUser,
  insertAuthUser,
  readSession,
  saveSession,
} from '../../apps/frontend/src/repositories/auth-indexeddb.ts';
import { bookRepository } from '../../apps/frontend/src/repositories/book-repository.ts';
import { commentRepository } from '../../apps/frontend/src/repositories/comment-repository.ts';
import {
  downloadBookForOffline,
  getOfflineBook,
  listOfflineBookIds,
} from '../../apps/frontend/src/services/offline-book-service.ts';

// --- Lightweight in-memory IndexedDB mock for reload, corruption, and quota tests ---
function createIndexedDBMock() {
  const databases = new Map();
  const state = { simulateQuotaError: false };

  function ensureDb(name) {
    if (!databases.has(name)) {
      databases.set(name, new Map());
    }
    return databases.get(name);
  }

  function makeRequest(executor) {
    const req = { result: undefined, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      try {
        req.result = executor();
        if (typeof req.onsuccess === 'function') req.onsuccess({ target: req });
      } catch (err) {
        req.error = err;
        if (typeof req.onerror === 'function') req.onerror({ target: req });
      }
    });
    return req;
  }

  const indexedDBMock = {
    open(name) {
      const req = {
        result: null,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      const storesMap = ensureDb(name);
      const db = {
        objectStoreNames: {
          contains: (storeName) => storesMap.has(storeName),
        },
        createObjectStore: (storeName, opts = {}) => {
          if (!storesMap.has(storeName)) {
            storesMap.set(storeName, { keyPath: opts.keyPath ?? null, records: new Map() });
          }
          return { createIndex: () => ({}) };
        },
        close: () => {},
        transaction: (storeNames, _mode) => {
          const names = Array.isArray(storeNames) ? storeNames : [storeNames];
          const tx = {
            error: null,
            oncomplete: null,
            onerror: null,
            onabort: null,
            abort: () => {
              if (typeof tx.onabort === 'function') tx.onabort();
            },
            objectStore: (storeName) => {
              if (!names.includes(storeName) || !storesMap.has(storeName)) {
                throw new Error(`ObjectStore ${storeName} not found`);
              }
              const storeData = storesMap.get(storeName);
              const finishTx = () => {
                setImmediate(() => {
                  if (typeof tx.oncomplete === 'function') tx.oncomplete();
                });
              };
              return {
                get: (key) =>
                  makeRequest(() => {
                    finishTx();
                    return storeData.records.get(key);
                  }),
                getAll: () =>
                  makeRequest(() => {
                    finishTx();
                    return Array.from(storeData.records.values());
                  }),
                getAllKeys: () =>
                  makeRequest(() => {
                    finishTx();
                    return Array.from(storeData.records.keys());
                  }),
                put: (value, explicitKey) =>
                  makeRequest(() => {
                    if (state.simulateQuotaError) {
                      const quotaErr = new DOMException('Quota exceeded', 'QuotaExceededError');
                      tx.error = quotaErr;
                      setImmediate(() => {
                        if (typeof tx.onerror === 'function') tx.onerror();
                      });
                      throw quotaErr;
                    }
                    const key = storeData.keyPath ? value[storeData.keyPath] : explicitKey;
                    storeData.records.set(key, value);
                    finishTx();
                    return key;
                  }),
                add: (value, explicitKey) =>
                  makeRequest(() => {
                    const key = storeData.keyPath ? value[storeData.keyPath] : explicitKey;
                    if (storeData.records.has(key)) throw new Error('Key already exists');
                    storeData.records.set(key, value);
                    finishTx();
                    return key;
                  }),
                delete: (key) =>
                  makeRequest(() => {
                    storeData.records.delete(key);
                    finishTx();
                  }),
                index: (indexField) => ({
                  getAll: (range) =>
                    makeRequest(() => {
                      finishTx();
                      const all = Array.from(storeData.records.values());
                      if (!range || range._only === undefined) return all;
                      return all.filter((item) => item && item[indexField] === range._only);
                    }),
                }),
              };
            },
          };
          return tx;
        },
      };

      queueMicrotask(() => {
        req.result = db;
        if (typeof req.onupgradeneeded === 'function') req.onupgradeneeded({ target: req });
        if (typeof req.onsuccess === 'function') req.onsuccess({ target: req });
      });
      return req;
    },
    __injectRaw: (dbName, storeName, key, rawValue) => {
      const storesMap = ensureDb(dbName);
      if (!storesMap.has(storeName)) {
        storesMap.set(storeName, { keyPath: null, records: new Map() });
      }
      storesMap.get(storeName).records.set(key, rawValue);
    },
    __state: state,
  };

  return indexedDBMock;
}

let idbMock;

beforeEach(() => {
  idbMock = createIndexedDBMock();
  globalThis.indexedDB = idbMock;
  globalThis.IDBKeyRange = { only: (value) => ({ _only: value }) };
});

test('S1-AC-009 (TC-038): shared limits match SPEC-001 §15 and FIELD_RULES.md', () => {
  assert.equal(DEFAULT_TEXT_MAX_LENGTH, 25);
  assert.equal(EMAIL_MAX_LENGTH, 50);
  assert.equal(PASSWORD_MIN_LENGTH, 8);
  assert.equal(PASSWORD_MAX_LENGTH, 128);
  assert.equal(BOOK_TITLE_MAX_LENGTH, 100);
  assert.equal(BOOK_AUTHOR_MAX_LENGTH, 100);
  assert.equal(BOOK_MAX_FILE_SIZE_BYTES, 20 * 1024 * 1024);
  assert.equal(COMMENT_MAX_LENGTH, 1000);
  assert.equal(REJECTION_REASON_MAX_LENGTH, 500);
  assert.equal(CLASSIFICATION_NAME_MAX_LENGTH, 50);
  assert.equal(REJECTED_FILE_DELETION_HOURS, 24);
});

test('S1-AC-009 (TC-034): auth session, books, and comments persist across simulated reload', async () => {
  const inserted = await insertAuthUser({
    id: 'u-reader-1',
    email: 'cesar.qa@example.com',
    role: 'reader',
    createdAt: '2026-11-18T10:00:00.000Z',
    salt: [1, 2, 3],
    passwordHash: [9, 8, 7],
  });
  assert.match(inserted.displayName, /^cesar\.qa\d{4}$/);

  await saveSession({
    user: {
      id: inserted.id,
      email: inserted.email,
      displayName: inserted.displayName,
      role: 'reader',
      createdAt: inserted.createdAt,
    },
    token: 'local-token-1',
    authenticatedAt: '2026-11-18T10:01:00.000Z',
  });

  await bookRepository.saveBookEntry({
    id: 'book-persist-1',
    title: 'Clean Architecture',
    author: 'Robert C. Martin',
    description: 'Software design principles',
    ownerId: 'u-pub-1',
    publisherName: 'Tech Press',
    status: 'approved',
    fileName: 'clean-arch.pdf',
    fileFormat: 'pdf',
    fileSizeBytes: 1024,
    fileBlob: new Blob(['%PDF-1.4 sample'], { type: 'application/pdf' }),
    categoryId: 'cat-science-tech',
    genreId: 'gen-software-eng',
    createdAt: '2026-11-18T09:00:00.000Z',
    updatedAt: '2026-11-18T09:00:00.000Z',
  });

  await commentRepository.saveComment({
    id: 'com-1',
    bookId: 'book-persist-1',
    authorId: 'u-reader-1',
    authorDisplayName: inserted.displayName,
    content: 'Excellent technical book.',
    createdAt: '2026-11-18T10:05:00.000Z',
    isDeleted: false,
  });

  // Simular recarga: nuevas consultas sobre la misma instancia persistente de IndexedDB
  const restoredSession = await readSession();
  const restoredUser = await getUser('cesar.qa@example.com');
  const restoredBooks = await bookRepository.getAllBooks();
  const restoredComments = await commentRepository.getCommentsByBookId('book-persist-1');

  assert.equal(restoredSession?.user.email, 'cesar.qa@example.com');
  assert.equal(restoredUser?.id, 'u-reader-1');
  assert.equal(restoredBooks.length, 1);
  assert.equal(restoredBooks[0].title, 'Clean Architecture');
  assert.equal('fileBlob' in restoredBooks[0], false);
  assert.equal(restoredComments.length, 1);
  assert.equal(restoredComments[0].content, 'Excellent technical book.');
});

test('S1-AC-009 (TC-035): malformed or corrupt IndexedDB records do not crash repositories', async () => {
  await bookRepository.getAllBooks(); // Inicializa stores
  idbMock.__injectRaw('LibraryFlowDB', 'books', 'corrupt-key', null);
  idbMock.__injectRaw('LibraryFlowDB', 'comments', 'corrupt-comment', { bookId: 'b1' });

  await assert.doesNotReject(async () => {
    const comments = await commentRepository.getCommentsByBookId('b1');
    assert.ok(Array.isArray(comments));
  });

  await assert.rejects(
    async () => {
      await bookRepository.getAllBooks();
    },
    (err) => err instanceof Error,
  );
});

test('S1-AC-009 (TC-037): offline boundary works without network and enforces quota cleanup', async () => {
  const bookRecord = {
    id: 'book-offline-1',
    title: 'Distributed Systems',
    author: 'Maarten van Steen',
    description: 'Principles and paradigms',
    ownerId: 'u-pub-1',
    publisherName: 'Academic Press',
    status: 'approved',
    fileName: 'dist-sys.epub',
    fileFormat: 'epub',
    fileSizeBytes: 2048,
    categoryId: 'cat-science-tech',
    genreId: 'gen-networking',
    createdAt: '2026-11-18T08:00:00.000Z',
    updatedAt: '2026-11-18T08:00:00.000Z',
  };

  await bookRepository.saveBookEntry({
    ...bookRecord,
    fileBlob: new Blob(['EPUB binary content'], { type: 'application/epub+zip' }),
  });

  // 1) Simular fallo de cuota (QuotaExceededError): no debe dejar copia incompleta
  idbMock.__state.simulateQuotaError = true;
  await assert.rejects(
    () => downloadBookForOffline(bookRecord),
    /Not enough browser storage/,
  );
  assert.equal(await getOfflineBook('book-offline-1'), null);

  // 2) Retry after freeing quota: it should complete and be readable offline
  idbMock.__state.simulateQuotaError = false;
  await downloadBookForOffline(bookRecord);

  const ids = await listOfflineBookIds();
  const offlineCopy = await getOfflineBook('book-offline-1');
  assert.deepEqual(ids, ['book-offline-1']);
  assert.equal(offlineCopy?.title, 'Distributed Systems');
  assert.equal(offlineCopy?.author, 'Maarten van Steen');
});