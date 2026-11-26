/**
 * Sprint 2 — Storage, Deletion Jobs, and Deployment Tests
 *
 * Covers: S2-AC-006 (TC-S2-027 through TC-S2-030, TC-S2-059 through
 *         TC-S2-062) — Supabase Storage and book file routes
 *         S2-AC-007 (TC-S2-031 through TC-S2-035) — Scheduled Cleanup
 *         S2-AC-010 (TC-S2-053 through TC-S2-058) — Deployment
 *
 * Owner: Cesar (Sentinel)
 * Status: TC-S2-027 to TC-S2-030, TC-S2-054 (policy), TC-S2-055, and
 *         TC-S2-059 to TC-S2-062 implemented by Jorge (S2-T07). Remaining
 *         tests are stubs awaiting S2-T08, S2-T09, and Carlos (S2-T11).
 *
 * Run: npx tsx --test docs/testing/s2-storage-deployment.test.mjs
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CorsConfigurationError,
  DEVELOPMENT_DEFAULT_ORIGIN,
  PRODUCTION_DEFAULT_ORIGIN,
  corsHeadersFor,
  isOriginAllowed,
  parseFrontendOrigins,
} from '../../apps/backend/src/config/cors-policy.ts';

import { BOOK_MAX_FILE_SIZE_BYTES } from '../../packages/shared/src/index.ts';
import { BookRepository } from '../../apps/backend/src/repositories/book-repository.ts';
import { RevisionConflictError } from '../../apps/backend/src/services/book-service.ts';
import {
  BookFileError,
  BookFileService,
  DOWNLOAD_URL_TTL_SECONDS,
  sanitizeBookFileName,
} from '../../apps/backend/src/services/book-file-service.ts';
import {
  StorageUnavailableError,
  SupabaseBookFileStorage,
  createBookFileStorageFromEnv,
} from '../../apps/backend/src/services/storage-service.ts';
import { createAuthGuard } from '../../apps/backend/src/middleware/auth-guard.ts';
import { MemoryDeletionJobStore } from '../../apps/backend/src/repositories/deletion-job-store.ts';
import {
  DeletionJobService,
  DeletionScheduleError,
  MAX_ATTEMPTS,
  REJECTED_BOOK_FILE_DELAY_MS,
  STALE_CLAIM_MS,
  bookFileJobId,
  retryDelayMs,
} from '../../apps/backend/src/services/deletion-job-service.ts';
import { isWorkerAuthorized, requireWorkerSecret } from '../../apps/backend/src/middleware/worker-secret.ts';
import { ModerationService } from '../../apps/backend/src/services/moderation-service.ts';
import { BookService } from '../../apps/backend/src/services/book-service.ts';
import { CommentRepository } from '../../apps/backend/src/repositories/comment-repository.ts';
import { NotificationRepository } from '../../apps/backend/src/repositories/notification-repository.ts';
import { verifyBookStorage } from '../../scripts/verify-storage-live.mjs';
import { HEALTH_RESPONSE, healthHandler } from '../../apps/backend/src/routes/health-routes.ts';
import { checkDeployment, UNTRUSTED_ORIGIN } from '../../scripts/check-deployment.mjs';
import { PAGE_SIZE, exportFirestore, serializeValue, writeBackup } from '../../scripts/backup-firestore.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import {
  buildBookBucketConfig,
  findBucketConfigProblems,
  setupBookBucket,
} from '../../scripts/setup-storage-bucket.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

// ── Book file test helpers (S2-T07, SPEC-002 §4.1) ──────────────────────────
const FIXED_NOW = new Date('2026-11-23T18:00:00.000Z');
const OWNER = { uid: 'publisher-a', role: 'publisher' };
const OTHER_PUBLISHER = { uid: 'publisher-b', role: 'publisher' };
const READER = { uid: 'reader-1', role: 'reader' };
const MODERATOR = { uid: 'moderator-1', role: 'moderator' };
const FAKE_SERVICE_KEY = 'test-service-role-key-never-exposed';

/** In-memory stand-in for Supabase Storage that records every call. */
class FakeBookFileStorage {
  constructor() {
    this.objects = new Map();
    this.calls = [];
  }
  async createSignedUploadUrl(objectPath) {
    this.calls.push(['upload-url', objectPath]);
    return `https://storage.test/storage/v1/object/upload/sign/books/${objectPath}?token=upload-token`;
  }
  async getObjectInfo(objectPath) {
    this.calls.push(['info', objectPath]);
    return this.objects.get(objectPath) ?? null;
  }
  async createSignedDownloadUrl(objectPath, expiresInSeconds) {
    this.calls.push(['download-url', objectPath, expiresInSeconds]);
    return `https://storage.test/storage/v1/object/sign/books/${objectPath}?token=download-token`;
  }
  async deleteObject(objectPath) {
    this.calls.push(['delete', objectPath]);
    this.objects.delete(objectPath);
  }
}

function makeBook(overrides = {}) {
  return {
    id: 'book-1',
    title: 'Storage Patterns',
    author: 'Ada Writer',
    ownerId: OWNER.uid,
    status: 'pending',
    accessKey: 'access-key',
    shareableUrl: '',
    fileUrl: '',
    fileType: 'pdf',
    fileSizeBytes: 1024,
    categoryIds: [],
    genreIds: [],
    createdAt: FIXED_NOW.toISOString(),
    updatedAt: FIXED_NOW.toISOString(),
    revision: 3,
    ...overrides,
  };
}

async function setupFileService(books = [makeBook()]) {
  const repository = new BookRepository();
  for (const book of books) await repository.save(book);
  const storage = new FakeBookFileStorage();
  const service = new BookFileService(repository, storage, () => FIXED_NOW, undefined, async () => true);
  return { repository, storage, service };
}

function validUploadRequest(overrides = {}) {
  return { fileName: 'My Book (final).pdf', fileType: 'pdf', fileSizeBytes: 5_000_000, revision: 3, ...overrides };
}

/** Asserts that a promise rejects with a SPEC-002 contract error. */
async function rejectsWith(promise, status, code, field) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof BookFileError, `Expected BookFileError, got ${error?.name}`);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    if (field !== undefined) assert.equal(error.field, field);
    return true;
  });
}

/** Runs an auth guard with a fake request and response. */
async function runGuard(guard, token) {
  const request = { headers: token ? { authorization: `Bearer ${token}` } : {} };
  const result = { status: 200, body: null, nextCalled: false };
  const response = {
    locals: {},
    status(code) { result.status = code; return this; },
    json(body) { result.body = body; return this; },
  };
  await guard(request, response, () => { result.nextCalled = true; });
  return result;
}

/**
 * Fake Supabase Storage for the live verification script. `secure: true`
 * behaves like a correctly configured private bucket.
 */
function createFakeSupabase({ secure }) {
  const limit = 20 * 1024 * 1024;
  const allowed = ['application/pdf', 'application/epub+zip'];
  const objects = new Map();
  const seenUrls = [];
  const bucketSettings = secure
    ? { public: false, file_size_limit: limit, allowed_mime_types: allowed }
    : { public: true, file_size_limit: null, allowed_mime_types: null };

  const fetchImpl = async (url, init = {}) => {
    seenUrls.push(url);
    const { pathname } = new URL(url);
    const method = init.method ?? 'GET';
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
    const objectPath = (prefix) => decodeURIComponent(pathname.slice(prefix.length));

    if (method === 'GET' && pathname === '/storage/v1/bucket/books') return json(bucketSettings);
    if (method === 'POST' && pathname.startsWith('/storage/v1/object/upload/sign/books/')) {
      return json({ url: `${pathname.slice('/storage/v1'.length)}?token=upload-token` });
    }
    if (method === 'PUT' && pathname.startsWith('/storage/v1/object/upload/sign/books/')) {
      const size = init.body.byteLength;
      const type = init.headers['Content-Type'];
      if (secure && size > limit) return json({ error: 'Payload too large' }, 413);
      if (secure && !allowed.includes(type)) return json({ error: 'invalid_mime_type' }, 400);
      objects.set(objectPath('/storage/v1/object/upload/sign/books/'), { size, type });
      return json({ Key: 'ok' });
    }
    if (method === 'POST' && pathname === '/storage/v1/object/list/books') {
      const { prefix, search } = JSON.parse(init.body);
      const object = objects.get(`${prefix}/${search}`);
      return json(object ? [{ name: search, metadata: { size: object.size, mimetype: object.type } }] : []);
    }
    if (method === 'GET' && pathname.startsWith('/storage/v1/object/public/books/')) {
      return objects.has(objectPath('/storage/v1/object/public/books/')) && !secure
        ? new Response('file') : json({ error: 'not found' }, 400);
    }
    if (method === 'POST' && pathname.startsWith('/storage/v1/object/sign/books/')) {
      return json({ signedURL: `${pathname.slice('/storage/v1'.length)}?token=download-token` });
    }
    if (method === 'GET' && pathname.startsWith('/storage/v1/object/sign/books/')) {
      return objects.has(objectPath('/storage/v1/object/sign/books/')) ? new Response('file') : json({}, 404);
    }
    if (method === 'GET' && pathname.startsWith('/storage/v1/object/books/')) {
      return init.headers?.apikey || !secure ? new Response('file') : json({ error: 'unauthorized' }, 400);
    }
    if (method === 'DELETE' && pathname === '/storage/v1/object/books') {
      for (const prefix of JSON.parse(init.body).prefixes) objects.delete(prefix);
      return json([]);
    }
    return json({ error: `unexpected ${method} ${pathname}` }, 500);
  };
  return { fetchImpl, objects, seenUrls };
}

const LIVE_ENV = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE_KEY,
  SUPABASE_BOOK_BUCKET: 'books',
};

// ── Deployment test helpers (S2-T09) ────────────────────────────────────────
const RENDER_URL = 'https://libraryflow-api.onrender.com';
const NETLIFY_ORIGIN = 'https://libraryflow.netlify.app';

/** Fake Render backend plus Netlify site. Options introduce one defect each. */
function createFakeDeployment({ wildcardCors = false, leakInLazyChunk = false, sleepyResponses = 0 } = {}) {
  let remainingSleepy = sleepyResponses;
  const fetchImpl = async (url, init = {}) => {
    const { origin, pathname } = new URL(url);
    const requestOrigin = init.headers?.Origin;
    if (origin === RENDER_URL) {
      if (remainingSleepy > 0) { remainingSleepy -= 1; return new Response('waking up', { status: 503 }); }
      const headers = new Headers({ 'Content-Type': 'application/json' });
      if (wildcardCors) headers.set('Access-Control-Allow-Origin', '*');
      else if (requestOrigin === NETLIFY_ORIGIN) headers.set('Access-Control-Allow-Origin', NETLIFY_ORIGIN);
      if (init.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (pathname === '/health') return new Response(JSON.stringify(HEALTH_RESPONSE), { status: 200, headers });
      return new Response(JSON.stringify({ success: false, error: { code: 'AUTH_REQUIRED', message: 'Sign in.' } }), { status: 401, headers });
    }
    if (origin === NETLIFY_ORIGIN) {
      if (pathname === '/') {
        return new Response('<!doctype html><div id="root"></div><script src="https://cdn.tailwindcss.com"></script><script type="module" crossorigin src="/assets/index-a1.js"></script>');
      }
      if (pathname === '/assets/index-a1.js') {
        return new Response('const VITE_API_BASE_URL="https://libraryflow-api.onrender.com";const l=()=>import("./firebase-client-b2.js");');
      }
      if (pathname === '/assets/firebase-client-b2.js') {
        return new Response(leakInLazyChunk ? 'const k="FIREBASE_PRIVATE_KEY";' : 'export const apiKey="public-web-key";');
      }
    }
    return new Response('not found', { status: 404 });
  };
  return fetchImpl;
}

const noWait = { sleep: async () => {}, now: (() => { let t = 0; return () => (t += 1000); })() };

/** Minimal fake of the firebase-admin Firestore API used by the backup script. */
function createFakeFirestore(tree) {
  const collectionRef = (id, docs) => {
    const ordered = Object.entries(docs).sort(([a], [b]) => a.localeCompare(b));
    const query = (offset, size) => ({
      async get() {
        const page = ordered.slice(offset, offset + size).map(([docId, doc]) => ({
          id: docId,
          data: () => doc.data,
          ref: { listCollections: async () => Object.entries(doc.sub ?? {}).map(([subId, subDocs]) => collectionRef(subId, subDocs)) },
          _index: ordered.findIndex(([key]) => key === docId),
        }));
        return { docs: page };
      },
      startAfter: (last) => query(last._index + 1, size),
    });
    return { id, limit: (size) => query(0, size) };
  };
  return { listCollections: async () => Object.entries(tree).map(([id, docs]) => collectionRef(id, docs)) };
}

const fakeVerify = async (token) => ({
  'reader-token': READER,
  'publisher-token': OWNER,
  'moderator-token': MODERATOR,
})[token] ?? null;


// Names of server-only secrets (SPEC-002 §8). They may appear in backend
// code and server-side scripts, never in browser code or VITE_ variables.
const SECRET_NAMES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'FIREBASE_PRIVATE_KEY',
  'DELETION_WORKER_SECRET',
];
const SECRET_NAME_PATTERN = new RegExp(SECRET_NAMES.join('|'));

// Secret values: PEM private keys and JWT-shaped keys (Supabase keys are JWTs).
const SECRET_VALUE_PATTERN =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./;

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);
}

function filesUnder(directory) {
  const result = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) result.push(...filesUnder(path));
    else result.push(path);
  }
  return result;
}

// ===========================================================================
// S2-AC-006: Supabase Storage (SPEC-002 §4)
// ===========================================================================

describe('S2-AC-006: Supabase Storage', () => {
  test('TC-S2-027: bucket setup enforces a private bucket with upload limits', async () => {
    const config = buildBookBucketConfig('books');
    assert.equal(config.public, false);
    assert.equal(config.file_size_limit, BOOK_MAX_FILE_SIZE_BYTES);
    assert.deepEqual(config.allowed_mime_types, ['application/pdf', 'application/epub+zip']);

    assert.deepEqual(findBucketConfigProblems({ ...config }), []);
    assert.match(findBucketConfigProblems({ ...config, public: true }).join(), /public/);
    assert.match(findBucketConfigProblems({ ...config, file_size_limit: null }).join(), /file_size_limit/);
    assert.match(findBucketConfigProblems({ ...config, allowed_mime_types: null }).join(), /allowed_mime_types/);
  });

  test('TC-S2-027: setup script creates the bucket privately and never prints the key', async () => {
    const requests = [];
    let stored = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      requests.push({ url, method: init.method, body: init.body, headers: init.headers });
      if (init.method === 'GET' && stored === null) {
        return new Response(JSON.stringify({ statusCode: '404', error: 'Bucket not found' }), { status: 400 });
      }
      if (init.method === 'POST') stored = JSON.parse(init.body);
      return new Response(JSON.stringify(stored ?? {}), { status: 200 });
    };
    try {
      const summary = await setupBookBucket({
        SUPABASE_URL: 'https://project.supabase.co/',
        SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE_KEY,
        SUPABASE_BOOK_BUCKET: 'books',
      });
      assert.equal(summary.action, 'created');
      assert.equal(summary.public, false);
      assert.equal(JSON.parse(requests[1].body).public, false);
      assert.equal(requests[1].url, 'https://project.supabase.co/storage/v1/bucket');
      assert.equal(JSON.stringify(summary).includes(FAKE_SERVICE_KEY), false);
      assert.ok(requests.every((request) => !request.url.includes(FAKE_SERVICE_KEY)));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('TC-S2-027: storage client keeps the service-role key out of returned URLs and errors', async () => {
    const calls = [];
    const fakeFetch = async (url, init) => {
      calls.push({ url, init });
      if (url.includes('/object/upload/sign/')) {
        return new Response(JSON.stringify({ url: '/object/upload/sign/books/books/b/1/a.pdf?token=t1' }));
      }
      if (url.includes('/object/sign/')) {
        return new Response(JSON.stringify({ signedURL: '/object/sign/books/books/b/1/a.pdf?token=t2' }));
      }
      if (url.includes('/object/list/')) {
        return new Response(JSON.stringify([
          { name: 'a.pdf.bak', metadata: { size: 1, mimetype: 'application/pdf' } },
          { name: 'a.pdf', metadata: { size: 2048, mimetype: 'application/pdf' } },
        ]));
      }
      return new Response(JSON.stringify({ message: 'Internal' }), { status: 500 });
    };
    const storage = new SupabaseBookFileStorage(
      { url: 'https://project.supabase.co/', serviceRoleKey: FAKE_SERVICE_KEY, bucket: 'books' },
      fakeFetch,
    );

    const uploadUrl = await storage.createSignedUploadUrl('books/b/1/a.pdf');
    assert.equal(uploadUrl, 'https://project.supabase.co/storage/v1/object/upload/sign/books/books/b/1/a.pdf?token=t1');
    assert.deepEqual(JSON.parse(calls[0].init.body), {});
    const downloadUrl = await storage.createSignedDownloadUrl('books/b/1/a.pdf', 600);
    assert.equal(downloadUrl, 'https://project.supabase.co/storage/v1/object/sign/books/books/b/1/a.pdf?token=t2');
    assert.deepEqual(JSON.parse(calls[1].init.body), { expiresIn: 600 });
    assert.deepEqual(await storage.getObjectInfo('books/b/1/a.pdf'), { sizeBytes: 2048, mimeType: 'application/pdf' });
    assert.equal(await storage.getObjectInfo('books/b/1/missing.pdf'), null);

    for (const url of [uploadUrl, downloadUrl]) assert.equal(url.includes(FAKE_SERVICE_KEY), false);
    assert.ok(calls.every(({ url, init }) => !url.includes(FAKE_SERVICE_KEY) && init.headers.apikey === FAKE_SERVICE_KEY));

    await assert.rejects(storage.deleteObject('books/b/1/a.pdf'), (error) => {
      assert.ok(error instanceof StorageUnavailableError);
      assert.equal(error.message.includes(FAKE_SERVICE_KEY), false);
      assert.equal(error.message.includes('supabase.co'), false);
      return true;
    });
  });

  test('TC-S2-027: storage configuration defaults to the canonical bucket and requires URL/key together', () => {
    assert.equal(createBookFileStorageFromEnv({}), null);
    assert.equal(createBookFileStorageFromEnv({ SUPABASE_BOOK_BUCKET: 'books' }), null);
    const storageWithOverride = createBookFileStorageFromEnv({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE_KEY,
      SUPABASE_BOOK_BUCKET: 'custom-bucket',
    });
    assert.ok(storageWithOverride instanceof SupabaseBookFileStorage);
    assert.equal(storageWithOverride.bucket, 'custom-bucket');
    assert.throws(() => createBookFileStorageFromEnv({ SUPABASE_URL: 'https://project.supabase.co' }), /SUPABASE_SERVICE_ROLE_KEY/);
    const storageWithDefaultBucket = createBookFileStorageFromEnv({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE_KEY,
    });
    assert.ok(storageWithDefaultBucket instanceof SupabaseBookFileStorage);
    assert.equal(storageWithDefaultBucket.bucket, 'books');
  });

  test('TC-S2-028: upload constraint — 20 MB maximum, EPUB or PDF only', async () => {
    const { service, storage, repository } = await setupFileService();

    const accepted = await service.createUploadUrl('book-1', OWNER, validUploadRequest({ fileSizeBytes: BOOK_MAX_FILE_SIZE_BYTES }));
    assert.equal(accepted.objectPath, 'books/book-1/3/My-Book-final.pdf');
    assert.match(accepted.objectPath, /^books\/book-1\/3\/[A-Za-z0-9._-]+\.pdf$/);

    await rejectsWith(service.createUploadUrl('book-1', OWNER, validUploadRequest({ fileSizeBytes: BOOK_MAX_FILE_SIZE_BYTES + 1 })), 400, 'VALIDATION_ERROR', 'fileSizeBytes');
    await rejectsWith(service.createUploadUrl('book-1', OWNER, validUploadRequest({ fileName: 'book.docx', fileType: 'docx' })), 400, 'VALIDATION_ERROR', 'fileType');

    // The bucket limit is the first barrier; completion re-checks the stored object.
    storage.objects.set(accepted.objectPath, { sizeBytes: BOOK_MAX_FILE_SIZE_BYTES + 1, mimeType: 'application/pdf' });
    await rejectsWith(service.completeUpload('book-1', OWNER, { objectPath: accepted.objectPath, revision: 3 }), 400, 'VALIDATION_ERROR', 'file');
    assert.equal(storage.objects.has(accepted.objectPath), false, 'Oversized object must be deleted');

    storage.objects.set(accepted.objectPath, { sizeBytes: 1000, mimeType: 'text/html' });
    await rejectsWith(service.completeUpload('book-1', OWNER, { objectPath: accepted.objectPath, revision: 3 }), 400, 'VALIDATION_ERROR', 'file');
    assert.equal(storage.objects.has(accepted.objectPath), false, 'Wrong-type object must be deleted');
    assert.equal((await repository.findById('book-1')).fileObjectPath, undefined);
  });

  test('TC-S2-028: file names are sanitized into the storage key', () => {
    assert.equal(sanitizeBookFileName('My Book (final).pdf', 'pdf'), 'My-Book-final.pdf');
    assert.equal(sanitizeBookFileName('Ñandú—historia.EPUB', 'epub'), 'and-historia.epub');
    assert.equal(sanitizeBookFileName('???.pdf', 'pdf'), 'book.pdf');
    assert.equal(sanitizeBookFileName('..hidden.pdf', 'pdf'), 'hidden.pdf');
  });

  test('TC-S2-029: signed download URL for authorized readers expires within 10 minutes', async () => {
    const { service, storage } = await setupFileService([
      makeBook({ status: 'approved', fileObjectPath: 'books/book-1/3/book.pdf' }),
    ]);

    const result = await service.createDownloadUrl('book-1', READER);
    assert.match(result.downloadUrl, /token=/);
    assert.equal(result.downloadUrl.includes(FAKE_SERVICE_KEY), false);
    assert.deepEqual(storage.calls.at(-1), ['download-url', 'books/book-1/3/book.pdf', DOWNLOAD_URL_TTL_SECONDS]);
    assert.ok(DOWNLOAD_URL_TTL_SECONDS <= 600);
    const expiresInMs = new Date(result.expiresAt).getTime() - FIXED_NOW.getTime();
    assert.ok(expiresInMs > 0 && expiresInMs <= 10 * 60 * 1000, `expiresAt ${result.expiresAt} must be within 10 minutes`);
  });

  test('TC-S2-029: storage failures surface as errors, never as a fake URL', async () => {
    const repository = new BookRepository();
    await repository.save(makeBook({ status: 'approved', fileObjectPath: 'books/book-1/3/book.pdf' }));
    const unconfigured = new BookFileService(repository, null, () => FIXED_NOW, undefined, async () => true);
    await assert.rejects(unconfigured.createDownloadUrl('book-1', READER), StorageUnavailableError);
  });

  test('TC-S2-030: no credentials in frontend bundle', (t) => {
    const distDirectory = join(repoRoot, 'apps/frontend/dist');
    if (!existsSync(distDirectory)) {
      t.skip('apps/frontend/dist not found: run `npm run build` before this test');
      return;
    }

    const leaks = filesUnder(distDirectory).filter((file) => {
      const content = readFileSync(file, 'utf8');
      return SECRET_NAME_PATTERN.test(content) || SECRET_VALUE_PATTERN.test(content);
    });

    assert.deepEqual(
      leaks.map((file) => relative(repoRoot, file)),
      [],
      'Built frontend files must not contain server secret names or values',
    );
  });
});

// ===========================================================================
// S2-AC-007: Scheduled Cleanup — Deletion Jobs (SPEC-002 §5)
// ===========================================================================

describe('S2-AC-006: Book file routes (SPEC-002 §4.1)', () => {
  test('TC-S2-059: only the owner publisher receives an upload URL', async () => {
    const publisherGuard = createAuthGuard(fakeVerify, 'publisher');
    const asReader = await runGuard(publisherGuard, 'reader-token');
    assert.equal(asReader.status, 403);
    assert.equal(asReader.body.error.code, 'FORBIDDEN');
    assert.equal(asReader.nextCalled, false);
    assert.equal((await runGuard(publisherGuard, undefined)).body.error.code, 'AUTH_REQUIRED');

    const routes = readFileSync(join(repoRoot, 'apps/backend/src/routes/book-routes.ts'), 'utf8');
    assert.match(routes, /"\/:bookId\/file\/upload-url", publisherGuard/);
    assert.match(routes, /"\/:bookId\/file\/complete", publisherGuard/);
    assert.match(routes, /"\/:bookId\/file\/download-url", requireAuth/);

    const { service } = await setupFileService();
    await rejectsWith(service.createUploadUrl('book-1', OTHER_PUBLISHER, validUploadRequest()), 403, 'FORBIDDEN');
    await rejectsWith(service.createUploadUrl('missing', OWNER, validUploadRequest()), 404, 'NOT_FOUND');

    const result = await service.createUploadUrl('book-1', OWNER, validUploadRequest());
    assert.equal(result.objectPath, 'books/book-1/3/My-Book-final.pdf');
    assert.match(result.uploadUrl, /token=/);
    assert.equal(result.uploadUrl.includes(FAKE_SERVICE_KEY), false);
  });

  test('TC-S2-060: upload request validation', async () => {
    const { service } = await setupFileService([
      makeBook(),
      makeBook({ id: 'book-approved', status: 'approved' }),
    ]);

    await rejectsWith(service.createUploadUrl('book-1', OWNER, validUploadRequest({ fileSizeBytes: 21 * 1024 * 1024 })), 400, 'VALIDATION_ERROR', 'fileSizeBytes');
    await rejectsWith(service.createUploadUrl('book-1', OWNER, validUploadRequest({ fileSizeBytes: 0 })), 400, 'VALIDATION_ERROR', 'fileSizeBytes');
    await rejectsWith(service.createUploadUrl('book-1', OWNER, validUploadRequest({ fileName: 'book.epub', fileType: 'pdf' })), 400, 'VALIDATION_ERROR', 'fileName');
    await rejectsWith(service.createUploadUrl('book-1', OWNER, validUploadRequest({ fileName: '../etc/book.pdf' })), 400, 'VALIDATION_ERROR', 'fileName');
    await rejectsWith(service.createUploadUrl('book-1', OWNER, validUploadRequest({ fileName: `${'a'.repeat(252)}.pdf` })), 400, 'VALIDATION_ERROR', 'fileName');
    await rejectsWith(service.createUploadUrl('book-1', OWNER, validUploadRequest({ revision: '3' })), 400, 'VALIDATION_ERROR', 'revision');
    await rejectsWith(service.createUploadUrl('book-1', OWNER, null), 400, 'VALIDATION_ERROR');
    await assert.rejects(
      service.createUploadUrl('book-1', OWNER, validUploadRequest({ revision: 2 })),
      (error) => error instanceof RevisionConflictError && error.serverRevision === 3,
    );
    await rejectsWith(service.createUploadUrl('book-approved', OWNER, validUploadRequest()), 409, 'INVALID_STATE');
  });

  test('TC-S2-061: upload completion verifies the stored object', async () => {
    const { service, storage, repository } = await setupFileService();
    const { objectPath } = await service.createUploadUrl('book-1', OWNER, validUploadRequest());

    await rejectsWith(service.completeUpload('book-1', OWNER, { objectPath, revision: 3 }), 409, 'INVALID_STATE');

    await rejectsWith(service.completeUpload('book-1', OWNER, { objectPath: 'books/other-book/3/x.pdf', revision: 3 }), 400, 'VALIDATION_ERROR', 'objectPath');
    await rejectsWith(service.completeUpload('book-1', OWNER, { objectPath: 'books/book-1/3/../4/x.pdf', revision: 3 }), 400, 'VALIDATION_ERROR', 'objectPath');
    await rejectsWith(service.completeUpload('book-1', OTHER_PUBLISHER, { objectPath, revision: 3 }), 403, 'FORBIDDEN');

    storage.objects.set(objectPath, { sizeBytes: 4_900_000, mimeType: 'application/pdf' });
    const book = await service.completeUpload('book-1', OWNER, { objectPath, revision: 3 });
    assert.equal(book.fileObjectPath, objectPath);
    assert.equal(book.fileSizeBytes, 4_900_000);
    assert.equal(book.fileType, 'pdf');
    assert.equal(book.revision, 4);
    assert.equal(book.fileUrl, '', 'fileUrl must never hold a storage URL');
    assert.equal(book.updatedAt, FIXED_NOW.toISOString());
    assert.deepEqual(await repository.findById('book-1'), book);

    await assert.rejects(service.completeUpload('book-1', OWNER, { objectPath, revision: 3 }), RevisionConflictError);
  });

  test('TC-S2-062: download URL visibility rules', async () => {
    const requireAuth = createAuthGuard(fakeVerify);
    const anonymous = await runGuard(requireAuth, undefined);
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.body.error.code, 'AUTH_REQUIRED');

    const { service } = await setupFileService([
      makeBook({ id: 'approved', status: 'approved', fileObjectPath: 'books/approved/1/a.pdf' }),
      makeBook({ id: 'pending', status: 'pending', fileObjectPath: 'books/pending/1/p.pdf' }),
      makeBook({ id: 'rejected', status: 'rejected', fileObjectPath: 'books/rejected/1/r.pdf' }),
      makeBook({ id: 'deleted', status: 'deleted', fileObjectPath: 'books/deleted/1/d.pdf' }),
      makeBook({ id: 'no-file', status: 'approved' }),
    ]);

    for (const requester of [READER, OTHER_PUBLISHER, OWNER, MODERATOR]) {
      assert.match((await service.createDownloadUrl('approved', requester)).downloadUrl, /token=/);
    }
    for (const id of ['pending', 'rejected']) {
      await rejectsWith(service.createDownloadUrl(id, READER), 404, 'NOT_FOUND');
      await rejectsWith(service.createDownloadUrl(id, OTHER_PUBLISHER), 404, 'NOT_FOUND');
      assert.match((await service.createDownloadUrl(id, OWNER)).downloadUrl, /token=/);
      assert.match((await service.createDownloadUrl(id, MODERATOR)).downloadUrl, /token=/);
    }
    for (const requester of [READER, OWNER, MODERATOR]) {
      await rejectsWith(service.createDownloadUrl('deleted', requester), 404, 'NOT_FOUND');
    }
    await rejectsWith(service.createDownloadUrl('no-file', READER), 404, 'NOT_FOUND');
    await rejectsWith(service.createDownloadUrl('missing', READER), 404, 'NOT_FOUND');
  });
});

describe('S2-AC-006: Live storage verification script (storage:verify)', () => {
  test('TC-S2-027/028: all live checks pass against a correctly configured private bucket', async () => {
    const supabase = createFakeSupabase({ secure: true });
    const { bucket, checks } = await verifyBookStorage(LIVE_ENV, supabase.fetchImpl, 'run-1');

    assert.equal(bucket, 'books');
    assert.equal(checks.length, 7);
    assert.deepEqual(checks.filter((check) => !check.passed), []);
    assert.deepEqual([...new Set(checks.map((check) => check.id))], ['TC-S2-027', 'TC-S2-029', 'TC-S2-028']);
    assert.equal(supabase.objects.size, 0, 'Every test object must be removed');
    assert.equal(JSON.stringify(checks).includes(FAKE_SERVICE_KEY), false);
    assert.equal(JSON.stringify(checks).includes('token'), false);
  });

  test('TC-S2-027/028: a public bucket without limits is reported as failing', async () => {
    const supabase = createFakeSupabase({ secure: false });
    const { checks } = await verifyBookStorage(LIVE_ENV, supabase.fetchImpl, 'run-2');
    const failed = checks.filter((check) => !check.passed).map((check) => check.name);

    assert.ok(failed.includes('Bucket is private with 20 MB and PDF/EPUB limits'));
    assert.ok(failed.includes('Anonymous public URL is denied'));
    assert.ok(failed.includes('Upload larger than 20 MB is rejected'));
    assert.ok(failed.includes('Upload with a non-PDF/EPUB type is rejected'));
    assert.equal(supabase.objects.size, 0, 'Test objects are removed even when checks fail');
  });

  test('storage:verify requires all storage variables', async () => {
    await assert.rejects(verifyBookStorage({ SUPABASE_URL: 'https://project.supabase.co' }), /SUPABASE_SERVICE_ROLE_KEY/);
  });
});

// ── Deletion worker helpers (S2-T08) ────────────────────────────────────────
const REJECTED_AT = new Date('2026-11-24T12:00:00.000Z');
const FILE_PATH = 'books/book-1/3/book.pdf';

/** Clock the test can move forward. */
function createClock(start = REJECTED_AT) {
  let current = start.getTime();
  return { now: () => new Date(current), advance: (ms) => { current += ms; } };
}

/** Storage fake whose deleteObject can be told to fail. */
function createDeletingStorage() {
  const storage = new FakeBookFileStorage();
  storage.failDeletes = 0;
  storage.deleted = [];
  storage.deleteObject = async (objectPath) => {
    if (storage.failDeletes > 0) {
      storage.failDeletes -= 1;
      throw new StorageUnavailableError('delete-object', 503);
    }
    storage.deleted.push(objectPath);
  };
  return storage;
}

function setupWorker() {
  const store = new MemoryDeletionJobStore();
  const storage = createDeletingStorage();
  const clock = createClock();
  const worker = new DeletionJobService(store, storage, clock.now);
  return { store, storage, clock, worker };
}

describe('S2-AC-007: Scheduled Cleanup — Deletion Jobs', () => {
  test('TC-S2-031: rejection creates one 24h deletion job for the book file', async () => {
    const { store, worker } = setupWorker();
    const books = new BookRepository();
    await books.save(makeBook({ fileObjectPath: FILE_PATH }));
    await books.save(makeBook({ id: 'book-no-file' }));
    const moderation = new ModerationService(books, new CommentRepository(), new NotificationRepository(), worker);

    const rejected = await moderation.rejectBook('book-1', 'Missing rights statement.', MODERATOR.uid);
    assert.equal(rejected.status, 'rejected');

    const job = await store.get(bookFileJobId('rejected-book-file', FILE_PATH));
    assert.ok(job, 'A rejected-book-file job must exist');
    assert.equal(job.kind, 'rejected-book-file');
    assert.equal(job.targetId, FILE_PATH);
    assert.equal(job.status, 'pending');
    assert.equal(job.attempts, 0);
    assert.equal(Date.parse(job.dueAt) - Date.parse(rejected.rejectionDate), REJECTED_BOOK_FILE_DELAY_MS);

    await moderation.rejectBook('book-no-file', 'Missing rights statement.', MODERATOR.uid);
    assert.equal((await store.listByStatus(['pending'], 10)).length, 1, 'A book without a stored file creates no job');

    // Scheduling twice for the same file keeps one job.
    await worker.scheduleRejectedBookFile(FILE_PATH, REJECTED_AT);
    assert.equal((await store.listByStatus(['pending'], 10)).length, 1);
  });

  test('TC-S2-032: worker claims and completes a due job, and not before it is due', async () => {
    const { store, storage, clock, worker } = setupWorker();
    const job = await worker.scheduleRejectedBookFile(FILE_PATH, REJECTED_AT);

    clock.advance(REJECTED_BOOK_FILE_DELAY_MS - 1000);
    assert.deepEqual(await worker.runDueJobs(), { claimed: 0, completed: 0, failed: 0 });
    assert.deepEqual(storage.deleted, []);

    clock.advance(1000);
    assert.deepEqual(await worker.runDueJobs(), { claimed: 1, completed: 1, failed: 0 });
    assert.deepEqual(storage.deleted, [FILE_PATH]);
    const completed = await store.get(job.id);
    assert.equal(completed.status, 'completed');
    assert.ok(completed.claimedAt, 'The claim timestamp is kept');
    assert.equal(completed.completedAt, clock.now().toISOString());
  });

  test('TC-S2-033: failed job retries with exponential backoff and a safe error', async () => {
    const { store, storage, clock, worker } = setupWorker();
    const job = await worker.scheduleDeletedBookFile(FILE_PATH);
    storage.failDeletes = 2;

    assert.deepEqual(await worker.runDueJobs(), { claimed: 1, completed: 0, failed: 1 });
    let current = await store.get(job.id);
    assert.equal(current.status, 'failed');
    assert.equal(current.attempts, 1);
    assert.equal(current.lastError, 'Book file storage failed (delete-object, HTTP 503).');
    assert.equal(Date.parse(current.nextAttemptAt) - clock.now().getTime(), retryDelayMs(1));
    assert.equal(retryDelayMs(1), 60_000);
    assert.equal(retryDelayMs(2), 120_000);
    assert.equal(retryDelayMs(3), 240_000);
    assert.equal(retryDelayMs(30), 6 * 60 * 60 * 1000, 'Backoff is capped at 6 hours');

    // Not retried before nextAttemptAt.
    clock.advance(retryDelayMs(1) - 1);
    assert.equal((await worker.runDueJobs()).claimed, 0);
    clock.advance(1);
    assert.equal((await worker.runDueJobs()).failed, 1);
    current = await store.get(job.id);
    assert.equal(current.attempts, 2);
    assert.equal(Date.parse(current.nextAttemptAt) - clock.now().getTime(), retryDelayMs(2));

    clock.advance(retryDelayMs(2));
    assert.equal((await worker.runDueJobs()).completed, 1);
    current = await store.get(job.id);
    assert.equal(current.status, 'completed');
    assert.equal(current.nextAttemptAt, undefined, 'A completed job has no next attempt');
    assert.ok(await store.get(job.id), 'Jobs are never deleted from the store');
  });

  test('TC-S2-033: retries stop after MAX_ATTEMPTS and the job stays failed for review', async () => {
    const { store, storage, clock, worker } = setupWorker();
    const job = await worker.scheduleDeletedBookFile(FILE_PATH);
    storage.failDeletes = MAX_ATTEMPTS + 5;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      assert.equal((await worker.runDueJobs()).failed, 1, `attempt ${attempt}`);
      clock.advance(retryDelayMs(attempt));
    }
    const exhausted = await store.get(job.id);
    assert.equal(exhausted.status, 'failed');
    assert.equal(exhausted.attempts, MAX_ATTEMPTS);
    assert.equal(exhausted.nextAttemptAt, undefined);
    clock.advance(24 * 60 * 60 * 1000);
    assert.equal((await worker.runDueJobs()).claimed, 0, 'An exhausted job is not retried automatically');
  });

  test('TC-S2-034: completed job is never reprocessed; concurrent runs claim a job once', async () => {
    const { store, storage, clock, worker } = setupWorker();
    const job = await worker.scheduleDeletedBookFile(FILE_PATH);
    await worker.runDueJobs();
    const completedAt = (await store.get(job.id)).completedAt;

    clock.advance(60 * 60 * 1000);
    assert.deepEqual(await worker.runDueJobs(), { claimed: 0, completed: 0, failed: 0 });
    assert.equal((await store.get(job.id)).completedAt, completedAt);
    assert.deepEqual(storage.deleted, [FILE_PATH]);

    // Two runs at the same time: only one claims each job.
    const second = await worker.scheduleDeletedBookFile('books/book-2/1/other.pdf');
    const [first, other] = await Promise.all([worker.runDueJobs(), worker.runDueJobs()]);
    assert.equal(first.claimed + other.claimed, 1);
    assert.equal((await store.get(second.id)).status, 'completed');

    // A job completed by another run between listing and claiming is not claimed again.
    const raced = await worker.scheduleDeletedBookFile('books/book-4/1/raced.pdf');
    const racingStore = Object.create(store);
    racingStore.claim = async (id, canClaim, claim) => {
      await store.update(id, { status: 'completed', completedAt: clock.now().toISOString() });
      return store.claim(id, canClaim, claim);
    };
    const racingWorker = new DeletionJobService(racingStore, storage, clock.now);
    assert.deepEqual(await racingWorker.runDueJobs(), { claimed: 0, completed: 0, failed: 0 });
    assert.equal((await store.get(raced.id)).status, 'completed');
    assert.equal(storage.deleted.includes('books/book-4/1/raced.pdf'), false);

    // A run that crashed after claiming is recovered after STALE_CLAIM_MS.
    const stale = await worker.scheduleDeletedBookFile('books/book-3/1/stale.pdf');
    await store.update(stale.id, { status: 'processing', claimedAt: clock.now().toISOString() });
    assert.equal((await worker.runDueJobs()).claimed, 0);
    clock.advance(STALE_CLAIM_MS);
    assert.equal((await worker.runDueJobs()).completed, 1);
  });

  test('stale workers cannot overwrite a reclaimed job result', async () => {
    for (const originalFails of [false, true]) {
      const {store, storage, clock, worker} = setupWorker();
      const job = await worker.scheduleDeletedBookFile(FILE_PATH);
      let releaseFirst;
      let firstStarted;
      const started = new Promise(resolve => {firstStarted = resolve;});
      let calls = 0;
      storage.deleteObject = async () => {
        calls++;
        if (calls === 1) {
          firstStarted();
          await new Promise(resolve => {releaseFirst = resolve;});
          if (originalFails) throw new Error('old delete failed');
        }
      };
      const originalRun = worker.runDueJobs();
      await started;
      clock.advance(STALE_CLAIM_MS);
      const reclaimed = await worker.runDueJobs();
      assert.equal(reclaimed.completed, 1);
      const completed = await store.get(job.id);
      releaseFirst();
      const original = await originalRun;
      assert.deepEqual(original, {claimed:1, completed:0, failed:0});
      assert.deepEqual(await store.get(job.id), completed);
      assert.equal(completed.status, 'completed');
    }
  });

  test('a failed completion write surfaces an error instead of reporting a failed delete', async () => {
    const {store, storage, clock, worker} = setupWorker();
    const job = await worker.scheduleDeletedBookFile(FILE_PATH);
    const failingStore = Object.create(store);
    failingStore.finishClaim = async () => {throw new Error('database unavailable');};
    await assert.rejects(new DeletionJobService(failingStore, storage, clock.now).runDueJobs(), /database unavailable/);
    assert.equal((await store.get(job.id)).status, 'processing');
  });

  test('TC-S2-034: account-data jobs are left pending and untouched', async () => {
    const { store, storage, clock, worker } = setupWorker();
    const accountJob = {
      id: 'account-job-1', kind: 'account-data', targetId: 'user-1',
      dueAt: '2026-01-01T00:00:00.000Z', status: 'pending', attempts: 0,
    };
    await store.createIfAbsent(accountJob);
    clock.advance(365 * 24 * 60 * 60 * 1000);
    assert.deepEqual(await worker.runDueJobs(), { claimed: 0, completed: 0, failed: 0 });
    assert.deepEqual(await store.get('account-job-1'), accountJob);
    assert.deepEqual(storage.deleted, []);
  });

  test('TC-S2-035: permanent deletion and file replacement create immediate cleanup jobs', async () => {
    const { store, clock, worker } = setupWorker();
    const books = new BookRepository();
    await books.save(makeBook({ status: 'approved', fileObjectPath: FILE_PATH }));
    const bookService = new BookService(books, worker);

    const deleted = await bookService.deleteBook('book-1', MODERATOR.uid);
    assert.equal(deleted.status, 'deleted');
    const job = await store.get(bookFileJobId('deleted-book-file', FILE_PATH));
    assert.equal(job.kind, 'deleted-book-file');
    assert.equal(job.dueAt, clock.now().toISOString());
    assert.equal(job.status, 'pending');

    // Deleting again keeps a single job, so a failed scheduling can be retried safely.
    await bookService.deleteBook('book-1', MODERATOR.uid);
    assert.equal((await store.listByStatus(['pending'], 10)).length, 1);

    // Replacing a file schedules the previous object.
    const fileBooks = new BookRepository();
    await fileBooks.save(makeBook({ id: 'book-r', fileObjectPath: 'books/book-r/2/old.pdf' }));
    const fakeStorage = new FakeBookFileStorage();
    const files = new BookFileService(fileBooks, fakeStorage, clock.now, worker);
    const { objectPath } = await files.createUploadUrl('book-r', OWNER, validUploadRequest());
    fakeStorage.objects.set(objectPath, { sizeBytes: 1000, mimeType: 'application/pdf' });
    await files.completeUpload('book-r', OWNER, { objectPath, revision: 3 });
    const replaced = await store.get(bookFileJobId('deleted-book-file', 'books/book-r/2/old.pdf'));
    assert.equal(replaced.status, 'pending');
    assert.equal(replaced.dueAt, clock.now().toISOString());
  });

  test('TC-S2-035: a scheduling failure is reported, never silent', async () => {
    const books = new BookRepository();
    await books.save(makeBook({ status: 'approved', fileObjectPath: FILE_PATH }));
    const failingScheduler = {
      scheduleDeletedBookFile: async () => { throw new Error('firestore down'); },
      scheduleRejectedBookFile: async () => { throw new Error('firestore down'); },
    };
    await assert.rejects(new BookService(books, failingScheduler).deleteBook('book-1', MODERATOR.uid), DeletionScheduleError);
  });

  test('S2-T08: worker route accepts only the deletion worker secret', async () => {
    const secret = 'x'.repeat(40);
    assert.equal(isWorkerAuthorized(`Bearer ${secret}`, secret), true);
    assert.equal(isWorkerAuthorized(`Bearer ${secret}x`, secret), false);
    assert.equal(isWorkerAuthorized(secret, secret), false);
    assert.equal(isWorkerAuthorized(undefined, secret), false);
    assert.equal(isWorkerAuthorized('Bearer short', 'short'), false, 'Short secrets are refused');

    const run = async (authorization, configured) => {
      const previous = process.env.DELETION_WORKER_SECRET;
      if (configured === undefined) delete process.env.DELETION_WORKER_SECRET;
      else process.env.DELETION_WORKER_SECRET = configured;
      const result = { status: 200, body: null, nextCalled: false };
      const response = { status(code) { result.status = code; return this; }, json(body) { result.body = body; return this; } };
      try {
        requireWorkerSecret({ headers: { authorization } }, response, () => { result.nextCalled = true; });
      } finally {
        if (previous === undefined) delete process.env.DELETION_WORKER_SECRET;
        else process.env.DELETION_WORKER_SECRET = previous;
      }
      return result;
    };
    assert.equal((await run(`Bearer ${secret}`, secret)).nextCalled, true);
    assert.equal((await run('Bearer wrong', secret)).status, 401);
    assert.equal((await run(undefined, secret)).body.error.code, 'AUTH_REQUIRED');
    assert.equal((await run(`Bearer ${secret}`, undefined)).status, 503);

    const server = readFileSync(join(repoRoot, 'apps/backend/src/server.ts'), 'utf8');
    assert.match(server, /app\.use\("\/api\/v1\/internal", internalRouter\);/);
    const routes = readFileSync(join(repoRoot, 'apps/backend/src/routes/internal-routes.ts'), 'utf8');
    assert.match(routes, /internalRouter\.post\("\/deletion-jobs\/run", requireWorkerSecret, runDeletionJobs\);/);
  });

  test('S2-T08: scheduled workflow calls the worker route with repository secrets only', () => {
    const workflow = readFileSync(join(repoRoot, '.github/workflows/deletion-worker.yml'), 'utf8');
    assert.match(workflow, /cron: "\*\/15 \* \* \* \*"/);
    assert.match(workflow, /RENDER_BACKEND_URL: \$\{\{ secrets\.RENDER_BACKEND_URL \}\}/);
    assert.match(workflow, /DELETION_WORKER_SECRET: \$\{\{ secrets\.DELETION_WORKER_SECRET \}\}/);
    assert.match(workflow, /\/api\/v1\/internal\/deletion-jobs\/run/);
    assert.match(workflow, /^permissions: \{\}$/m);
    assert.equal(SECRET_VALUE_PATTERN.test(workflow), false);
  });
});

// ===========================================================================
// S2-AC-010: Deployment (SPEC-002 §8)
// ===========================================================================

describe('S2-AC-010: Deployment', () => {
  test('TC-S2-053: health handler returns 200 HealthResponse without authentication', () => {
    const result = { status: null, body: null, headers: {} };
    const response = {
      setHeader(name, value) { result.headers[name] = value; },
      status(code) { result.status = code; return this; },
      json(body) { result.body = body; return this; },
    };
    healthHandler({ headers: {} }, response);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { status: 'ok', service: 'library-flow-api' });
    assert.equal(result.headers['Cache-Control'], 'no-store');

    const server = readFileSync(join(repoRoot, 'apps/backend/src/server.ts'), 'utf8');
    assert.match(server, /app\.get\("\/health", healthHandler\);/, '/health must be registered without a guard');
    const render = readFileSync(join(repoRoot, 'render.yaml'), 'utf8');
    assert.match(render, /healthCheckPath: \/health/, 'Render must use /health as its health check');
  });

  test('TC-S2-053/054/058: deploy:check passes for a healthy deployment, waking a sleeping instance', async () => {
    const { checks } = await checkDeployment(RENDER_URL, NETLIFY_ORIGIN, { fetchImpl: createFakeDeployment({ sleepyResponses: 2 }), ...noWait });
    assert.deepEqual(checks.filter((check) => !check.passed), []);
    assert.equal(checks.length, 7);
    assert.deepEqual([...new Set(checks.map((check) => check.id))].sort(), ['TC-S2-053', 'TC-S2-054', 'TC-S2-056', 'TC-S2-058']);
  });

  test('TC-S2-054: deploy:check reports a wildcard CORS deployment', async () => {
    const { checks } = await checkDeployment(RENDER_URL, NETLIFY_ORIGIN, { fetchImpl: createFakeDeployment({ wildcardCors: true }), ...noWait });
    const failed = checks.filter((check) => !check.passed).map((check) => check.name);
    assert.ok(failed.includes('CORS gives no allow header to an untrusted origin'));
    assert.ok(failed.includes('CORS allows the configured frontend origin'));
    assert.equal(UNTRUSTED_ORIGIN.endsWith('.invalid'), true);
  });

  test('TC-S2-054: CORS allows only configured origins', () => {
    const netlify = 'https://libraryflow.netlify.app';
    const allowed = parseFrontendOrigins(`${netlify}, http://localhost:5173/`, 'production');

    assert.deepEqual(allowed, [netlify, 'http://localhost:5173']);
    assert.equal(isOriginAllowed(netlify, allowed), true);
    assert.equal(isOriginAllowed('https://evil.example.com', allowed), false);
    assert.equal(isOriginAllowed('https://evil.netlify.app', allowed), false);
    assert.equal(isOriginAllowed(`${netlify}.evil.example.com`, allowed), false);
    assert.equal(isOriginAllowed(undefined, allowed), false);

    const allowedHeaders = corsHeadersFor(netlify, allowed);
    assert.equal(allowedHeaders['Access-Control-Allow-Origin'], netlify);
    assert.equal(allowedHeaders.Vary, 'Origin');

    const blockedHeaders = corsHeadersFor('https://evil.example.com', allowed);
    assert.equal('Access-Control-Allow-Origin' in blockedHeaders, false);
    assert.equal(blockedHeaders.Vary, 'Origin');
  });

  test('TC-S2-054: wildcard and invalid FRONTEND_ORIGIN values are rejected', () => {
    for (const value of ['*', '*.netlify.app', 'https://*.netlify.app', 'netlify.app',
      'ftp://files.example.com', 'https://site.netlify.app/path', 'https://site.netlify.app?x=1']) {
      assert.throws(
        () => parseFrontendOrigins(value, 'production'),
        CorsConfigurationError,
        `Expected "${value}" to be rejected`,
      );
    }
  });

  test('TC-S2-054: production defaults to the exact Netlify origin; development defaults to localhost', () => {
    assert.deepEqual(parseFrontendOrigins(undefined, 'production'), [PRODUCTION_DEFAULT_ORIGIN]);
    assert.deepEqual(parseFrontendOrigins(' , ', 'production'), [PRODUCTION_DEFAULT_ORIGIN]);
    assert.deepEqual(parseFrontendOrigins('', 'production'), [PRODUCTION_DEFAULT_ORIGIN]);
    assert.deepEqual(parseFrontendOrigins(undefined, 'development'), [DEVELOPMENT_DEFAULT_ORIGIN]);
    assert.deepEqual(parseFrontendOrigins('', undefined), [DEVELOPMENT_DEFAULT_ORIGIN]);
  });

  test('TC-S2-055: no secrets in source or VITE_* variables', () => {
    const files = trackedFiles();

    // 1) No tracked environment file other than the example template.
    const envFiles = files.filter((file) => /(^|\/)\.env(\.|$)/.test(file) && !file.endsWith('.env.example'));
    assert.deepEqual(envFiles, [], 'Only .env.example may be tracked');

    // 2) No secret values anywhere in tracked text files.
    const valueLeaks = files.filter((file) => {
      const path = join(repoRoot, file);
      if (!existsSync(path) || statSync(path).size > 2_000_000) return false;
      return SECRET_VALUE_PATTERN.test(readFileSync(path, 'utf8'));
    });
    assert.deepEqual(valueLeaks, [], 'Tracked files must not contain private keys or JWT keys');

    // 3) Browser code and shared code never reference server secret names.
    const browserLeaks = files
      .filter((file) => file.startsWith('apps/frontend/') || file.startsWith('packages/shared/'))
      .filter((file) => SECRET_NAME_PATTERN.test(readFileSync(join(repoRoot, file), 'utf8')));
    assert.deepEqual(browserLeaks, [], 'Frontend and shared code must not reference server secrets');

    // 4) No VITE_ variable name carries a server secret.
    const unsafeViteNames = files
      .flatMap((file) => readFileSync(join(repoRoot, file), 'utf8').match(/VITE_[A-Z0-9_]+/g) ?? [])
      .filter((name) => /SERVICE_ROLE|PRIVATE_KEY|SECRET|WORKER/.test(name));
    assert.deepEqual([...new Set(unsafeViteNames)], [], 'VITE_ variables must contain public configuration only');
  });

  test('TC-S2-056: frontend code uses only public VITE_ variables', () => {
    const PUBLIC_VITE_NAMES = new Set([
      'VITE_API_BASE_URL', 'VITE_AUTH_MODE', 'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_AUTH_EMULATOR_HOST',
    ]);
    const sources = [
      ...trackedFiles().filter((file) => file.startsWith('apps/frontend/')),
      '.env.example', 'netlify.toml',
    ];
    const used = new Set(sources.flatMap((file) => readFileSync(join(repoRoot, file), 'utf8').match(/VITE_[A-Z0-9_]+/g) ?? []));
    const unexpected = [...used].filter((name) => !PUBLIC_VITE_NAMES.has(name));
    assert.deepEqual(unexpected, [], 'New VITE_ variables must be reviewed as public configuration first');
    for (const required of ['VITE_API_BASE_URL', 'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID']) {
      assert.ok(used.has(required), `${required} (SPEC-002 §8) must be documented or used`);
    }
  });

  test('TC-S2-056: deploy:check finds a server secret in a lazily loaded bundle chunk', async () => {
    const { checks } = await checkDeployment(RENDER_URL, NETLIFY_ORIGIN, { fetchImpl: createFakeDeployment({ leakInLazyChunk: true }), ...noWait });
    const bundleCheck = checks.find((check) => check.id === 'TC-S2-056');
    assert.equal(bundleCheck.passed, false);
    assert.match(bundleCheck.detail, /firebase-client-b2\.js/);
  });

  test('TC-S2-057: Firestore backup exports every collection, subcollection, and page', async () => {
    const books = {};
    for (let index = 0; index < PAGE_SIZE + 3; index += 1) {
      books[`book-${String(index).padStart(4, '0')}`] = { data: { title: `Book ${index}` } };
    }
    const timestamp = { seconds: 1, nanoseconds: 0, toDate: () => new Date('2026-11-24T12:00:00.000Z') };
    const db = createFakeFirestore({
      books,
      deletionJobs: { 'job-1': { data: { status: 'pending', dueAt: timestamp, attempts: 0 } } },
      users: { 'user-1': { data: { role: 'reader', tags: ['a', null] }, sub: { sessions: { 's-1': { data: { active: true } } } } } },
    });

    const { collections, counts } = await exportFirestore(db);
    assert.equal(collections.books.length, PAGE_SIZE + 3, 'Pagination must reach every document');
    assert.deepEqual(counts, { books: PAGE_SIZE + 3, deletionJobs: 1, users: 1, 'users/user-1/sessions': 1 });
    assert.deepEqual(collections.deletionJobs[0].data.dueAt, { __type: 'timestamp', value: '2026-11-24T12:00:00.000Z' });
    assert.deepEqual(collections.users[0].subcollections.sessions[0], { id: 's-1', data: { active: true } });
    assert.deepEqual(serializeValue({ point: { latitude: 1, longitude: 2 } }), { point: { __type: 'geopoint', latitude: 1, longitude: 2 } });
  });

  test('TC-S2-057: backup file is written once, checksummed, and its folder is git-ignored', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'lf-backup-'));
    try {
      const db = createFakeFirestore({ books: { 'b-1': { data: { title: 'One' } } } });
      const now = new Date('2026-11-24T12:00:00.000Z');
      const result = await writeBackup(db, { projectId: 'demo-project', outDir, now });
      const content = readFileSync(result.file, 'utf8');
      const parsed = JSON.parse(content);

      assert.equal(parsed.format, 'libraryflow-firestore-backup/v1');
      assert.equal(parsed.projectId, 'demo-project');
      assert.equal(result.totalDocuments, 1);
      assert.match(result.sha256, /^[0-9a-f]{64}$/);
      assert.equal(result.sha256, (await import('node:crypto')).createHash('sha256').update(content).digest('hex'));
      await assert.rejects(writeBackup(db, { projectId: 'demo-project', outDir, now }), /EEXIST/, 'A backup is never overwritten');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }

    const ignored = execFileSync('git', ['check-ignore', 'backups/firestore-demo.json'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    assert.equal(ignored, 'backups/firestore-demo.json');
    assert.ok(existsSync(join(repoRoot, 'docs/deployment/SPRINT-2-DEPLOYMENT.md')), 'Rollback procedure must be documented');
  });

  test('TC-S2-058: end-to-end round trip is a documented manual check', () => {
    // deploy:check covers connectivity, CORS, and the published bundle. The
    // signed-in round trip (login, submit an application) stays manual and is
    // recorded with the evidence template in SPRINT-2-DEPLOYMENT.md.
    const guide = readFileSync(join(repoRoot, 'docs/deployment/SPRINT-2-DEPLOYMENT.md'), 'utf8');
    assert.match(guide, /TC-S2-058/);
    assert.match(guide, /npm run deploy:check/);
  });
});
