import assert from "node:assert/strict";
import { test } from "node:test";
import { BookRepository } from "../../apps/backend/src/repositories/book-repository.ts";
import { CommentRepository } from "../../apps/backend/src/repositories/comment-repository.ts";
import { NotificationRepository } from "../../apps/backend/src/repositories/notification-repository.ts";
import { BookService } from "../../apps/backend/src/services/book-service.ts";
import { ModerationService } from "../../apps/backend/src/services/moderation-service.ts";

const book = (id, ownerId, status, createdAt) => ({
  id, title: id, author: "A", ownerId, description: "D", status, accessKey: id, shareableUrl: `/books/${id}`,
  fileUrl: "", fileType: "pdf", fileSizeBytes: 1, categoryIds: [], genreIds: [], createdAt, updatedAt: createdAt, revision: 1,
});

test("owners list their own books in every state except deleted, newest first", async () => {
  const repository = new BookRepository();
  await repository.save(book("old-pending", "alice", "pending", "2026-11-01T00:00:00.000Z"));
  await repository.save(book("new-rejected", "alice", "rejected", "2026-11-03T00:00:00.000Z"));
  await repository.save(book("approved", "alice", "approved", "2026-11-02T00:00:00.000Z"));
  await repository.save(book("gone", "alice", "deleted", "2026-11-04T00:00:00.000Z"));
  await repository.save(book("bobs", "bob", "approved", "2026-11-05T00:00:00.000Z"));
  const service = new BookService(repository, undefined, async () => true);
  assert.deepEqual((await service.listOwnedBooks("alice")).map(b => b.id), ["new-rejected", "approved", "old-pending"]);
  assert.deepEqual(await service.listOwnedBooks("nobody"), []);
});

test("the moderation queue lists the newest active comments only, capped at 200", async () => {
  const comments = new CommentRepository();
  for (let index = 0; index < 205; index++) {
    await comments.create({id: `c${index}`, bookId: "b", authorId: "u", authorDisplayName: "U", content: "x",
      createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, index)).toISOString(), isDeleted: false});
  }
  await comments.create({id: "removed", bookId: "b", authorId: "u", authorDisplayName: "U", content: "x",
    createdAt: "2027-01-01T00:00:00.000Z", isDeleted: true});
  const moderation = new ModerationService(new BookRepository(), comments, new NotificationRepository(), {});
  const recent = await moderation.getRecentComments();
  assert.equal(recent.length, 200);
  assert.equal(recent[0].id, "c204");
  assert.equal(recent.some(comment => comment.id === "removed"), false);
});
