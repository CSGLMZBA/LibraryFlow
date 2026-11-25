/**
 * Live verification of the private book bucket (S2-T07, TC-S2-027, TC-S2-028).
 *
 *   npm run storage:verify
 *
 * Run once by the operations owner against the team's Supabase project, after
 * `npm run storage:setup`. Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
 * SUPABASE_BOOK_BUCKET from .env, uses the backend's own storage client, and
 * removes every test object it creates.
 *
 * Output lists each check as PASS or FAIL. It never prints the service-role
 * key, signed URLs, or tokens. Exit code is 1 when any check fails.
 */
import { pathToFileURL } from 'node:url';

import { SupabaseBookFileStorage } from '../apps/backend/src/services/storage-service.ts';
import {
  BOOK_BUCKET_FILE_SIZE_LIMIT,
  findBucketConfigProblems,
} from './setup-storage-bucket.mjs';

const TEST_PREFIX = 'books/__storage-verify__';

function readConfig(env) {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = env.SUPABASE_BOOK_BUCKET?.trim();
  const missing = [
    ['SUPABASE_URL', url],
    ['SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey],
    ['SUPABASE_BOOK_BUCKET', bucket],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  return { url, serviceRoleKey, bucket };
}

/** Minimal valid-looking PDF body for the positive control. */
function smallPdf() {
  return new TextEncoder().encode('%PDF-1.4\n% LibraryFlow storage verification\n%%EOF\n');
}

async function upload(fetchImpl, uploadUrl, body, contentType) {
  const response = await fetchImpl(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  await response.arrayBuffer().catch(() => undefined);
  return response.status;
}

/**
 * Runs the live checks. `fetchImpl` and `runId` are injectable for tests.
 * Returns { bucket, checks: [{ id, name, passed, detail }] }.
 */
export async function verifyBookStorage(
  env = process.env,
  fetchImpl = fetch,
  runId = `${Date.now()}`,
) {
  const config = readConfig(env);
  const storage = new SupabaseBookFileStorage(config, fetchImpl);
  const prefix = `${TEST_PREFIX}/${runId}`;
  const paths = {
    valid: `${prefix}/valid.pdf`,
    oversized: `${prefix}/oversized.pdf`,
    wrongType: `${prefix}/wrong-type.pdf`,
  };
  const checks = [];
  const record = (id, name, passed, detail) => checks.push({ id, name, passed, detail });

  try {
    // 1. Bucket settings (TC-S2-027).
    const bucketResponse = await fetchImpl(
      `${config.url}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`,
      { headers: { Authorization: `Bearer ${config.serviceRoleKey}`, apikey: config.serviceRoleKey } },
    );
    const bucketInfo = bucketResponse.ok ? await bucketResponse.json() : null;
    const problems = bucketInfo ? findBucketConfigProblems(bucketInfo) : [`HTTP ${bucketResponse.status}`];
    record('TC-S2-027', 'Bucket is private with 20 MB and PDF/EPUB limits', problems.length === 0,
      problems.length === 0 ? 'settings match SPEC-002 §4.1' : problems.join('; '));

    // 2. Positive control: a small PDF uploads through a signed URL.
    const validStatus = await upload(fetchImpl, await storage.createSignedUploadUrl(paths.valid), smallPdf(), 'application/pdf');
    const validInfo = await storage.getObjectInfo(paths.valid);
    record('TC-S2-027', 'Signed upload of a small PDF succeeds', validStatus < 300 && validInfo !== null,
      `upload HTTP ${validStatus}; stored ${validInfo ? `${validInfo.sizeBytes} bytes` : 'no object'}`);

    // 3. Anonymous public URL is denied (TC-S2-027).
    const publicResponse = await fetchImpl(
      `${config.url}/storage/v1/object/public/${encodeURIComponent(config.bucket)}/${paths.valid}`,
    );
    await publicResponse.arrayBuffer().catch(() => undefined);
    record('TC-S2-027', 'Anonymous public URL is denied', !publicResponse.ok, `HTTP ${publicResponse.status}`);

    // 4. Anonymous authenticated-path read without a key is denied (TC-S2-027).
    const anonymousResponse = await fetchImpl(
      `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${paths.valid}`,
    );
    await anonymousResponse.arrayBuffer().catch(() => undefined);
    record('TC-S2-027', 'Object read without a key is denied', !anonymousResponse.ok, `HTTP ${anonymousResponse.status}`);

    // 5. A signed download URL works (TC-S2-029 live control).
    const downloadResponse = await fetchImpl(await storage.createSignedDownloadUrl(paths.valid, 600));
    await downloadResponse.arrayBuffer().catch(() => undefined);
    record('TC-S2-029', 'Signed download URL returns the object', downloadResponse.ok, `HTTP ${downloadResponse.status}`);

    // 6. Oversized upload is rejected by the bucket (TC-S2-028).
    const oversizedStatus = await upload(fetchImpl, await storage.createSignedUploadUrl(paths.oversized),
      new Uint8Array(BOOK_BUCKET_FILE_SIZE_LIMIT + 1), 'application/pdf');
    const oversizedInfo = await storage.getObjectInfo(paths.oversized);
    record('TC-S2-028', 'Upload larger than 20 MB is rejected', oversizedStatus >= 400 && oversizedInfo === null,
      `upload HTTP ${oversizedStatus}; stored ${oversizedInfo ? 'yes' : 'no'}`);

    // 7. Disallowed MIME type is rejected by the bucket (TC-S2-028).
    const wrongTypeStatus = await upload(fetchImpl, await storage.createSignedUploadUrl(paths.wrongType),
      new TextEncoder().encode('<html>not a book</html>'), 'text/html');
    const wrongTypeInfo = await storage.getObjectInfo(paths.wrongType);
    record('TC-S2-028', 'Upload with a non-PDF/EPUB type is rejected', wrongTypeStatus >= 400 && wrongTypeInfo === null,
      `upload HTTP ${wrongTypeStatus}; stored ${wrongTypeInfo ? 'yes' : 'no'}`);
  } catch (error) {
    record('setup', 'Verification ran to completion', false, error instanceof Error ? error.message : String(error));
  } finally {
    for (const path of Object.values(paths)) {
      await storage.deleteObject(path).catch(() => undefined);
    }
  }

  return { bucket: config.bucket, checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyBookStorage()
    .then(({ bucket, checks }) => {
      console.log(`Live storage verification for bucket "${bucket}" (${new Date().toISOString()})`);
      for (const check of checks) {
        console.log(`${check.passed ? 'PASS' : 'FAIL'}  ${check.id}  ${check.name} (${check.detail})`);
      }
      const failed = checks.filter((check) => !check.passed).length;
      console.log(failed === 0 ? `All ${checks.length} checks passed.` : `${failed} of ${checks.length} checks failed.`);
      if (failed > 0) process.exitCode = 1;
    })
    .catch((error) => {
      console.error(`Storage verification failed: ${error.message}`);
      process.exitCode = 1;
    });
}
