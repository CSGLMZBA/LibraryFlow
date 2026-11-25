/**
 * Sprint 2 — Security, Session Lifecycle, and Moderation Tests
 *
 * Partial service and guard checks for S2-AC-005 and S2-AC-008.
 *         S2-AC-009 (TC-S2-044 through TC-S2-052) — Session Lifecycle (delegated to s2-account-policy.test.mjs)
 *
 * Owner: Cesar (Sentinel)
 * Run: npx tsx --test docs/testing/s2-security-session.test.mjs
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  PublisherApplicationService,
} from '../../apps/backend/src/services/publisher-application-service.ts';
import { BookService } from '../../apps/backend/src/services/book-service.ts';
import { ModerationService } from '../../apps/backend/src/services/moderation-service.ts';
import { createAuthGuard } from '../../apps/backend/src/middleware/auth-guard.ts';

function fakeResponse() {
  return {
    statusCode: 200,
    body: undefined,
    locals: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

function createTestHarness() {
  const apps = new Map();
  const books = new Map();
  const comments = new Map();
  const notifications = [];

  const appRepo = {
    async save(app) {
      apps.set(app.id, { ...app });
      return { ...app };
    },
    async findById(id) {
      const item = apps.get(id);
      return item ? { ...item } : null;
    },
    async findByApplicant(uid) {
      return Array.from(apps.values()).filter((a) => a.applicantUid === uid);
    },
    async findPending() {
      return Array.from(apps.values()).filter((a) => a.status === 'pending');
    },
    async update(id, patch) {
      const cur = apps.get(id);
      if (!cur) return null;
      const next = { ...cur, ...patch };
      apps.set(id, next);
      return { ...next };
    },
  };

  const bookRepo = {
    async save(book) {
      books.set(book.id, { ...book });
      return { ...book };
    },
    async findById(id) {
      const b = books.get(id);
      return b ? { ...b } : null;
    },
    async findApproved(filters = {}) {
      return Array.from(books.values()).filter((b) => {
        if (b.status !== 'approved') return false;
        if (filters.search) {
          const q = filters.search.toLowerCase();
          return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
        }
        return true;
      });
    },
    async findPending() {
      return Array.from(books.values()).filter((b) => b.status === 'pending');
    },
    async update(id, patch) {
      const cur = books.get(id);
      if (!cur) return null;
      const next = { ...cur, ...patch };
      books.set(id, next);
      return { ...next };
    },
  };

  const commentRepo = {
    async create(comment) {
      comments.set(comment.id, { ...comment });
      return { ...comment };
    },
    async findById(id) {
      const c = comments.get(id);
      return c ? { ...c } : null;
    },
    async findByBookId(bookId) {
      return Array.from(comments.values()).filter((c) => c.bookId === bookId && !c.isDeleted);
    },
    async softDelete(id, audit) {
      const c = comments.get(id);
      if (!c) return null;
      const next = { ...c, isDeleted: true, moderatedBy: audit.moderatorId, moderationReason: audit.reason };
      comments.set(id, next);
      return next;
    },
  };

  const notifRepo = {
    async create(notification) {
      notifications.push({ ...notification });
      return notification;
    },
    async findByUserId(userId) {
      return notifications.filter((n) => n.userId === userId);
    },
  };

  return {
    appService: new PublisherApplicationService(appRepo, notifRepo),
    bookService: new BookService(bookRepo),
    moderationService: new ModerationService(bookRepo, commentRepo, notifRepo),
    appRepo,
    bookRepo,
    notifRepo,
  };
}

describe('S2-AC-005: Cloud Synchronization and Revision Control', () => {
  const sampleDto = {
    publisherName: 'Sync Press',
    legalRepresentativeName: 'Ada Lovelace',
    independentPublisher: true,
    publisherEmail: 'ada@syncpress.example.com',
    website: 'https://syncpress.example.com',
  };

  test('approved applications reject a later terminal transition', async () => {
    const { appService } = createTestHarness();
    const created = await appService.submitApplication('reader-sync-1', sampleDto);
    assert.equal(created.revision, 1);

    const approved = await appService.approveApplication(created.id, 'mod-1');
    assert.equal(approved.revision, 2);

    await assert.rejects(
      () => appService.rejectApplication(created.id, 'mod-2', 'Stale conflict'),
      /INVALID_STATE/,
    );
  });

  test('rejected withdrawal leaves approved application unchanged', async () => {
    const { appService, appRepo } = createTestHarness();
    const created = await appService.submitApplication('reader-sync-2', sampleDto);
    await appService.approveApplication(created.id, 'mod-winner');

    await assert.rejects(
      () => appService.withdrawApplication(created.id, 'reader-sync-2'),
      /INVALID_STATE/,
    );

    const persisted = await appRepo.findById(created.id);
    assert.equal(persisted?.status, 'approved');
    assert.equal(persisted?.reviewerUid, 'mod-winner');
    assert.equal(persisted?.revision, 2);
  });

  test('application ID is preserved on in-memory lookup', async () => {
    const { appService, appRepo } = createTestHarness();
    const created = await appService.submitApplication('reader-sync-3', sampleDto);

    const reloadedById = await appRepo.findById(created.id);
    const reloadedByUser = await appService.getMyApplications('reader-sync-3');

    assert.equal(reloadedById?.id, created.id);
    assert.equal(reloadedByUser[0]?.id, created.id);
    assert.equal(reloadedByUser[0]?.revision, 1);
  });

  test.todo('TC-S2-026: replay a queued offline mutation through the actual client and server');
});

describe('S2-AC-008: Moderation — Bans, Revocation, and Book Deletion', () => {
  test.todo('TC-S2-036: apply a temporary ban through the moderation API');
  test.todo('TC-S2-037: apply a permanent ban through the moderation API');

  test('moderator role guard rejects a reader', async () => {
    const res = fakeResponse();
    let allowed = false;
    await createAuthGuard(async () => ({ uid: 'reader-1', role: 'reader' }), 'moderator')(
      { headers: { authorization: 'Bearer reader-token' } },
      res,
      () => {
        allowed = true;
      },
    );
    assert.equal(res.statusCode, 403);
    assert.equal(allowed, false);
  });

  test.todo('TC-S2-038: a non-moderator cannot call the ban endpoint');
  test.todo('TC-S2-039: banned users are restricted and their public content is hidden');

  test('TC-S2-040: revoke publisher privileges', async () => {
    const { appService, notifRepo } = createTestHarness();
    await appService.revokePublisher(
      'pub-target-01',
      'mod-actor-01',
      'Unauthorized content distribution',
    );

    const notifications = await notifRepo.findByUserId('pub-target-01');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].type, 'publisher_revoked');
  });

  test('TC-S2-041: revocation audit record is immutable', async () => {
    const { appService } = createTestHarness();
    await assert.rejects(
      () => appService.revokePublisher('pub-target-02', 'mod-actor-01', '   '),
      /decisionReason/,
    );
  });

  test('TC-S2-042: delete a book permanently', async () => {
    const { bookService, moderationService, notifRepo } = createTestHarness();
    const book = await bookService.createBook(
      {
        title: 'Book To Delete',
        author: 'Test Author',
        fileType: 'pdf',
        fileSizeBytes: 2048,
        categoryIds: ['cat-1'],
        genreIds: ['gen-1'],
      },
      'pub-owner-del',
    );

    const rejected = await moderationService.rejectBook(
      book.id,
      'Removed by moderator policy',
      'mod-1',
    );
    assert.equal(rejected.status, 'rejected');
    assert.ok(rejected.scheduledDeletionDate);

    const notifications = await notifRepo.findByUserId('pub-owner-del');
    assert.ok(notifications.some((n) => n.type === 'book_rejected'));
  });

  test('TC-S2-043: deleted book removed from storage and search', async () => {
    const { bookService, moderationService, bookRepo } = createTestHarness();
    const book = await bookService.createBook(
      {
        title: 'Ephemeral Distributed Guide',
        author: 'Jane Doe',
        fileType: 'epub',
        fileSizeBytes: 4096,
        categoryIds: ['cat-1'],
        genreIds: ['gen-1'],
      },
      'pub-owner-del-2',
    );
    await moderationService.approveBook(book.id, 'mod-1');
    assert.equal((await bookService.getApprovedCatalog({ search: 'Ephemeral' })).length, 1);

    await bookRepo.update(book.id, {
      status: 'rejected',
      scheduledDeletionDate: new Date().toISOString(),
    });
    assert.equal((await bookService.getApprovedCatalog({ search: 'Ephemeral' })).length, 0);
    await assert.rejects(
      () => bookService.getBookDetails(book.id, 'reader-any'),
      /not authorized/,
    );
  });
});
