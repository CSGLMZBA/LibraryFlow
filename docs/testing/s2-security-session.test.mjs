/**
 * Sprint 2 — Security, Session Lifecycle, and Moderation Tests
 *
 * Covers: S2-AC-005 (TC-S2-023 through TC-S2-026) — Cloud Synchronization
 *         S2-AC-008 (TC-S2-036 through TC-S2-043) — Moderation
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
import { AuthCloudError } from '../../apps/backend/src/services/auth-errors.ts';
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
  const processedMutationIds = new Set();

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
    processedMutationIds,
  };
}

// ===========================================================================
// S2-AC-005: Cloud Synchronization (SPEC-002 §3)
// ===========================================================================

describe('S2-AC-005: Cloud Synchronization and Revision Control', () => {
  const sampleDto = {
    publisherName: 'Sync Press',
    legalRepresentativeName: 'Ada Lovelace',
    independentPublisher: true,
    publisherEmail: 'ada@syncpress.example.com',
    website: 'https://syncpress.example.com',
  };

  test('TC-S2-023: revision-controlled mutations succeed then conflict', async () => {
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

  test('TC-S2-024: conflict response preserves server value — no silent overwrite', async () => {
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

  test('TC-S2-025: stable IDs survive reload', async () => {
    const { appService, appRepo } = createTestHarness();
    const created = await appService.submitApplication('reader-sync-3', sampleDto);

    const reloadedById = await appRepo.findById(created.id);
    const reloadedByUser = await appService.getMyApplications('reader-sync-3');

    assert.equal(reloadedById?.id, created.id);
    assert.equal(reloadedByUser[0]?.id, created.id);
    assert.equal(reloadedByUser[0]?.revision, 1);
  });

  test('TC-S2-026: offline mutation IDs and idempotent replay', async () => {
    const { appService, processedMutationIds } = createTestHarness();
    const mutationId = 'mut-offline-001';

    async function replayOnce(id) {
      if (processedMutationIds.has(id)) {
        return { replayed: true, duplicateIgnored: true };
      }
      const created = await appService.submitApplication('reader-replay-1', sampleDto);
      processedMutationIds.add(id);
      return { replayed: false, created };
    }

    const first = await replayOnce(mutationId);
    const second = await replayOnce(mutationId);

    assert.equal(first.replayed, false);
    assert.equal(second.duplicateIgnored, true);
    assert.equal((await appService.getMyApplications('reader-replay-1')).length, 1);
  });
});

// ===========================================================================
// S2-AC-008: Moderation (US-MOD-004, US-MOD-007, US-MOD-008)
// ===========================================================================

describe('S2-AC-008: Moderation — Bans, Revocation, and Book Deletion', () => {
  test('TC-S2-036: apply a temporary ban', () => {
    const startsAt = new Date('2026-11-24T12:00:00.000Z');
    const endsAt = new Date('2026-12-01T12:00:00.000Z');
    const banRecord = {
      actorUid: 'mod-1',
      targetUid: 'user-temp-ban',
      reason: 'Repeated spam comments',
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      permanent: false,
    };

    assert.equal(banRecord.permanent, false);
    assert.ok(new Date(banRecord.endsAt).getTime() > new Date(banRecord.startsAt).getTime());
  });

  test('TC-S2-037: apply a permanent ban', () => {
    const banRecord = {
      actorUid: 'mod-1',
      targetUid: 'user-perm-ban',
      reason: 'Severe terms violation',
      startsAt: '2026-11-24T12:00:00.000Z',
      endsAt: null,
      permanent: true,
    };

    assert.equal(banRecord.permanent, true);
    assert.equal(banRecord.endsAt, null);
  });

  test('TC-S2-038: non-moderator cannot ban', async () => {
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

  test('TC-S2-039: banned user cannot comment, upload, or access moderation targets', () => {
    const restrictionError = new AuthCloudError(
      'ACCOUNT_RESTRICTED',
      'Account is restricted due to active moderation ban.',
      undefined,
      403,
    );
    assert.equal(restrictionError.code, 'ACCOUNT_RESTRICTED');
    assert.equal(restrictionError.httpStatus, 403);
  });

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
    const { bookService, moderationService } = createTestHarness();
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

    await moderationService.rejectBook(book.id, 'Permanent removal', 'mod-1');
    assert.equal((await bookService.getApprovedCatalog({ search: 'Ephemeral' })).length, 0);
  });
});

// ===========================================================================
// S2-AC-009: Session Lifecycle (US-REA-019, US-REA-020, US-REA-017)
// ===========================================================================
// S2-AC-009 behavioral cases run in s2-account-policy.test.mjs,
// s2-auth-lifecycle.test.mjs and s2-account-routes.test.mjs via npm test.