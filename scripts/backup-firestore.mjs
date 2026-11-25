/**
 * Read-only Firestore backup for S2-T09 (TC-S2-057).
 *
 *   npm run backup:firestore
 *   npm run backup:firestore -- --out D:\LibraryFlowBackups
 *
 * Run by the operations owner before every deployment. Reads
 * FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY from
 * .env, exports every collection and subcollection to one JSON file, and
 * prints only the file path, document counts, and a SHA-256 checksum. It never
 * writes to Firestore and never prints document data.
 *
 * Backups contain personal data. They go to `backups/` (git-ignored) by
 * default and must never be committed or shared in chat. Restore is planned
 * for Sprint 3 (S3-T09).
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PAGE_SIZE = 500;
export const BACKUP_FORMAT = 'libraryflow-firestore-backup/v1';

/** Converts Firestore values to plain JSON, keeping their type. */
export function serializeValue(value) {
  if (value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value !== 'object') return value;

  if (typeof value.toDate === 'function' && 'seconds' in value && 'nanoseconds' in value) {
    return { __type: 'timestamp', value: value.toDate().toISOString() };
  }
  if (typeof value.path === 'string' && typeof value.parent === 'object' && 'firestore' in value) {
    return { __type: 'reference', path: value.path };
  }
  if (typeof value.latitude === 'number' && typeof value.longitude === 'number' && Object.keys(value).length <= 2) {
    return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof Uint8Array) {
    return { __type: 'bytes', base64: Buffer.from(value).toString('base64') };
  }

  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeValue(item)]));
}

async function exportCollection(collection, counts, path) {
  const documents = [];
  let query = collection.limit(PAGE_SIZE);
  for (;;) {
    const snapshot = await query.get();
    for (const document of snapshot.docs) {
      const subcollections = {};
      for (const child of await document.ref.listCollections()) {
        subcollections[child.id] = await exportCollection(child, counts, `${path}/${document.id}/${child.id}`);
      }
      documents.push({
        id: document.id,
        data: serializeValue(document.data()),
        ...(Object.keys(subcollections).length > 0 ? { subcollections } : {}),
      });
    }
    counts[path] = (counts[path] ?? 0) + snapshot.docs.length;
    if (snapshot.docs.length < PAGE_SIZE) break;
    query = collection.limit(PAGE_SIZE).startAfter(snapshot.docs[snapshot.docs.length - 1]);
  }
  return documents;
}

/** Exports every root collection. `db` is a firebase-admin Firestore instance. */
export async function exportFirestore(db) {
  const counts = {};
  const collections = {};
  for (const collection of await db.listCollections()) {
    collections[collection.id] = await exportCollection(collection, counts, collection.id);
  }
  return { collections, counts };
}

/** Writes the backup file and returns { file, sha256, counts, totalDocuments }. */
export async function writeBackup(db, { projectId, outDir, now = new Date() }) {
  const { collections, counts } = await exportFirestore(db);
  const createdAt = now.toISOString();
  const content = JSON.stringify({ format: BACKUP_FORMAT, projectId, createdAt, counts, collections }, null, 2);
  const sha256 = createHash('sha256').update(content).digest('hex');

  await mkdir(outDir, { recursive: true });
  const file = join(outDir, `firestore-${projectId}-${createdAt.replace(/[:.]/g, '-')}.json`);
  await writeFile(file, content, { mode: 0o600, flag: 'wx' });

  const totalDocuments = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { file, sha256, counts, totalDocuments };
}

function requireEnvironment(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const outIndex = process.argv.indexOf('--out');
  const outDir = resolve(outIndex > -1 && process.argv[outIndex + 1] ? process.argv[outIndex + 1] : 'backups');

  const projectId = requireEnvironment(process.env, 'FIREBASE_PROJECT_ID');
  const clientEmail = requireEnvironment(process.env, 'FIREBASE_CLIENT_EMAIL');
  const privateKey = requireEnvironment(process.env, 'FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');

  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (!getApps().length) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
  }

  const result = await writeBackup(getFirestore(), { projectId, outDir });
  console.log(`Firestore backup written (${new Date().toISOString()})`);
  console.log(`  project:   ${projectId}`);
  console.log(`  file:      ${result.file}`);
  console.log(`  sha256:    ${result.sha256}`);
  console.log(`  documents: ${result.totalDocuments}`);
  for (const [path, count] of Object.entries(result.counts).sort()) {
    console.log(`    ${path}: ${count}`);
  }
  console.log('Keep this file private. Do not commit it or share it in chat.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Firestore backup failed: ${error.message}`);
    process.exitCode = 1;
  });
}
