import assert from "node:assert/strict";
import { test } from "node:test";
import { addComment } from "../../apps/backend/src/controllers/comment-controller.ts";
import { CommentService, commentService } from "../../apps/backend/src/services/comment-service.ts";
import { BookRepository } from "../../apps/backend/src/repositories/book-repository.ts";
import { CommentRepository } from "../../apps/backend/src/repositories/comment-repository.ts";

function post(bookId, auth, headers, body) {
  const response = {
    statusCode: 200, locals: {auth},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return addComment({params: {bookId}, headers, body}, response).then(() => response);
}

test("the comment controller passes the verified display name and ignores a client header", async () => {
  const original = commentService.addComment;
  const calls = [];
  commentService.addComment = async (...args) => { calls.push(args); return {id: "c"}; };
  try {
    const spoofed = await post("book", {uid: "reader-1", role: "reader", displayName: "Real Name"},
      {"x-user-display-name": "Moderator Admin"}, {content: "Hello"});
    assert.equal(spoofed.statusCode, 201);
    assert.deepEqual(calls, [["book", "Hello", "reader-1", "Real Name"]]);
    await post("book", {uid: "reader-2", role: "reader"}, {"x-user-display-name": "Moderator Admin"}, {content: "Hi"});
    assert.equal(calls[1][3], undefined, "A header must never become the author name.");
  } finally {
    commentService.addComment = original;
  }
});

test("the comment service requires a verified display name and string content", async () => {
  const books = new BookRepository();
  await books.save({
    id: "b", title: "T", author: "A", ownerId: "owner", description: "D", status: "approved",
    accessKey: "k", shareableUrl: "/books/b", fileUrl: "", fileType: "pdf", fileSizeBytes: 1,
    categoryIds: [], genreIds: [], createdAt: "2026-11-25T00:00:00.000Z", updatedAt: "2026-11-25T00:00:00.000Z", revision: 1,
  });
  const comments = new CommentRepository();
  const service = new CommentService(books, comments, async () => true);
  for (const name of [undefined, "", "   ", "x".repeat(101)]) {
    await assert.rejects(service.addComment("b", "Hello", "u", name), /verified display name/);
  }
  for (const content of [undefined, 5, "   "]) {
    await assert.rejects(service.addComment("b", content, "u", "Real Name"), /Comment must contain/);
  }
  const saved = await service.addComment("b", "  Hello  ", "u", " Real Name ");
  assert.equal(saved.authorDisplayName, "Real Name");
  assert.equal(saved.content, "Hello");
  assert.equal((await comments.findByBookId("b")).length, 1);
});
