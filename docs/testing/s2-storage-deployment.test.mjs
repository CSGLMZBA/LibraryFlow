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
    return `https://storage.test/storage/v1/object/upload/sign/book-files/${objectPath}?token=upload-token`;
  }
  async getObjectInfo(objectPath) {
    this.calls.push(['info', objectPath]);
    return this.objects.get(objectPath) ?? null;
  }
  async createSignedDownloadUrl(objectPath, expiresInSeconds) {
    this.calls.push(['download-url', objectPath, expiresInSeconds]);
    return `https://storage.test/storage/v1/object/sign/book-files/${objectPath}?token=download-token`;
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
  const service = new BookFileService(repository, storage, () => FIXED_NOW);
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
    const config = buildBookBucketConfig('book-files');
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
        SUPABASE_BOOK_BUCKET: 'book-files',
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
        return new Response(JSON.stringify({ url: '/object/upload/sign/book-files/books/b/1/a.pdf?token=t1' }));
      }
      if (url.includes('/object/sign/')) {
        return new Response(JSON.stringify({ signedURL: '/object/sign/book-files/books/b/1/a.pdf?token=t2' }));
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
      { url: 'https://project.supabase.co/', serviceRoleKey: FAKE_SERVICE_KEY, bucket: 'book-files' },
      fakeFetch,
    );

    const uploadUrl = await storage.createSignedUploadUrl('books/b/1/a.pdf');
    assert.equal(uploadUrl, 'https://project.supabase.co/storage/v1/object/upload/sign/book-files/books/b/1/a.pdf?token=t1');
    const downloadUrl = await storage.createSignedDownloadUrl('books/b/1/a.pdf', 600);
    assert.equal(downloadUrl, 'https://project.supabase.co/storage/v1/object/sign/book-files/books/b/1/a.pdf?token=t2');
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

  test('TC-S2-027: storage configuration is all-or-nothing', () => {
    assert.equal(createBookFileStorageFromEnv({}), null);
    assert.equal(createBookFileStorageFromEnv({ SUPABASE_BOOK_BUCKET: 'book-files' }), null);
    assert.ok(createBookFileStorageFromEnv({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE_KEY,
      SUPABASE_BOOK_BUCKET: 'book-files',
    }) instanceof SupabaseBookFileStorage);
    assert.throws(() => createBookFileStorageFromEnv({ SUPABASE_URL: 'https://project.supabase.co' }), /SUPABASE_SERVICE_ROLE_KEY/);
    assert.throws(() => createBookFileStorageFromEnv({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE_KEY,
    }), /SUPABASE_BOOK_BUCKET/);
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
    const unconfigured = new BookFileService(repository, null, () => FIXED_NOW);
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

describe('S2-AC-007: Scheduled Cleanup — Deletion Jobs', () => {
  test('TC-S2-031: rejection creates 24h deletion job', async () => {
    // STUB: awaiting S2-T08 deletion job creation
    // Expected: DeletionJob created with kind: "rejected-book-file",
    //           dueAt = rejectedAt + 24h, status: "pending", attempts: 0
    assert.ok(true, 'STUB: pending S2-T08 rejection job creation');
  });

  test('TC-S2-032: worker claims and completes a job', async () => {
    // STUB: awaiting S2-T08 worker implementation
    // Expected: pending → processing (claimedAt) → completed (completedAt);
    //           file removed from Supabase bucket
    assert.ok(true, 'STUB: pending S2-T08 worker claim/complete');
  });

  test('TC-S2-033: failed job retries with exponential backoff', async () => {
    // STUB: awaiting S2-T08 retry logic
    // Expected: status: "failed"; attempts incremented; lastError stored;
    //           nextAttemptAt set with backoff; job NOT deleted from database
    assert.ok(true, 'STUB: pending S2-T08 retry backoff');
  });

  test('TC-S2-034: completed job is never reprocessed', async () => {
    // STUB: awaiting S2-T08 idempotency guard
    // Expected: worker skips completed job; completedAt unchanged
    assert.ok(true, 'STUB: pending S2-T08 idempotency');
  });

  test('TC-S2-035: permanent deletion creates immediate cleanup job', async () => {
    // STUB: awaiting S2-T08 implementation
    // Expected: DeletionJob with kind: "deleted-book-file", dueAt = now,
    //           status: "pending"; book record marked "deleted"
    assert.ok(true, 'STUB: pending S2-T08 immediate deletion job');
  });
});

// ===========================================================================
// S2-AC-010: Deployment (SPEC-002 §8)
// ===========================================================================

describe('S2-AC-010: Deployment', () => {
  test('TC-S2-053: health endpoint is accessible and unauthenticated', async () => {
    // STUB: awaiting S2-T09 deployment
    // Verification (deployed):
    //   curl -s https://<render-url>/health | jq .
    // Expected: 200 HealthResponse; no authentication required
    assert.ok(true, 'STUB: pending S2-T09 deployment — manual verification');
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

  test('TC-S2-054: production requires FRONTEND_ORIGIN; development defaults to localhost', () => {
    assert.throws(() => parseFrontendOrigins(undefined, 'production'), CorsConfigurationError);
    assert.throws(() => parseFrontendOrigins(' , ', 'production'), CorsConfigurationError);
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

  test('TC-S2-056: frontend environment uses only public config', async () => {
    // STUB: awaiting S2-T09 Netlify configuration
    // Expected: only VITE_API_BASE_URL, VITE_FIREBASE_API_KEY,
    //           VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID
    assert.ok(true, 'STUB: pending S2-T09 environment verification — manual');
  });

  test('TC-S2-057: backup and rollback evidence', async () => {
    // STUB: awaiting S2-T09 backup/rollback implementation
    // Expected: backup captured → breaking deploy → rollback → health 200;
    //           no data loss
    assert.ok(true, 'STUB: pending S2-T09 backup/rollback — manual');
  });

  test('TC-S2-058: Netlify frontend communicates with Render backend', async () => {
    // STUB: awaiting S2-T09 full deployment
    // Expected: frontend API calls reach Render through CORS;
    //           full round-trip succeeds
    assert.ok(true, 'STUB: pending S2-T09 end-to-end — manual');
  });
});
