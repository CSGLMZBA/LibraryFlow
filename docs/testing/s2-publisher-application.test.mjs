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
  PublisherApplicationRepository,
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
import { createModerationRouter } from '../../apps/backend/src/routes/moderation-routes.ts';
import { createPublisherApplicationRouter } from '../../apps/backend/src/routes/publisher-application-routes.ts';

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

test('publisher application routes authorize only verified readers', async () => {
  const guard = createAuthGuard(async token => ({
    reader: {uid: 'reader-route', role: 'reader'},
    publisher: {uid: 'publisher-route', role: 'publisher'},
    moderator: {uid: 'moderator-route', role: 'moderator'},
  })[token] ?? null, 'reader');
  const router = createPublisherApplicationRouter(guard);
  const dispatch = (method, url, token, body) => new Promise((resolve, reject) => {
    const response = fakeResponse();
    response.json = function (data) { this.body = data; resolve(this); return this; };
    router.handle({method, url, body, headers: token ? {authorization: `Bearer ${token}`} : {}},
      response, error => reject(error ?? new Error('Route not handled')));
  });
  const application = {
    publisherName: 'Reader Route Publishing',
    legalRepresentativeName: 'Reader Route Representative',
    independentPublisher: true,
    publisherEmail: 'reader-route@example.com',
  };
  for (const [method, path] of [['POST', '/'], ['GET', '/me'], ['POST', '/missing/withdraw']]) {
    assert.equal((await dispatch(method, path, undefined, application)).statusCode, 401);
    assert.equal((await dispatch(method, path, 'publisher', application)).statusCode, 403);
    assert.equal((await dispatch(method, path, 'moderator', application)).statusCode, 403);
  }
  const created = await dispatch('POST', '/', 'reader', application);
  assert.equal(created.statusCode, 201);
  const listed = await dispatch('GET', '/me', 'reader');
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.data[0].id, created.body.data.id);
  for (const body of [undefined, {}, {revision: 0}, {revision: 1.5}, {revision: '1'}]) {
    assert.equal((await dispatch('POST', `/${created.body.data.id}/withdraw`, 'reader', body)).statusCode, 400);
  }
  const stale = await dispatch('POST', `/${created.body.data.id}/withdraw`, 'reader', {revision: 2});
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.body.error.code, 'REVISION_CONFLICT');
  assert.equal(stale.body.data.serverRevision, 1);
  assert.equal(stale.body.data.serverValue.status, 'pending');
  const withdrawn = await dispatch('POST', `/${created.body.data.id}/withdraw`, 'reader', {revision: 1});
  assert.equal(withdrawn.statusCode, 200);
  assert.equal(withdrawn.body.data.status, 'withdrawn');
});

test('concurrent withdrawal and rejection cannot both change one in-memory revision', async () => {
  const repository = new PublisherApplicationRepository();
  const notifications = [];
  const service = new PublisherApplicationService(repository, {
    async create(value) { notifications.push(value); return value; },
  });
  const application = await service.submitApplication('concurrent-reader', {
    publisherName: 'Concurrent Publishing',
    legalRepresentativeName: 'Concurrent Representative',
    independentPublisher: true,
    publisherEmail: 'concurrent@example.com',
  });
  const results = await Promise.allSettled([
    service.withdrawApplication(application.id, 'concurrent-reader', 1),
    service.rejectApplication(application.id, 'moderator', 'Incomplete application', 1),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const failure = results.find(result => result.status === 'rejected');
  assert.equal(failure.reason.name, 'ApplicationRevisionConflictError');
  const saved = await repository.findById(application.id);
  assert.equal(saved.revision, 2);
  assert.ok(['withdrawn', 'rejected'].includes(saved.status));
  assert.equal(notifications.length, saved.status === 'rejected' ? 1 : 0);
});

test('moderator rejection requires the current revision and leaves stale decisions unchanged', async () => {
  const application = await publisherApplicationService.submitApplication('revision-review-reader', {
    publisherName: 'Review Publisher',
    legalRepresentativeName: 'Review Representative',
    independentPublisher: true,
    publisherEmail: 'review@example.com',
  });
  const router = createModerationRouter(createAuthGuard(
    async () => ({uid: 'revision-review-mod', role: 'moderator'}), 'moderator',
  ));
  const reject = body => new Promise((resolve, rejectError) => {
    const response = fakeResponse();
    response.json = function (data) { this.body = data; resolve(this); return this; };
    router.handle({method: 'POST', url: `/publisher-applications/${application.id}/reject`,
      body, headers: {authorization: 'Bearer mod'}}, response,
      error => rejectError(error ?? new Error('Route not handled')));
  });
  assert.equal((await reject(undefined)).statusCode, 400);
  assert.equal((await reject({revision: 1})).statusCode, 400);
  const stale = await reject({revision: 2, decisionReason: 'Incomplete'});
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.body.error.code, 'REVISION_CONFLICT');
  assert.equal(stale.body.data.serverValue.status, 'pending');
  const result = await reject({revision: 1, decisionReason: 'Incomplete'});
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.data.status, 'rejected');
  assert.equal(result.body.data.revision, 2);
});

test('HTTP publisher role changes fail closed until role synchronization is implemented', async () => {
  const application = await publisherApplicationService.submitApplication('role-gate-reader', {
    publisherName: 'Gate Publisher',
    legalRepresentativeName: 'Gate Representative',
    independentPublisher: true,
    publisherEmail: 'gate@example.com',
  });
  const guard = createAuthGuard(async (token) => token === 'mod'
    ? {uid: 'gate-moderator', role: 'moderator'}
    : token === 'reader' ? {uid: 'role-gate-reader', role: 'reader'} : null, 'moderator');
  const router = createModerationRouter(guard);
  const dispatch = (url, token) => new Promise((resolve, reject) => {
    const response = fakeResponse();
    response.json = function (data) { this.body = data; resolve(this); return this; };
    router.handle({method: 'POST', url, body: {decisionReason: 'Test'},
      headers: token ? {authorization: `Bearer ${token}`} : {}}, response,
      (error) => reject(error ?? new Error('Route not handled')));
  });

  for (const path of [`/publisher-applications/${application.id}/approve`, '/publishers/role-gate-reader/revoke']) {
    assert.equal((await dispatch(path)).statusCode, 401);
    assert.equal((await dispatch(path, 'reader')).statusCode, 403);
    const result = await dispatch(path, 'mod');
    assert.equal(result.statusCode, 503);
    assert.equal(result.body.error.code, 'FEATURE_UNAVAILABLE');
  }
  assert.equal((await publisherApplicationRepository.findById(application.id)).status, 'pending');
  assert.deepEqual(await notificationRepository.findByUserId('role-gate-reader'), []);
});

function createIsolatedService(options = {}) {
  const apps = new Map();
  const notifications = [];

  const appRepo = {
    async save(app) {
      apps.set(app.id, { ...app });
      return { ...app };
    },
    async saveIfNoActive(app) {
      if ([...apps.values()].some(value => value.applicantUid === app.applicantUid &&
          ['pending', 'approved'].includes(value.status))) throw new Error('DUPLICATE_ACTIVE_APPLICATION');
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

  test('concurrent submissions produce one active application in one repository', async () => {
    const repository = new PublisherApplicationRepository();
    const service = new PublisherApplicationService(repository);
    const results = await Promise.allSettled([
      service.submitApplication('concurrent-applicant', validApplication),
      service.submitApplication('concurrent-applicant', validApplication),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.message, 'DUPLICATE_ACTIVE_APPLICATION');
    assert.equal((await repository.findByApplicant('concurrent-applicant')).length, 1);
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

  test('reader role guard rejects anonymous and publisher identities', async () => {
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

describe('S2-AC-002: Administrator Approval', () => {
  const validApplication = {
    publisherName: 'Northstar Publishing',
    legalRepresentativeName: 'Juan Carlos Zuniga Alfaro',
    independentPublisher: true,
    publisherEmail: 'northstar@example.com',
    website: 'https://northstar.example.com',
  };

  test('in-memory service records approval and notification', async () => {
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

  test('in-memory approval exposes notification failure after updating the application', async () => {
    const { service, appRepo, notifRepo } = createIsolatedService({ failNotificationWrite: true });
    const app = await service.submitApplication('reader-atomic-check', validApplication);

    await assert.rejects(
      () => service.approveApplication(app.id, 'moderator-s2-001'),
      /NOTIFICATION_WRITE_FAILED/,
    );

    const notifications = await notifRepo.findByUserId('reader-atomic-check');
    assert.equal(notifications.length, 0);
    assert.equal((await appRepo.findById(app.id)).status, 'approved');
  });

  test('in-memory service rejects a second approval after the first', async () => {
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

  test('in-memory rejection and simulated reader role guard', async () => {
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

  test('publisher guard rejects a simulated pending reader', async () => {
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

  test('publisher guard rejects a simulated rejected reader', async () => {
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

  test('in-memory revocation notice and simulated reader role guard', async () => {
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

test.todo('TC-S2-011: approval atomically records the decision and role grant');
test.todo('TC-S2-013: notification failure rolls back approval and role grant');
test.todo('TC-S2-014: approval with stale revision is rejected');
test.todo('TC-S2-018: rejected applicant retains their real reader role');
test.todo('TC-S2-020 and TC-S2-021: pending and rejected applicants cannot call upload APIs');
test.todo('TC-S2-022: revoked publisher loses actual upload privileges');
