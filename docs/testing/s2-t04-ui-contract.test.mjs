/**
 * Sprint 2 — Publisher Application & Moderator Review Frontend Contract Tests (S2-T04)
 *
 * Covers: S2-AC-001 (US-REA-013 frontend validation & submission contract)
 *         S2-AC-002 (US-MOD-005 moderator approval & conflict handling)
 *         S2-AC-003 (US-MOD-005 moderator rejection with reason)
 *         S2-AC-008 / US-MOD-007 (moderator publisher revocation contract)
 *
 * Owner: Dante Uriel Juárez Tolentino (Yuki)
 * Run: npx tsx --test docs/testing/s2-t04-ui-contract.test.mjs
 */

import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import {
  normalizePublisherApplicationInput,
  validateCreatePublisherApplication,
} from '../../apps/frontend/src/schemas/publisher-application-schema.ts';
import { authService } from '../../apps/frontend/src/services/auth-service.ts';
import { publisherApplicationService } from '../../apps/frontend/src/services/publisher-application-service.ts';

const originalFetch = globalThis.fetch;
const originalGetAccessToken = authService.getAccessToken.bind(authService);

afterEach(() => {
  globalThis.fetch = originalFetch;
  authService.getAccessToken = originalGetAccessToken;
});

function mockCloudToken(token = 'mock-firebase-id-token') {
  authService.getAccessToken = () => token;
}

function mockJsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ===========================================================================
// S2-AC-001: Client-side Validation & Normalization (SPEC-002-CONTRACTS §2.1)
// ===========================================================================

describe('S2-T04 Client Validation & Normalization (SPEC-002 §2.1)', () => {
  test('accepts valid normalized payload and trims whitespace', () => {
    const normalized = normalizePublisherApplicationInput({
      publisherName: '  Horizon Independent Press  ',
      legalRepresentativeName: '  Dante Uriel Juarez  ',
      independentPublisher: true,
      publisherEmail: '  contact@horizonpress.test  ',
      website: '  https://horizonpress.test  ',
    });

    assert.equal(normalized.publisherName, 'Horizon Independent Press');
    assert.equal(normalized.legalRepresentativeName, 'Dante Uriel Juarez');
    assert.equal(normalized.publisherEmail, 'contact@horizonpress.test');
    assert.equal(normalized.website, 'https://horizonpress.test');

    const errors = validateCreatePublisherApplication(normalized);
    assert.deepEqual(errors, {});
  });

  test('rejects missing required fields, non-https website, and max-length violations before network call', async () => {
    mockCloudToken('reader-token-123');

    let networkCalled = false;
    globalThis.fetch = async () => {
      networkCalled = true;
      return mockJsonResponse(201, { success: true, data: {} });
    };

    const result = await publisherApplicationService.submitApplication({
      publisherName: '',
      legalRepresentativeName: 'A'.repeat(101),
      independentPublisher: false,
      publisherEmail: 'not-an-email',
      website: 'http://insecure-site.example.com',
    });

    assert.equal(networkCalled, false);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.code, 'VALIDATION_ERROR');
    }
  });
});

// ===========================================================================
// S2-AC-001: Applicant API Service Contract (US-REA-013)
// ===========================================================================

describe('S2-T04 Applicant API Service Contract (US-REA-013)', () => {
  test('blocks requests cleanly with AUTH_REQUIRED when no cloud session token exists', async () => {
    authService.getAccessToken = () => null;

    const result = await publisherApplicationService.submitApplication({
      publisherName: 'Horizon Press',
      legalRepresentativeName: 'Dante Juarez',
      independentPublisher: true,
      publisherEmail: 'contact@horizonpress.test',
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.code, 'AUTH_REQUIRED');
    }
  });

  test('submits valid application and returns 201 envelope payload', async () => {
    mockCloudToken('reader-token-123');

    let capturedUrl = '';
    let capturedAuth = '';
    let capturedBody = null;

    globalThis.fetch = async (url, init) => {
      capturedUrl = String(url);
      capturedAuth = init?.headers?.Authorization ?? '';
      capturedBody = JSON.parse(String(init?.body ?? '{}'));

      return mockJsonResponse(201, {
        success: true,
        data: {
          id: 'app-001',
          applicantUid: 'reader-uid-1',
          ...capturedBody,
          status: 'pending',
          revision: 1,
          createdAt: '2026-11-22T12:00:00.000Z',
          updatedAt: '2026-11-22T12:00:00.000Z',
          expiresAt: '2026-12-22T12:00:00.000Z',
        },
      });
    };

    const result = await publisherApplicationService.submitApplication({
      publisherName: '  Horizon Press  ',
      legalRepresentativeName: '  Dante Juarez  ',
      independentPublisher: true,
      publisherEmail: '  contact@horizonpress.test  ',
      website: 'https://horizonpress.test',
    });

    assert.match(capturedUrl, /\/api\/v1\/publisher-applications$/);
    assert.equal(capturedAuth, 'Bearer reader-token-123');
    assert.equal(capturedBody.publisherName, 'Horizon Press');
    assert.equal(capturedBody.publisherEmail, 'contact@horizonpress.test');

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.id, 'app-001');
      assert.equal(result.data.status, 'pending');
      assert.equal(result.data.revision, 1);
    }
  });

  test('propagates 409 DUPLICATE_RESOURCE when an active application exists', async () => {
    mockCloudToken('reader-token-123');

    globalThis.fetch = async () =>
      mockJsonResponse(409, {
        success: false,
        error: {
          code: 'DUPLICATE_RESOURCE',
          message: 'An active publisher application is already pending or approved.',
        },
      });

    const result = await publisherApplicationService.submitApplication({
      publisherName: 'Horizon Press',
      legalRepresentativeName: 'Dante Juarez',
      independentPublisher: true,
      publisherEmail: 'contact@horizonpress.test',
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.code, 'DUPLICATE_RESOURCE');
    }
  });

  test('retrieves reader applications and supports withdrawal', async () => {
    mockCloudToken('reader-token-123');

    globalThis.fetch = async (url) => {
      const target = String(url);
      if (target.endsWith('/publisher-applications/me')) {
        return mockJsonResponse(200, {
          success: true,
          data: [
            {
              id: 'app-001',
              applicantUid: 'reader-uid-1',
              publisherName: 'Horizon Press',
              legalRepresentativeName: 'Dante Juarez',
              independentPublisher: true,
              publisherEmail: 'contact@horizonpress.test',
              status: 'pending',
              revision: 1,
              createdAt: '2026-11-22T12:00:00.000Z',
              updatedAt: '2026-11-22T12:00:00.000Z',
              expiresAt: '2026-12-22T12:00:00.000Z',
            },
          ],
        });
      }
      return mockJsonResponse(200, {
        success: true,
        data: {
          id: 'app-001',
          status: 'withdrawn',
          revision: 2,
        },
      });
    };

    const listResult = await publisherApplicationService.listMyApplications();
    assert.equal(listResult.success, true);
    if (listResult.success) {
      assert.equal(listResult.data.length, 1);
    }

    const withdrawResult = await publisherApplicationService.withdrawApplication('app-001', 1);
    assert.equal(withdrawResult.success, true);
    if (withdrawResult.success) {
      assert.equal(withdrawResult.data.status, 'withdrawn');
      assert.equal(withdrawResult.data.revision, 2);
    }
  });
});

// ===========================================================================
// S2-AC-002 / S2-AC-003 / US-MOD-007: Moderator Review & Revocation Contract
// ===========================================================================

describe('S2-T04 Moderator Review & Revocation Contract (US-MOD-005, US-MOD-007)', () => {
  test('lists pending applications and approves with revision payload', async () => {
    mockCloudToken('moderator-token-999');

    let lastRequest = null;
    globalThis.fetch = async (url, init) => {
      lastRequest = {
        url: String(url),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : null,
      };

      if (lastRequest.method === 'GET') {
        return mockJsonResponse(200, {
          success: true,
          data: [
            {
              id: 'app-pending-1',
              applicantUid: 'reader-uid-2',
              publisherName: 'Solstice Books',
              legalRepresentativeName: 'Elena Vance',
              independentPublisher: false,
              publisherEmail: 'editorial@solstice.test',
              status: 'pending',
              revision: 1,
              createdAt: '2026-11-22T10:00:00.000Z',
              updatedAt: '2026-11-22T10:00:00.000Z',
              expiresAt: '2026-12-22T10:00:00.000Z',
            },
          ],
        });
      }

      return mockJsonResponse(200, {
        success: true,
        data: {
          id: 'app-pending-1',
          status: 'approved',
          reviewerUid: 'moderator-uid-1',
          revision: 2,
        },
      });
    };

    const pending = await publisherApplicationService.listPendingApplications();
    assert.equal(pending.success, true);
    assert.match(lastRequest.url, /\/api\/v1\/moderation\/publisher-applications\?status=pending$/);

    const approved = await publisherApplicationService.approveApplication('app-pending-1', 1);
    assert.equal(approved.success, true);
    assert.match(lastRequest.url, /\/api\/v1\/moderation\/publisher-applications\/app-pending-1\/approve$/);
    assert.deepEqual(lastRequest.body, { revision: 1 });
  });

  test('rejects application with trimmed decisionReason and surfaces 409 REVISION_CONFLICT', async () => {
    mockCloudToken('moderator-token-999');

    let capturedBody = null;
    globalThis.fetch = async (_url, init) => {
      capturedBody = JSON.parse(String(init?.body ?? '{}'));
      return mockJsonResponse(200, {
        success: true,
        data: {
          id: 'app-pending-2',
          status: 'rejected',
          decisionReason: capturedBody.decisionReason,
          revision: 2,
        },
      });
    };

    const rejected = await publisherApplicationService.rejectApplication(
      'app-pending-2',
      1,
      '  Incomplete editorial verification details.  ',
    );
    assert.equal(rejected.success, true);
    assert.deepEqual(capturedBody, {
      revision: 1,
      decisionReason: 'Incomplete editorial verification details.',
    });

    globalThis.fetch = async () =>
      mockJsonResponse(409, {
        success: false,
        error: {
          code: 'REVISION_CONFLICT',
          message: 'Application was modified by another moderator.',
        },
      });

    const conflict = await publisherApplicationService.approveApplication('app-pending-2', 1);
    assert.equal(conflict.success, false);
    if (!conflict.success) {
      assert.equal(conflict.error.code, 'REVISION_CONFLICT');
    }
  });

  test('revokes active publisher privileges with decisionReason payload', async () => {
    mockCloudToken('moderator-token-999');

    let capturedUrl = '';
    let capturedBody = null;
    globalThis.fetch = async (url, init) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(String(init?.body ?? '{}'));
      return mockJsonResponse(200, {
        success: true,
        data: {
          uid: 'publisher-uid-77',
          role: 'reader',
        },
      });
    };

    const revoked = await publisherApplicationService.revokePublisher(
      'publisher-uid-77',
      '  Repeated copyright policy violations.  ',
    );

    assert.match(capturedUrl, /\/api\/v1\/moderation\/publishers\/publisher-uid-77\/revoke$/);
    assert.deepEqual(capturedBody, {
      decisionReason: 'Repeated copyright policy violations.',
    });
    assert.equal(revoked.success, true);
    if (revoked.success) {
      assert.equal(revoked.data.uid, 'publisher-uid-77');
      assert.equal(revoked.data.role, 'reader');
    }
  });
});