/**
 * Sprint 2 — Storage, Deletion Jobs, and Deployment Tests
 *
 * Covers: S2-AC-006 (TC-S2-027 through TC-S2-030) — Supabase Storage
 *         S2-AC-007 (TC-S2-031 through TC-S2-035) — Scheduled Cleanup
 *         S2-AC-010 (TC-S2-053 through TC-S2-058) — Deployment
 *
 * Owner: Cesar (Sentinel)
 * Status: TC-S2-030, TC-S2-054 (policy), and TC-S2-055 implemented by Jorge
 *         (S2-T07). Remaining tests are stubs awaiting S2-T07 routes, S2-T08,
 *         S2-T09, and Carlos (S2-T11).
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

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

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
  test('TC-S2-027: private bucket enforces access — no public URL', async () => {
    // STUB: awaiting S2-T07 Supabase bucket configuration
    // Expected: direct URL access without signed token is denied;
    //           no public URL is available
    assert.ok(true, 'STUB: pending S2-T07 private bucket enforcement');
  });

  test('TC-S2-028: upload constraint — 20 MB maximum', async () => {
    // STUB: awaiting S2-T07 upload constraints
    // Expected:
    //   1) Valid PDF ≤ 20 MB → stored at books/{bookId}/{revision}/{sanitizedName}
    //   2) PDF > 20 MB → rejected with error
    assert.ok(true, 'STUB: pending S2-T07 upload size constraint');
  });

  test('TC-S2-029: signed download URL for authorized readers', async () => {
    // STUB: awaiting S2-T07 signed URL generation
    // Expected: server returns temporary signed URL expiring within 10 minutes;
    //           no service-role key exposed to client
    assert.ok(true, 'STUB: pending S2-T07 signed URL generation');
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
