import assert from "node:assert/strict";
import { test } from "node:test";
import { ContentApiError } from "../../apps/frontend/src/services/cloud-content-api.ts";
import { createCloudCommentService } from "../../apps/frontend/src/services/cloud-comment-service.ts";

const moderator = {id: "m", email: "m@example.com", displayName: "Mod", role: "moderator", createdAt: "x"};
const publisher = {...moderator, id: "p", role: "publisher"};
const comment = {id: "c1", bookId: "b1", authorId: "u", authorDisplayName: "Real", content: "Hi", createdAt: "2026-11-25T00:00:00.000Z", isDeleted: false};

function fake(overrides = {}) {
  const calls = [];
  const wrap = name => async (...args) => { calls.push([name, ...args]); return overrides[name] ? overrides[name](...args) : comment; };
  return {calls, api: {
    listComments: wrap("listComments"), addComment: wrap("addComment"),
    listModerationComments: wrap("listModerationComments"), removeComment: wrap("removeComment"),
  }};
}

test("posting sends only trimmed content, never an author name, and validates first", async () => {
  const {api, calls} = fake();
  const service = createCloudCommentService(api);
  for (const content of [undefined, "", "   ", "x".repeat(1001)]) {
    const result = await service.addReaderComment("b1", {id: "u", displayName: "Spoofed Moderator"}, {content});
    assert.equal(result.success, false);
    assert.equal(result.error.code, "VALIDATION_ERROR");
  }
  assert.equal(calls.length, 0);
  const ok = await service.addReaderComment("b1", {id: "u", displayName: "Spoofed Moderator"}, {content: "  Hello  "});
  assert.equal(ok.success, true);
  assert.deepEqual(calls, [["addComment", "b1", "Hello"]]);
});

test("moderation requires the moderator role and a reason before any request", async () => {
  const {api, calls} = fake();
  const service = createCloudCommentService(api);
  assert.equal((await service.moderateComment(publisher, "c1", "Spam")).error.code, "FORBIDDEN_ROLE");
  assert.equal((await service.moderateComment(moderator, "c1", "  ")).error.code, "VALIDATION_ERROR");
  assert.equal((await service.moderateComment(moderator, "c1", "x".repeat(501))).error.code, "VALIDATION_ERROR");
  assert.equal(calls.length, 0);
  assert.equal((await service.moderateComment(moderator, "c1", " Spam ")).success, true);
  assert.deepEqual(calls, [["removeComment", "c1", "Spam"]]);
  assert.deepEqual(await service.listAllForModeration(), comment);
});

test("server failures surface their message and network failures are generic", async () => {
  const denied = createCloudCommentService(fake({addComment: async () => { throw new ContentApiError("ACCOUNT_RESTRICTED", "This account is restricted or pending deletion.", 403); }}).api);
  const result = await denied.addReaderComment("b1", {id: "u", displayName: "x"}, {content: "Hi"});
  assert.deepEqual([result.success, result.error.code], [false, "ACCOUNT_RESTRICTED"]);
  const offline = createCloudCommentService(fake({removeComment: async () => { throw new Error("socket"); },
    listComments: async () => { throw new Error("socket"); }}).api);
  assert.equal((await offline.moderateComment(moderator, "c1", "Spam")).error.code, "SERVICE_UNAVAILABLE");
  assert.equal((await offline.getPublisherBookComments(publisher, "b1")).error.code, "SERVICE_UNAVAILABLE");
  assert.equal((await offline.getPublisherBookComments(moderator, "b1")).error.code, "FORBIDDEN_ROLE");
});
