import assert from "node:assert/strict";
import { test } from "node:test";

import {
  bookService,
  RevisionConflictError,
} from "../../apps/backend/src/services/book-service.ts";

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
