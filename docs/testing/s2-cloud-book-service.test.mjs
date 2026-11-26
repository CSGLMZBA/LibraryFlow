import assert from "node:assert/strict";
import { test } from "node:test";
import { ContentApiError } from "../../apps/frontend/src/services/cloud-content-api.ts";
import { createCloudBookService, toBookRecord } from "../../apps/frontend/src/services/cloud-book-service.ts";

const publisher = {id: "pub", email: "p@example.com", displayName: "Pub", role: "publisher", createdAt: "x"};
const moderator = {...publisher, id: "mod", role: "moderator"};
const reader = {...publisher, id: "rdr", role: "reader"};

const serverBook = (overrides = {}) => ({
  id: "b1", title: "Title", author: "Author", ownerId: "pub", description: "About", status: "pending",
  accessKey: "LF-key", shareableUrl: "/books/b1", fileUrl: "", fileType: "pdf", fileSizeBytes: 4,
  categoryIds: ["category-fiction"], genreIds: ["genre-novel"], createdAt: "2026-11-25T00:00:00.000Z",
  updatedAt: "2026-11-25T00:00:00.000Z", revision: 1, ...overrides,
});

function fakeApi(overrides = {}) {
  const calls = [];
  const record = name => (...args) => { calls.push([name, ...args]); return overrides[name]?.(...args); };
  const api = {
    listClassifications: record("listClassifications"),
    listCatalog: record("listCatalog"), getBook: record("getBook"), listMyBooks: record("listMyBooks"),
    createBook: record("createBook"), updateBook: record("updateBook"),
    requestUploadUrl: record("requestUploadUrl"), uploadToSignedUrl: record("uploadToSignedUrl"),
    completeUpload: record("completeUpload"), listPendingBooks: record("listPendingBooks"),
    approveBook: record("approveBook"), rejectBook: record("rejectBook"),
  };
  const defaults = {
    listClassifications: async () => ({
      categories: [{id: "category-fiction", name: "Fiction"}],
      genres: [{id: "genre-novel", name: "Novel"}],
    }),
  };
  for (const [name, fn] of Object.entries(defaults)) if (!overrides[name]) overrides[name] = fn;
  return {api, calls};
}

const input = (overrides = {}) => ({
  title: " Title ", author: " Author ", description: " About ", categoryId: "category-fiction",
  genreId: "genre-novel", file: new File(["data"], "book.pdf", {type: "application/pdf"}), ...overrides,
});

test("server books map to screen records and deleted books never appear", () => {
  const record = toBookRecord(serverBook({fileObjectPath: "books/b1/1/my-book.pdf", rejectionReason: "No", status: "rejected"}));
  assert.deepEqual([record.status, record.categoryId, record.genreId, record.fileName, record.revision, record.rejectionReason],
    ["rejected", "category-fiction", "genre-novel", "my-book.pdf", 1, "No"]);
  assert.equal(toBookRecord(serverBook()).status, "pending-approval");
  assert.equal(toBookRecord(serverBook({status: "deleted"})), null);
  assert.equal(toBookRecord(serverBook({description: undefined, categoryIds: [], genreIds: []})).description, "");
});

test("classifications load once, apply to every category, and a failed load can be retried", async () => {
  let attempts = 0;
  const {api, calls} = fakeApi({listClassifications: async () => {
    if (++attempts === 1) throw new ContentApiError("SERVICE_UNAVAILABLE", "down", 0);
    return {categories: [{id: "c", name: "C", extra: 1}], genres: [{id: "g", name: "G"}]};
  }});
  const service = createCloudBookService(api);
  assert.deepEqual(service.getAvailableCategories(), []);
  await assert.rejects(service.loadClassifications(), {code: "SERVICE_UNAVAILABLE"});
  const loaded = await service.loadClassifications();
  await service.loadClassifications();
  assert.equal(calls.filter(call => call[0] === "listClassifications").length, 2);
  assert.deepEqual(loaded.genres, [{id: "g", name: "G", categoryId: ""}]);
  assert.deepEqual(service.getAvailableCategories(), [{id: "c", name: "C"}]);
});

test("publishing creates the record, uploads to the signed URL, and completes with the right revision", async () => {
  const {api, calls} = fakeApi({
    createBook: async () => serverBook(),
    requestUploadUrl: async () => ({objectPath: "books/b1/1/book.pdf", uploadUrl: "https://storage/upload"}),
    uploadToSignedUrl: async () => undefined,
    completeUpload: async () => serverBook({fileObjectPath: "books/b1/2/book.pdf", revision: 2}),
  });
  const result = await createCloudBookService(api).publishBook(publisher, input());
  assert.equal(result.success, true);
  assert.match(result.message, /submitted for moderator approval \(Access Key: LF-key\)/);
  assert.equal(result.data.revision, 2);
  assert.deepEqual(calls.map(call => call[0]), ["listClassifications", "createBook", "requestUploadUrl", "uploadToSignedUrl", "completeUpload"]);
  assert.deepEqual(calls[1][1], {title: "Title", author: "Author", description: "About", fileType: "pdf", fileSizeBytes: 4,
    categoryIds: ["category-fiction"], genreIds: ["genre-novel"]});
  assert.deepEqual(calls[2], ["requestUploadUrl", "b1", {fileName: "book.pdf", fileType: "pdf", fileSizeBytes: 4, revision: 1}]);
  assert.equal(calls[3][1], "https://storage/upload");
  assert.equal(calls[3][3], "application/pdf");
  assert.deepEqual(calls[4], ["completeUpload", "b1", {objectPath: "books/b1/1/book.pdf", revision: 1}]);
});

test("invalid or unauthorized publishing makes no create or upload request", async () => {
  const {api, calls} = fakeApi();
  const service = createCloudBookService(api);
  for (const bad of [input({title: " "}), input({categoryId: "nope"}), input({genreId: "nope"}), input({file: null}),
    input({file: new File(["x"], "virus.exe", {type: "application/x-msdownload"})})]) {
    const result = await service.publishBook(publisher, bad);
    assert.equal(result.success, false);
    assert.equal(result.error.code, "VALIDATION_ERROR");
  }
  assert.equal((await service.publishBook(reader, input())).error.code, "FORBIDDEN_ROLE");
  assert.deepEqual([...new Set(calls.map(call => call[0]))], ["listClassifications"]);
});

test("a failed upload is reported with a clear message and never looks published", async () => {
  const {api, calls} = fakeApi({
    createBook: async () => serverBook(),
    requestUploadUrl: async () => ({objectPath: "p", uploadUrl: "https://storage/upload"}),
    uploadToSignedUrl: async () => { throw new ContentApiError("UPLOAD_FAILED", "The file could not be uploaded. Try again.", 500); },
  });
  const result = await createCloudBookService(api).publishBook(publisher, input());
  assert.equal(result.success, false);
  assert.equal(result.error.code, "UPLOAD_FAILED");
  assert.match(result.error.message, /saved as Pending, but its file was not uploaded/);
  assert.equal(calls.some(call => call[0] === "completeUpload"), false);
  const rejected = await createCloudBookService(fakeApi({createBook: async () => { throw new ContentApiError("FORBIDDEN", "Access is not authorized.", 403); }}).api)
    .publishBook(publisher, input());
  assert.deepEqual([rejected.success, rejected.error.code], [false, "FORBIDDEN"]);
  const duplicate = await createCloudBookService(fakeApi({createBook: async () => {
    throw new ContentApiError("DUPLICATE_RESOURCE", "A book with the same title and author already exists.", 409);
  }}).api).publishBook(publisher, input());
  assert.deepEqual([duplicate.error.code, duplicate.error.field], ["DUPLICATE_RESOURCE", "title"]);
});

test("updates send the observed revision and a mutation id, and conflicts are explained", async () => {
  const {api, calls} = fakeApi({
    getBook: async () => serverBook({revision: 7}),
    updateBook: async () => serverBook({title: "New", revision: 8}),
  });
  const service = createCloudBookService(api);
  const update = {title: " New ", author: "Author", description: "About", categoryId: "category-fiction", genreId: "genre-novel"};
  const ok = await service.updateBookDetails(publisher, "b1", {...update, revision: 3});
  assert.equal(ok.success, true);
  const [, id, dto] = calls.find(call => call[0] === "updateBook");
  assert.equal(id, "b1");
  assert.equal(dto.clientRevision, 3);
  assert.equal(dto.title, "New");
  assert.match(dto.mutationId, /[0-9a-f-]{36}/);
  assert.deepEqual(dto.categoryIds, ["category-fiction"]);
  await service.updateBookDetails(publisher, "b1", update);
  assert.equal(calls.filter(call => call[0] === "updateBook")[1][2].clientRevision, 7);

  const conflict = await createCloudBookService(fakeApi({
    updateBook: async () => { throw new ContentApiError("REVISION_CONFLICT", "Changed.", 409, {serverRevision: 9}); },
  }).api).updateBookDetails(publisher, "b1", {...update, revision: 1});
  assert.equal(conflict.error.code, "REVISION_CONFLICT");
  assert.match(conflict.error.message, /changed elsewhere/);
  assert.equal((await service.updateBookDetails(publisher, "b1", {...update, title: " "})).error.code, "VALIDATION_ERROR");
  assert.equal((await service.updateBookDetails(reader, "b1", update)).error.code, "FORBIDDEN_ROLE");
});

test("moderation and listing enforce roles and report server failures", async () => {
  const {api, calls} = fakeApi({
    listPendingBooks: async () => [serverBook({id: "old", createdAt: "2026-11-01T00:00:00.000Z"}), serverBook({id: "new"}), serverBook({id: "gone", status: "deleted"})],
    approveBook: async () => serverBook({status: "approved"}),
    rejectBook: async (id, reason) => serverBook({status: "rejected", rejectionReason: reason}),
    listMyBooks: async () => [serverBook()],
    listCatalog: async () => [serverBook({status: "approved"})],
  });
  const service = createCloudBookService(api);
  assert.deepEqual((await service.listPendingBooks(moderator)).map(book => book.id), ["new", "old"]);
  assert.deepEqual(await service.listPendingBooks(reader), []);
  assert.deepEqual(await service.listPublisherBooks(reader), []);
  assert.equal((await service.listPublisherBooks(publisher)).length, 1);
  assert.equal((await service.listApprovedBooks()).length, 1);
  assert.equal((await service.approveBook(reader, "b1")).error.code, "FORBIDDEN_ROLE");
  assert.equal((await service.rejectBook(publisher, "b1", "No")).error.code, "FORBIDDEN_ROLE");
  assert.equal((await service.rejectBook(moderator, "b1", "  ")).error.code, "VALIDATION_ERROR");
  assert.equal((await service.rejectBook(moderator, "b1", "x".repeat(501))).error.code, "VALIDATION_ERROR");
  const approved = await service.approveBook(moderator, "b1");
  assert.match(approved.message, /is now public/);
  const rejected = await service.rejectBook(moderator, "b1", " Spam ");
  assert.equal(rejected.data.rejectionReason, "Spam");
  assert.equal(calls.filter(call => call[0] === "rejectBook").length, 1);

  const failing = createCloudBookService(fakeApi({
    approveBook: async () => { throw new ContentApiError("INVALID_REQUEST", "The book has no uploaded file yet and cannot be approved.", 400); },
    rejectBook: async () => { throw new Error("network"); },
  }).api);
  assert.match((await failing.approveBook(moderator, "b1")).error.message, /no uploaded file/);
  assert.equal((await failing.rejectBook(moderator, "b1", "Reason")).error.code, "SERVICE_UNAVAILABLE");
  assert.equal((await service.deleteOwnedBook(publisher, "b1")).error.code, "NOT_SUPPORTED");
});
