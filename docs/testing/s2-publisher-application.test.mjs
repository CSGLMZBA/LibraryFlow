/**
 * Sprint 2 — Publisher Application Acceptance Tests
 *
 * Covers: S2-AC-001 (TC-S2-001 through TC-S2-010)
 *         S2-AC-002 (TC-S2-011 through TC-S2-014)
 *         S2-AC-003 (TC-S2-015 through TC-S2-018)
 *         S2-AC-004 (TC-S2-019 through TC-S2-022)
 *
 * Owner: Cesar (Sentinel)
 * Run: npx tsx --test docs/testing/s2-publisher-application.test.mjs
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  publisherApplicationRepository,
} from '../../apps/backend/src/repositories/publisher-application-repository.ts';
import {
  PublisherApplicationService,
  publisherApplicationService,
} from '../../apps/backend/src/services/publisher-application-service.ts';
import {
  notificationRepository,
} from '../../apps/backend/src/repositories/notification-repository.ts';
import { parseRegistration } from '../../apps/backend/src/schemas/auth-schema.ts';
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

function createIsolatedService(options = {}) {
  const apps = new Map();
  const notifications = [];

  const appRepo = {
    async save(app) {
      apps.set(app.id, { ...app });
      return { ...app };
    },
    async findById(id) {
      const found = apps.get(id);
      return found ? { ...found } : null;
    },
    async findByApplicant(applicantUid) {
      return Array.from(apps.values())
        .filter((a) => a.applicantUid === applicantUid)
        .map((a) => ({ ...a }));
    },
    async findPending() {
      return Array.from(apps.values())
        .filter((a) => a.status === 'pending')
        .map((a) => ({ ...a }));
    },
    async update(id, patch) {
      const current = apps.get(id);
      if (!current) return null;
      const updated = { ...current, ...patch };
      apps.set(id, updated);
      return { ...updated };
    },
  };

  const notifRepo = {
    async create(notification) {
      if (options.failNotificationWrite) {
        throw new Error('NOTIFICATION_WRITE_FAILED');
      }
      notifications.push({ ...notification });
      return notification;
    },
    async findByUserId(userId) {
      return notifications.filter((n) => n.userId === userId);
    },
  };

  return {
    service: new PublisherApplicationService(appRepo, notifRepo),
    appRepo,
    notifRepo,
  };
}

// ===========================================================================
// S2-AC-001: Publisher Application Submission (US-REA-013)
// ===========================================================================

describe('S2-AC-001: Publisher Application Submission', () => {
  const validApplication = {
    publisherName: 'Northstar Publishing',
    legalRepresentativeName: 'Juan Carlos Zuniga Alfaro',
    independentPublisher: true,
    publisherEmail: 'northstar@example.com',
    website: 'https://northstar.example.com',
  };

  test('TC-S2-001: submit a valid publisher application', async () => {
    const before = Date.now();
    const application = await publisherApplicationService.submitApplication(
      'reader-s2-ac-001',
      validApplication,
    );
    const after = Date.now();

    assert.equal(application.status, 'pending');
    assert.equal(application.revision, 1);

    const expiresAt = new Date(application.expiresAt).getTime();
    const expectedMinimum = before + 30 * 24 * 60 * 60 * 1000;
    const expectedMaximum = after + 30 * 24 * 60 * 60 * 1000;
    assert.ok(expiresAt >= expectedMinimum);
    assert.ok(expiresAt <= expectedMaximum);

    const stored = await publisherApplicationRepository.findById(application.id);
    assert.deepEqual(stored, application);
  });

  test('TC-S2-002: reject invalid application fields', async () => {
    await assert.rejects(
      () =>
        publisherApplicationService.submitApplication('reader-invalid-fields', {
          ...validApplication,
          publisherName: '   ',
        }),
      /publisherName must contain between/,
    );

    await assert.rejects(
      () =>
        publisherApplicationService.submitApplication('reader-invalid-fields', {
          ...validApplication,
          publisherEmail: 'invalid-email-format',
        }),
      /publisherEmail must be a valid email address/,
    );

    await assert.rejects(
      () =>
        publisherApplicationService.submitApplication('reader-invalid-fields', {
          ...validApplication,
          website: 'http://insecure-site.example.com',
        }),
      /website must be a valid HTTPS URL/,
    );
  });

  test('TC-S2-003: prevent duplicate active application', async () => {
    await publisherApplicationService.submitApplication(
      'reader-s2-duplicate',
      validApplication,
    );

    await assert.rejects(
      () =>
        publisherApplicationService.submitApplication(
          'reader-s2-duplicate',
          validApplication,
        ),
      /DUPLICATE_ACTIVE_APPLICATION/,
    );
  });

  test('TC-S2-004: prevent application by approved publisher', async () => {
    const first = await publisherApplicationService.submitApplication(
      'reader-s2-already-approved',
      validApplication,
    );
    await publisherApplicationService.approveApplication(first.id, 'moderator-s2-001');

    await assert.rejects(
      () =>
        publisherApplicationService.submitApplication(
          'reader-s2-already-approved',
          validApplication,
        ),
      /DUPLICATE_ACTIVE_APPLICATION/,
    );
  });

  test('TC-S2-005: withdraw a pending application', async () => {
    const application = await publisherApplicationService.submitApplication(
      'reader-s2-withdraw-only',
      validApplication,
    );

    const withdrawn = await publisherApplicationService.withdrawApplication(
      application.id,
      'reader-s2-withdraw-only',
    );
    assert.equal(withdrawn.status, 'withdrawn');
    assert.equal(withdrawn.revision, 2);
  });

  test('TC-S2-006: reject withdrawal of non-pending application', async () => {
    const application = await publisherApplicationService.submitApplication(
      'reader-s2-withdraw-twice',
      validApplication,
    );

    await assert.rejects(
      () =>
        publisherApplicationService.withdrawApplication(
          application.id,
          'other-reader-uid',
        ),
      /FORBIDDEN/,
    );

    await publisherApplicationService.withdrawApplication(
      application.id,
      'reader-s2-withdraw-twice',
    );

    await assert.rejects(
      () =>
        publisherApplicationService.withdrawApplication(
          application.id,
          'reader-s2-withdraw-twice',
        ),
      /INVALID_STATE/,
    );
  });

  test('TC-S2-007: resubmit after rejection or withdrawal', async () => {
    const application = await publisherApplicationService.submitApplication(
      'reader-s2-withdraw',
      validApplication,
    );

    await publisherApplicationService.withdrawApplication(
      application.id,
      'reader-s2-withdraw',
    );

    const replacement = await publisherApplicationService.submitApplication(
      'reader-s2-withdraw',
      {
        ...validApplication,
        publisherName: 'Northstar Publishing 2',
      },
    );
    assert.equal(replacement.status, 'pending');
    assert.equal(replacement.revision, 1);
  });

  test('TC-S2-008: expire an unresolved 30-day pending application', async () => {
    const { service, appRepo, notifRepo } = createIsolatedService();
    const expiredDate = new Date(Date.now() - 60 * 1000).toISOString();
    await appRepo.save({
      id: 'app-expired-30d',
      applicantUid: 'reader-expired-30d',
      ...validApplication,
      status: 'pending',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      expiresAt: expiredDate,
      revision: 1,
    });

    const list = await service.getMyApplications('reader-expired-30d');
    assert.equal(list.length, 1);
    assert.equal(list[0].status, 'expired');
    assert.equal(list[0].revision, 2);

    const notifications = await notifRepo.findByUserId('reader-expired-30d');
    assert.ok(notifications.some((n) => n.type === 'publisher_application_expired'));
  });

  test('TC-S2-009: public registration never grants publisher', () => {
    const parsedReader = parseRegistration({
      email: 'PublicReader@Example.com',
      password: 'Password123!',
      requestedRole: 'reader',
    });
    assert.equal(parsedReader.requestedRole, 'reader');

    assert.throws(
      () =>
        parseRegistration({
          email: 'escalate@example.com',
          password: 'Password123!',
          requestedRole: 'moderator',
        }),
      { code: 'VALIDATION_ERROR', field: 'requestedRole' },
    );
  });

  test('TC-S2-010: only authenticated readers may submit applications', async () => {
    const unauthRes = fakeResponse();
    let unauthNext = false;
    await createAuthGuard(async () => null, 'reader')(
      { headers: {} },
      unauthRes,
      () => {
        unauthNext = true;
      },
    );
    assert.equal(unauthRes.statusCode, 401);
    assert.equal(unauthNext, false);

    const pubRes = fakeResponse();
    let pubNext = false;
    await createAuthGuard(async () => ({ uid: 'pub-1', role: 'publisher' }), 'reader')(
      { headers: { authorization: 'Bearer valid-pub' } },
      pubRes,
      () => {
        pubNext = true;
      },
    );
    assert.equal(pubRes.statusCode, 403);
    assert.equal(pubNext, false);

    const readerRes = fakeResponse();
    let readerNext = false;
    await createAuthGuard(async () => ({ uid: 'reader-1', role: 'reader' }), 'reader')(
      { headers: { authorization: 'Bearer valid-reader' } },
      readerRes,
      () => {
        readerNext = true;
      },
    );
    assert.equal(readerNext, true);
  });
});

// ===========================================================================
// S2-AC-002: Administrator Approval (US-MOD-005)
// ===========================================================================

describe('S2-AC-002: Administrator Approval', () => {
  const validApplication = {
    publisherName: 'Northstar Publishing',
    legalRepresentativeName: 'Juan Carlos Zuniga Alfaro',
    independentPublisher: true,
    publisherEmail: 'northstar@example.com',
    website: 'https://northstar.example.com',
  };

  test('TC-S2-011: approve a pending application atomically', async () => {
    const application = await publisherApplicationService.submitApplication(
      'reader-s2-approved',
      validApplication,
    );

    const approved = await publisherApplicationService.approveApplication(
      application.id,
      'moderator-s2-001',
    );

    assert.equal(approved.status, 'approved');
    assert.equal(approved.reviewerUid, 'moderator-s2-001');
    assert.equal(approved.revision, 2);
    assert.ok(approved.reviewedAt);

    const notifications =
      await notificationRepository.findByUserId('reader-s2-approved');
    assert.ok(
      notifications.some(
        (notification) =>
          notification.type === 'publisher_application_approved',
      ),
    );
  });

  test('TC-S2-012: non-moderator cannot approve', async () => {
    const res = fakeResponse();
    let nextCalled = false;
    await createAuthGuard(async () => ({ uid: 'reader-1', role: 'reader' }), 'moderator')(
      { headers: { authorization: 'Bearer reader-token' } },
      res,
      () => {
        nextCalled = true;
      },
    );
    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
  });

  test('TC-S2-013: approval transaction is atomic — no partial role grant', async () => {
    const { service, notifRepo } = createIsolatedService({ failNotificationWrite: true });
    const app = await service.submitApplication('reader-atomic-check', validApplication);

    await assert.rejects(
      () => service.approveApplication(app.id, 'moderator-s2-001'),
      /NOTIFICATION_WRITE_FAILED/,
    );

    const notifications = await notifRepo.findByUserId('reader-atomic-check');
    assert.equal(notifications.length, 0);
  });

  test('TC-S2-014: approval with stale revision is rejected', async () => {
    const { service } = createIsolatedService();
    const app = await service.submitApplication('reader-stale-approve', validApplication);
    const firstApproval = await service.approveApplication(app.id, 'moderator-1');
    assert.equal(firstApproval.revision, 2);

    await assert.rejects(
      () => service.approveApplication(app.id, 'moderator-2'),
      /INVALID_STATE/,
    );
  });
});

// ===========================================================================
// S2-AC-003: Administrator Rejection (US-MOD-005, US-REA-013)
// ===========================================================================

describe('S2-AC-003: Administrator Rejection', () => {
  const validApplication = {
    publisherName: 'Northstar Publishing',
    legalRepresentativeName: 'Juan Carlos Zuniga Alfaro',
    independentPublisher: true,
    publisherEmail: 'northstar@example.com',
    website: 'https://northstar.example.com',
  };

  test('TC-S2-015: reject a pending application with reason', async () => {
    const application = await publisherApplicationService.submitApplication(
      'reader-s2-rejected',
      validApplication,
    );

    const rejected = await publisherApplicationService.rejectApplication(
      application.id,
      'moderator-s2-002',
      'The publisher identity could not be verified.',
    );

    assert.equal(rejected.status, 'rejected');
    assert.equal(
      rejected.decisionReason,
      'The publisher identity could not be verified.',
    );
    assert.equal(rejected.revision, 2);

    const notifications =
      await notificationRepository.findByUserId('reader-s2-rejected');
    assert.ok(
      notifications.some(
        (notification) =>
          notification.type === 'publisher_application_rejected',
      ),
    );
  });

  test('TC-S2-016: reject without reason or with invalid reason', async () => {
    const application = await publisherApplicationService.submitApplication(
      'reader-s2-rejected-empty-reason',
      validApplication,
    );

    await assert.rejects(
      () =>
        publisherApplicationService.rejectApplication(
          application.id,
          'moderator-s2-002',
          ' ',
        ),
      /decisionReason/,
    );
  });

  test('TC-S2-017: reject non-pending application', async () => {
    const { service } = createIsolatedService();
    const app = await service.submitApplication('reader-reject-twice', validApplication);
    await service.rejectApplication(app.id, 'moderator-1', 'Incomplete documentation.');

    await assert.rejects(
      () => service.rejectApplication(app.id, 'moderator-1', 'Duplicate rejection'),
      /INVALID_STATE/,
    );
  });

  test('TC-S2-018: rejection never grants publisher privileges', async () => {
    const { service } = createIsolatedService();
    const app = await service.submitApplication('reader-rejected-guard', validApplication);
    const rejected = await service.rejectApplication(
      app.id,
      'moderator-1',
      'Insufficient verification.',
    );
    assert.equal(rejected.status, 'rejected');

    const res = fakeResponse();
    let nextCalled = false;
    await createAuthGuard(
      async () => ({ uid: 'reader-rejected-guard', role: 'reader' }),
      'publisher',
    )({ headers: { authorization: 'Bearer rejected-reader' } }, res, () => {
      nextCalled = true;
    });
    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
  });
});

// ===========================================================================
// S2-AC-004: Upload Authorization (US-REA-013 RN-006, US-MOD-005 RN-004)
// ===========================================================================

describe('S2-AC-004: Upload Authorization', () => {
  test('TC-S2-019: reader cannot create books or upload', async () => {
    const res = fakeResponse();
    let allowed = false;
    await createAuthGuard(async () => ({ uid: 'reader-only', role: 'reader' }), 'publisher')(
      { headers: { authorization: 'Bearer reader-token' } },
      res,
      () => {
        allowed = true;
      },
    );
    assert.equal(res.statusCode, 403);
    assert.equal(allowed, false);
  });

  test('TC-S2-020: pending applicant cannot create books or upload', async () => {
    const res = fakeResponse();
    let allowed = false;
    await createAuthGuard(
      async () => ({ uid: 'reader-pending-app', role: 'reader' }),
      'publisher',
    )({ headers: { authorization: 'Bearer pending-applicant-token' } }, res, () => {
      allowed = true;
    });
    assert.equal(res.statusCode, 403);
    assert.equal(allowed, false);
  });

  test('TC-S2-021: rejected applicant cannot create books or upload', async () => {
    const res = fakeResponse();
    let allowed = false;
    await createAuthGuard(
      async () => ({ uid: 'reader-rejected-app', role: 'reader' }),
      'publisher',
    )({ headers: { authorization: 'Bearer rejected-applicant-token' } }, res, () => {
      allowed = true;
    });
    assert.equal(res.statusCode, 403);
    assert.equal(allowed, false);
  });

  test('TC-S2-022: revoked publisher cannot create books or upload', async () => {
    const { service, notifRepo } = createIsolatedService();
    await service.revokePublisher(
      'pub-revoked-01',
      'moderator-s2-001',
      'Repeated copyright infringement.',
    );

    const notifications = await notifRepo.findByUserId('pub-revoked-01');
    assert.ok(notifications.some((n) => n.type === 'publisher_revoked'));

    const res = fakeResponse();
    let allowed = false;
    await createAuthGuard(
      async () => ({ uid: 'pub-revoked-01', role: 'reader' }),
      'publisher',
    )({ headers: { authorization: 'Bearer revoked-pub-token' } }, res, () => {
      allowed = true;
    });
    assert.equal(res.statusCode, 403);
    assert.equal(allowed, false);
  });
});