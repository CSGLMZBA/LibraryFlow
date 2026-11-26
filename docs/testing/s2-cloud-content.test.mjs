import assert from "node:assert/strict";
import { test } from "node:test";
import { FirestoreBookRepository } from "../../apps/backend/src/repositories/book-repository.ts";
import { FirestoreCommentRepository } from "../../apps/backend/src/repositories/comment-repository.ts";
import { FirestoreNotificationRepository } from "../../apps/backend/src/repositories/notification-repository.ts";

function fakeFirestore() {
  let records = new Map();
  let running = Promise.resolve();
  let failing = "";
  const snap = (path, source) => {
    const data = source.get(path);
    return {id: path.split("/")[1], exists: data !== undefined, data: () => structuredClone(data)};
  };
  const rejectUndefined = value => {
    for (const [key, entry] of Object.entries(value)) {
      assert.notEqual(entry, undefined, `Firestore cannot store undefined (${key})`);
    }
  };
  const writer = (source, path, op, data) => {
    if (path.startsWith(`${failing}/`)) throw new Error("storage failed");
    if (data) rejectUndefined(data);
    if (op === "create") assert.equal(source.has(path), false, "document already exists");
    if (op === "update") source.set(path, {...source.get(path), ...structuredClone(data)});
    else source.set(path, structuredClone(data));
  };
  const db = {
    fail(name) { failing = name; },
    values(name) { return [...records].filter(([path]) => path.startsWith(`${name}/`)).map(([, data]) => structuredClone(data)); },
    collection(name) {
      return {
        doc(id) {
          const path = `${name}/${id}`;
          return {
            id, path,
            async get() { return snap(path, records); },
            async set(data) { writer(records, path, "set", data); },
            async create(data) { writer(records, path, "create", data); },
          };
        },
        where(field, op, value) {
          assert.equal(op, "==");
          return {collection: name, field, value, async get() {
            return {docs: [...records].filter(([path, data]) => path.startsWith(`${name}/`) && data[field] === value)
              .map(([path]) => snap(path, records))};
          }};
        },
      };
    },
    runTransaction(operation) {
      const task = running.then(async () => {
        const staged = structuredClone(records);
        const result = await operation({
          async get(ref) { return snap(ref.path, staged); },
          set(ref, data) { writer(staged, ref.path, "set", data); },
          create(ref, data) { writer(staged, ref.path, "create", data); },
          update(ref, data) { writer(staged, ref.path, "update", data); },
        });
        records = staged;
        return result;
      });
      running = task.then(() => undefined, () => undefined);
      return task;
    },
  };
  return db;
}

const book = (id, ownerId = "alice", extra = {}) => ({
  id, title: `Title ${id}`, author: "Author", ownerId, status: "approved", accessKey: `key-${id}`,
  shareableUrl: `/books/${id}`, fileUrl: "", fileType: "pdf", fileSizeBytes: 10, categoryIds: ["c1"],
  genreIds: ["g1"], createdAt: "2026-11-25T00:00:00.000Z", updatedAt: "2026-11-25T00:00:00.000Z", revision: 1, ...extra,
});

test("books persist across repository instances, filter the catalog, and never store undefined", async () => {
  const db = fakeFirestore();
  const first = new FirestoreBookRepository(() => db);
  await first.save(book("1"));
  await first.save(book("2", "bob", {status: "pending", rejectionReason: undefined}));
  const second = new FirestoreBookRepository(() => db);
  assert.equal((await second.findById("1")).title, "Title 1");
  assert.deepEqual((await second.findApproved({search: "title 1"})).map(b => b.id), ["1"]);
  assert.deepEqual((await second.findApproved({categoryId: "nope"})), []);
  assert.deepEqual((await second.findPending()).map(b => b.id), ["2"]);
  assert.deepEqual((await second.findByOwner("bob")).map(b => b.id), ["2"]);
  const updated = await second.update("2", {status: "rejected", rejectionReason: "Bad", scheduledDeletionDate: undefined});
  assert.equal(updated.status, "rejected");
  await assert.rejects(second.update("2", {ownerId: "mallory"}), /owner cannot be changed/);
  await assert.rejects(second.update("2", {id: "other"}), /ID cannot be changed/);
  assert.equal(await second.update("missing", {title: "x"}), null);
});

test("metadata updates compare revisions, replay by mutation, and surface validation errors", async () => {
  const db = fakeFirestore();
  const repository = new FirestoreBookRepository(() => db);
  await repository.save(book("1"));
  const apply = (requester, moderator, revision, mutation, title = "New") =>
    repository.updateMetadata("1", requester, moderator, revision, mutation, () => ({title}), "2026-11-26T00:00:00.000Z");
  assert.equal((await apply("bob", false, 1, "m0")).kind, "forbidden");
  assert.equal((await apply("alice", false, 9, "m1")).kind, "conflict");
  const outcomes = await Promise.all([apply("alice", false, 1, "m2", "A"), apply("alice", false, 1, "m3", "B")]);
  assert.deepEqual(outcomes.map(o => o.kind).sort(), ["conflict", "updated"]);
  const winner = outcomes.find(o => o.kind === "updated");
  const mutation = winner.book.title === "A" ? "m2" : "m3";
  const replay = await apply("alice", false, 1, mutation, "ignored");
  assert.equal(replay.kind, "updated");
  assert.equal(replay.book.revision, 2);
  assert.equal((await repository.findById("1")).revision, 2);
  assert.equal((await apply("alice", false, undefined, "other-requester-key")).kind, "updated");
  await assert.rejects(repository.updateMetadata("1", "alice", false, undefined, undefined,
    () => { throw new Error("title must be valid"); }, "x"), /title must be valid/);
  assert.equal((await repository.updateMetadata("none", "alice", false, 1, undefined, () => ({}), "x")).kind, "not_found");
});

test("redacting an owner hides their books and storage failures are reported safely", async () => {
  const db = fakeFirestore();
  const repository = new FirestoreBookRepository(() => db);
  await repository.save(book("1", "alice"));
  await repository.save(book("2", "bob"));
  await repository.redactOwner("alice");
  assert.equal(await repository.findById("1"), null);
  assert.deepEqual((await repository.findApproved()).map(b => b.id), ["2"]);
  assert.equal(db.values("books").find(b => b.id === "1").author, "Deleted user");
  db.fail("books");
  await assert.rejects(repository.save(book("3")), {name: "BookStoreError"});
  await assert.rejects(repository.update("2", {title: "x"}), {name: "BookStoreError"});
});

test("comments persist, sort newest first, soft delete with moderation data, and redact authors", async () => {
  const db = fakeFirestore();
  const comments = new FirestoreCommentRepository(() => db);
  const comment = (id, createdAt, authorId = "alice") => ({id, bookId: "b1", authorId, authorDisplayName: "Alice",
    content: "Hello", createdAt, isDeleted: false});
  await comments.create(comment("c1", "2026-11-25T01:00:00.000Z"));
  await comments.create(comment("c2", "2026-11-25T02:00:00.000Z", "bob"));
  await assert.rejects(comments.create(comment("c1", "2026-11-25T03:00:00.000Z")), {name: "CommentStoreError"});
  const other = new FirestoreCommentRepository(() => db);
  assert.deepEqual((await other.findByBookId("b1")).map(c => c.id), ["c2", "c1"]);
  const removed = await other.softDelete("c2", {moderatorId: "mod", reason: "Spam", moderatedAt: "2026-11-25T04:00:00.000Z"});
  assert.equal(removed.isDeleted, true);
  assert.equal(removed.moderatedBy, "mod");
  assert.deepEqual((await other.findByBookId("b1")).map(c => c.id), ["c1"]);
  assert.equal((await other.findByBookId("b1", true)).length, 2);
  assert.equal(await other.softDelete("missing", {moderatorId: "m", reason: "r", moderatedAt: "t"}), null);
  await other.redactAuthor("alice");
  const redacted = await other.findById("c1");
  assert.equal(redacted.content, "");
  assert.equal(redacted.authorDisplayName, "Deleted user");
  assert.equal((await other.findById("c2")).moderationReason, "Spam");
});

test("notifications persist for the recipient only and can be marked read", async () => {
  const db = fakeFirestore();
  const notifications = new FirestoreNotificationRepository(() => db);
  const item = (id, userId) => ({id, userId, type: "book_rejected", message: "Rejected", read: false, createdAt: "2026-11-25T00:00:00.000Z"});
  await notifications.create(item("n1", "alice"));
  await notifications.create(item("n2", "bob"));
  const other = new FirestoreNotificationRepository(() => db);
  assert.deepEqual((await other.findByUserId("alice")).map(n => n.id), ["n1"]);
  await other.markAsRead("n1");
  await other.markAsRead("missing");
  assert.equal((await other.findByUserId("alice"))[0].read, true);
  assert.equal((await other.findByUserId("bob"))[0].read, false);
  db.fail("notifications");
  await assert.rejects(other.create(item("n3", "alice")), {name: "NotificationStoreError"});
});
