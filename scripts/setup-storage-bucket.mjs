/**
 * Creates or updates the private book bucket on Supabase Storage
 * (SPEC-002 §4.1, S2-T07). Run by the operations owner with the service-role
 * key, never from the browser:
 *
 *   npm run storage:setup
 *
 * Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_BOOK_BUCKET from
 * .env. Prints the resulting bucket settings; never prints the key.
 */
import { pathToFileURL } from 'node:url';

export const BOOK_BUCKET_FILE_SIZE_LIMIT = 20 * 1024 * 1024;
export const BOOK_BUCKET_MIME_TYPES = ['application/pdf', 'application/epub+zip'];

/** Bucket settings required by SPEC-002 §4.1. */
export function buildBookBucketConfig(bucket) {
  return {
    id: bucket,
    name: bucket,
    public: false,
    file_size_limit: BOOK_BUCKET_FILE_SIZE_LIMIT,
    allowed_mime_types: [...BOOK_BUCKET_MIME_TYPES],
  };
}

/** Returns the list of differences between a bucket and the required settings. */
export function findBucketConfigProblems(bucketInfo) {
  const problems = [];
  if (bucketInfo.public !== false) problems.push('bucket is public');
  if (Number(bucketInfo.file_size_limit) !== BOOK_BUCKET_FILE_SIZE_LIMIT) {
    problems.push(`file_size_limit is ${bucketInfo.file_size_limit}, expected ${BOOK_BUCKET_FILE_SIZE_LIMIT}`);
  }
  const mimeTypes = [...(bucketInfo.allowed_mime_types ?? [])].sort();
  if (JSON.stringify(mimeTypes) !== JSON.stringify([...BOOK_BUCKET_MIME_TYPES].sort())) {
    problems.push(`allowed_mime_types is ${JSON.stringify(bucketInfo.allowed_mime_types ?? null)}`);
  }
  return problems;
}

async function storageRequest(baseUrl, key, method, path, body) {
  const response = await fetch(`${baseUrl}/storage/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json };
}

function isNotFound(result) {
  const message = `${result.json?.error ?? ''} ${result.json?.message ?? ''} ${result.json?.statusCode ?? ''}`;
  return result.status === 404 || /not.?found|404/i.test(message);
}

export async function setupBookBucket(env = process.env) {
  const baseUrl = env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = env.SUPABASE_BOOK_BUCKET?.trim();
  const missing = [
    ['SUPABASE_URL', baseUrl],
    ['SUPABASE_SERVICE_ROLE_KEY', key],
    ['SUPABASE_BOOK_BUCKET', bucket],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  const config = buildBookBucketConfig(bucket);
  const existing = await storageRequest(baseUrl, key, 'GET', `/bucket/${encodeURIComponent(bucket)}`);

  let action;
  let result;
  if (existing.ok) {
    action = 'updated';
    const { id, name, ...settings } = config;
    result = await storageRequest(baseUrl, key, 'PUT', `/bucket/${encodeURIComponent(bucket)}`, settings);
  } else if (isNotFound(existing)) {
    action = 'created';
    result = await storageRequest(baseUrl, key, 'POST', '/bucket', config);
  } else {
    throw new Error(`Could not read bucket "${bucket}" (HTTP ${existing.status}).`);
  }
  if (!result.ok) {
    throw new Error(`Could not ${action === 'created' ? 'create' : 'update'} bucket "${bucket}" (HTTP ${result.status}).`);
  }

  const verified = await storageRequest(baseUrl, key, 'GET', `/bucket/${encodeURIComponent(bucket)}`);
  if (!verified.ok || !verified.json) {
    throw new Error(`Could not verify bucket "${bucket}" (HTTP ${verified.status}).`);
  }
  const problems = findBucketConfigProblems(verified.json);
  if (problems.length > 0) {
    throw new Error(`Bucket "${bucket}" does not match SPEC-002 §4.1: ${problems.join('; ')}.`);
  }

  return {
    action,
    bucket,
    public: verified.json.public,
    fileSizeLimit: Number(verified.json.file_size_limit),
    allowedMimeTypes: verified.json.allowed_mime_types,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  setupBookBucket()
    .then((summary) => {
      console.log(`Bucket "${summary.bucket}" ${summary.action}.`);
      console.log(`  public: ${summary.public}`);
      console.log(`  file_size_limit: ${summary.fileSizeLimit} bytes`);
      console.log(`  allowed_mime_types: ${summary.allowedMimeTypes.join(', ')}`);
    })
    .catch((error) => {
      console.error(`Storage setup failed: ${error.message}`);
      process.exitCode = 1;
    });
}
