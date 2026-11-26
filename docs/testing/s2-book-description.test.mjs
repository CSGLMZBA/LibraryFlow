import assert from "node:assert/strict";
import { test } from "node:test";
import { BookRepository } from "../../apps/backend/src/repositories/book-repository.ts";
import { CommentRepository } from "../../apps/backend/src/repositories/comment-repository.ts";
import { NotificationRepository } from "../../apps/backend/src/repositories/notification-repository.ts";
import { BookService } from "../../apps/backend/src/services/book-service.ts";
import { ModerationService } from "../../apps/backend/src/services/moderation-service.ts";

const base = {title: "Title", author: "Author", fileType: "pdf", fileSizeBytes: 1000, categoryIds: [], genreIds: []};
const service = () => new BookService(new BookRepository(), undefined, async () => true);

test("a pending book cannot be approved until its file upload has completed", async () => {
  const books = new BookRepository();
  const service = new BookService(books, undefined, async () => true);
  const moderation = new ModerationService(books, new CommentRepository(), new NotificationRepository(), {});
  const created = await service.createBook({...base, description: "Needs a file"}, "owner");
  await assert.rejects(moderation.approveBook(created.id, "mod"), /no uploaded file/);
  assert.equal((await books.findById(created.id)).status, "pending");
  await books.update(created.id, {fileObjectPath: `books/${created.id}/1/file.pdf`});
  assert.equal((await moderation.approveBook(created.id, "mod")).status, "approved");
});

test("a book requires a trimmed description of 1 to 2000 characters", async () => {
  const books = service();
  for (const description of [undefined, null, 12, "", "   ", "x".repeat(2001)]) {
    await assert.rejects(books.createBook({...base, description}, "owner"), /description must contain between 1 and 2000/);
  }
  const created = await books.createBook({...base, description: `  ${"x".repeat(2000)}  `}, "owner");
  assert.equal(created.description.length, 2000);
  assert.equal(created.revision, 1);
});

test("description updates are validated, revision-checked, and unchanged on failure", async () => {
  const books = service();
  const created = await books.createBook({...base, description: "Original"}, "owner");
  await assert.rejects(books.updateBookMetadata(created.id, {description: "  ", clientRevision: 1}, "owner"),
    /description must contain/);
  await assert.rejects(books.updateBookMetadata(created.id, {description: "x".repeat(2001)}, "owner"),
    /description must contain/);
  assert.equal((await books.getBookDetails(created.id, "owner")).description, "Original");
  const updated = await books.updateBookMetadata(created.id, {description: " Revised ", clientRevision: 1}, "owner");
  assert.equal(updated.description, "Revised");
  assert.equal(updated.revision, 2);
  await assert.rejects(books.updateBookMetadata(created.id, {description: "Stale", clientRevision: 1}, "owner"),
    {name: "RevisionConflictError"});
  const untouched = await books.updateBookMetadata(created.id, {title: "New title"}, "owner");
  assert.equal(untouched.description, "Revised");
});
