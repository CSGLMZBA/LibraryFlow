
import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import "fake-indexeddb/auto";

import {
  getReaderApplicationCache,
  saveReaderApplicationCache,
  clearReaderApplicationCache,
} from "../../apps/frontend/src/services/reader-application-cache.ts";

const DATABASE_NAME = "LibraryFlowReaderApplicationCache";

const readerId = "reader-test-001";

function createApplication(
  id = "application-001",
  applicantUid = readerId,
) {
  return {
    id,
    applicantUid,
    publisherName: "Example Publisher",
    publisherEmail: "publisher@example.test",
    legalRepresentativeName: "Example Representative",
    status: "pending",
    revision: 1,
    createdAt: "2026-11-23T10:00:00.000Z",
    updatedAt: "2026-11-23T10:00:00.000Z",
    expiresAt: "2026-12-23T10:00:00.000Z",
  };
}

// Start each test with an empty IndexedDB database.
beforeEach(async () => {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("IndexedDB database is blocked."));
  });
});

test("S2-T05: saves and retrieves application status", async () => {
  const saved = await saveReaderApplicationCache(
    readerId,
    [createApplication()],
  );

  assert.equal(saved, true);

  const snapshot = await getReaderApplicationCache(readerId);

  assert.ok(snapshot);
  assert.equal(snapshot.userId, readerId);
  assert.equal(snapshot.applications.length, 1);
  assert.equal(snapshot.applications[0].status, "pending");
  assert.equal(snapshot.applications[0].revision, 1);
});

test("S2-T05: does not store private form details", async () => {
  await saveReaderApplicationCache(
    readerId,
    [createApplication()],
  );

  const snapshot = await getReaderApplicationCache(readerId);

  assert.ok(snapshot);

  const cached = snapshot.applications[0];

  assert.equal("publisherEmail" in cached, false);
  assert.equal("legalRepresentativeName" in cached, false);
  assert.equal("publisherName" in cached, false);
  assert.equal("applicantUid" in cached, false);
});

test("S2-T05: isolates cached data by reader", async () => {
  await saveReaderApplicationCache(
    readerId,
    [createApplication()],
  );

  const otherReader = await getReaderApplicationCache(
    "reader-test-002",
  );

  assert.equal(otherReader, null);
});

test("S2-T05: rejects applications owned by another user", async () => {
  const saved = await saveReaderApplicationCache(
    readerId,
    [createApplication("application-002", "another-reader")],
  );

  assert.equal(saved, false);

  const snapshot = await getReaderApplicationCache(readerId);

  assert.equal(snapshot, null);
});

test("S2-T05: supports a cached empty application list", async () => {
  const saved = await saveReaderApplicationCache(readerId, []);

  assert.equal(saved, true);

  const snapshot = await getReaderApplicationCache(readerId);

  assert.ok(snapshot);
  assert.deepEqual(snapshot.applications, []);
});

test("S2-T05: clears cached status after logout cleanup", async () => {
  await saveReaderApplicationCache(
    readerId,
    [createApplication()],
  );

  await clearReaderApplicationCache(readerId);

  const snapshot = await getReaderApplicationCache(readerId);

  assert.equal(snapshot, null);
});
