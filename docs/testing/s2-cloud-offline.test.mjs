import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { downloadBookForOffline, getOfflineBook, listOfflineBookIds } from "../../apps/frontend/src/services/offline-book-service.ts";

const book = (overrides = {}) => ({
  id: "cloud-book", ownerId: "o", ownerDisplayName: "Publisher", title: "Cloud Title", author: "Cloud Author",
  description: "D", categoryId: "c", genreId: "g", fileName: "cloud.pdf", fileFormat: "pdf", fileSizeBytes: 4,
  accessKey: "k", status: "approved", createdAt: "x", updatedAt: "x", revision: 3, ...overrides,
});

test("a downloaded cloud file is stored offline with the book's metadata", async () => {
  const requested = [];
  await downloadBookForOffline(book(), async candidate => {
    requested.push(candidate.id);
    return {fileBlob: new Blob(["pdf bytes"]), fileName: candidate.fileName, fileFormat: candidate.fileFormat};
  });
  assert.deepEqual(requested, ["cloud-book"]);
  assert.deepEqual(await listOfflineBookIds(), ["cloud-book"]);
  const stored = await getOfflineBook("cloud-book");
  assert.equal(stored.title, "Cloud Title");
  assert.equal(stored.fileName, "cloud.pdf");
  assert.equal(await stored.fileBlob.text(), "pdf bytes");
});

test("unapproved, empty, oversized or unsupported downloads are refused and nothing is stored", async () => {
  const load = blob => async () => ({fileBlob: blob, fileName: "f.pdf", fileFormat: "pdf"});
  let called = false;
  await assert.rejects(downloadBookForOffline(book({id: "pending", status: "pending-approval"}), async () => { called = true; }),
    /Only approved books/);
  assert.equal(called, false, "No download is attempted for an unapproved book.");
  await assert.rejects(downloadBookForOffline(book({id: "empty"}), load(new Blob([]))), /empty or exceeds/);
  await assert.rejects(downloadBookForOffline(book({id: "huge"}), load(new Blob([new Uint8Array(20 * 1024 * 1024 + 1)]))), /empty or exceeds/);
  await assert.rejects(downloadBookForOffline(book({id: "exe"}), async () => ({fileBlob: new Blob(["x"]), fileName: "f.exe", fileFormat: "exe"})),
    /Unsupported format/);
  await assert.rejects(downloadBookForOffline(book({id: "denied"}), async () => { throw new Error("The file could not be downloaded. Try again."); }),
    /could not be downloaded/);
  assert.deepEqual((await listOfflineBookIds()).filter(id => id !== "cloud-book"), []);
});
