import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BookService,
  bookService,
  RevisionConflictError,
} from "../../apps/backend/src/services/book-service.ts";
import { BookRepository } from "../../apps/backend/src/repositories/book-repository.ts";

const validBookPayload = (title) => ({
  title,
  author: "Test Author",
  fileType: "pdf",
  fileSizeBytes: 4096,
  categoryIds: [],
  genreIds: [],
});

test("S2-AC-005 (TC-S2-REV-01): newly created book initializes with revision = 1", async () => {
  const book = await bookService.createBook(
    validBookPayload("Revision Initialization"),
    "publisher-revision-01",
  );

  assert.equal(book.revision, 1);
  assert.equal(book.status, "pending");
});

test("S2-AC-005 (TC-S2-REV-02): update with matching clientRevision increments revision", async () => {
  const book = await bookService.createBook(
    validBookPayload("Matching Revision"),
    "publisher-revision-02",
  );

  const updated = await bookService.updateBookMetadata(
    book.id,
    {
      title: "Matching Revision Updated",
      clientRevision: 1,
    },
    "publisher-revision-02",
  );

  assert.equal(updated.revision, 2);
});

test("S2-AC-005 (TC-S2-REV-03): update with stale clientRevision throws RevisionConflictError with serverRevision and serverValue", async () => {
  const book = await bookService.createBook(
    validBookPayload("Stale Revision"),
    "publisher-revision-03",
  );

  await bookService.updateBookMetadata(
    book.id,
    {
      title: "Stale Revision First Update",
      clientRevision: 1,
    },
    "publisher-revision-03",
  );

  await assert.rejects(
    () =>
      bookService.updateBookMetadata(
        book.id,
        {
          title: "Stale Revision Second Update",
          clientRevision: 1,
        },
        "publisher-revision-03",
      ),
    (error) => {
      assert.ok(error instanceof RevisionConflictError);
      assert.equal(error.resourceId, book.id);
      assert.equal(error.serverRevision, 2);
      assert.equal(error.serverValue.id, book.id);
      assert.equal(error.serverValue.revision, 2);
      return true;
    },
  );
});

test("S2-AC-005 (TC-S2-REV-04): repeated update with identical mutationId is idempotent and returns cached result", async () => {
  const book = await bookService.createBook(
    validBookPayload("Mutation Replay"),
    "publisher-revision-04",
  );
  const mutationId = "mutation-s2-revision-04";

  const first = await bookService.updateBookMetadata(
    book.id,
    {
      title: "Mutation Replay Updated",
      clientRevision: 1,
      mutationId,
    },
    "publisher-revision-04",
  );
  const repeated = await bookService.updateBookMetadata(
    book.id,
    {
      title: "A Different Attempt",
      clientRevision: 999,
      mutationId,
    },
    "publisher-revision-04",
  );

  assert.deepEqual(repeated, first);
  assert.equal(repeated.revision, 2);
});

test("S2-AC-005: mutation replay is authorized and scoped to the requester and book", async () => {
  const firstBook = await bookService.createBook(validBookPayload("First"), "owner-a");
  const secondBook = await bookService.createBook(validBookPayload("Second"), "owner-b");
  const thirdBook = await bookService.createBook(validBookPayload("Third"), "owner-a");
  const mutationId = "scoped-replay";
  await bookService.updateBookMetadata(firstBook.id, {title: "First updated", clientRevision: 1, mutationId}, "owner-a");

  await assert.rejects(
    () => bookService.updateBookMetadata(firstBook.id, {title: "Unauthorized", mutationId}, "owner-b"),
    /not authorized/,
  );
  const updatedSecond = await bookService.updateBookMetadata(
    secondBook.id, {title: "Second updated", clientRevision: 1, mutationId}, "owner-b",
  );
  assert.equal(updatedSecond.id, secondBook.id);
  assert.equal(updatedSecond.title, "Second updated");
  assert.equal(updatedSecond.revision, 2);
  const updatedThird = await bookService.updateBookMetadata(
    thirdBook.id, {title: "Third updated", clientRevision: 1, mutationId}, "owner-a",
  );
  assert.equal(updatedThird.id, thirdBook.id);
  assert.equal(updatedThird.title, "Third updated");
  await assert.rejects(
    () => bookService.updateBookMetadata("missing-book", {title: "Missing", mutationId}, "owner-a"),
    /not found/,
  );
});

test("concurrent metadata updates with the same revision preserve the winning value", async () => {
  const repository = new BookRepository();
  const firstService = new BookService(repository);
  const secondService = new BookService(repository);
  const book = await firstService.createBook(validBookPayload("Concurrent"), "owner");
  const results = await Promise.allSettled([
    firstService.updateBookMetadata(book.id, {title: "First", clientRevision: 1}, "owner"),
    secondService.updateBookMetadata(book.id, {title: "Second", clientRevision: 1}, "owner"),
  ]);
  const successes = results.filter((result) => result.status === "fulfilled");
  const failures = results.filter((result) => result.status === "rejected");
  assert.equal(successes.length, 1);
  assert.equal(failures.length, 1);
  const winner = successes[0].value;
  assert.ok(failures[0].reason instanceof RevisionConflictError);
  assert.equal(failures[0].reason.serverRevision, 2);
  assert.deepEqual(failures[0].reason.serverValue, winner);
  assert.deepEqual(await repository.findById(book.id), winner);
});

test("concurrent duplicate metadata mutations replay a single result", async () => {
  const repository = new BookRepository();
  const firstService = new BookService(repository);
  const secondService = new BookService(repository);
  const book = await firstService.createBook(validBookPayload("Concurrent replay"), "owner");
  const dto = {title: "Updated", clientRevision: 1, mutationId: "concurrent-replay"};
  const [first, second] = await Promise.all([
    firstService.updateBookMetadata(book.id, dto, "owner"),
    secondService.updateBookMetadata(book.id, dto, "owner"),
  ]);
  assert.deepEqual(first, second);
  assert.equal(first.revision, 2);
  first.categoryIds.push("not-persisted");
  const replay = await firstService.updateBookMetadata(book.id, dto, "owner");
  assert.deepEqual(replay.categoryIds, []);
  assert.deepEqual((await repository.findById(book.id)).categoryIds, []);
});

test("S2-AC-005 / S2-AC-008 (TC-S2-REV-05): moderator deleteBook sets status to deleted and increments revision", async () => {
  const book = await bookService.createBook(
    validBookPayload("Moderator Delete"),
    "publisher-revision-05",
  );
  const originalRevision = book.revision;

  const deleted = await bookService.deleteBook(
    book.id,
    "moderator-s2-revision-05",
  );

  assert.equal(deleted.status, "deleted");
  assert.equal(deleted.revision, originalRevision + 1);
});

test("S2-AC-005 (TC-S2-REV-06): multiple sequential updates increment revision monotonically", async () => {
  const book = await bookService.createBook(
    validBookPayload("Sequential Updates"),
    "publisher-revision-06",
  );

  const firstUpdate = await bookService.updateBookMetadata(
    book.id,
    {
      title: "Sequential Updates First",
      clientRevision: 1,
    },
    "publisher-revision-06",
  );
  assert.equal(firstUpdate.revision, 2);

  const secondUpdate = await bookService.updateBookMetadata(
    book.id,
    {
      title: "Sequential Updates Second",
      clientRevision: 2,
    },
    "publisher-revision-06",
  );
  assert.equal(secondUpdate.revision, 3);
});

test("S2-AC-005 (TC-S2-REV-07): update with future clientRevision throws RevisionConflictError", async () => {
  const book = await bookService.createBook(
    validBookPayload("Future Revision"),
    "publisher-revision-07",
  );

  await assert.rejects(
    () =>
      bookService.updateBookMetadata(
        book.id,
        {
          title: "Future Revision Update",
          clientRevision: 10,
        },
        "publisher-revision-07",
      ),
    (error) => {
      assert.ok(error instanceof RevisionConflictError);
      assert.equal(error.serverRevision, 1);
      assert.equal(error.resourceId, book.id);
      return true;
    },
  );
});
