import assert from "node:assert/strict";
import { test } from "node:test";
import { ContentApiError, createCloudContentApi } from "../../apps/frontend/src/services/cloud-content-api.ts";

function setup({token = "session-token", reply} = {}) {
  const calls = [];
  const sessions = {count: 0};
  const auth = {
    async getCurrentSession() { sessions.count++; return token ? {user: {id: "u"}} : null; },
    getAccessToken() { return token; },
  };
  const transport = async (url, init) => {
    calls.push({url, init});
    if (reply) return reply(url, init);
    return new Response(JSON.stringify({success: true, data: []}), {status: 200});
  };
  return {calls, sessions, api: createCloudContentApi(auth, "https://api.example/", transport)};
}

test("authenticated calls revalidate the session and send only the bearer token", async () => {
  const {api, calls, sessions} = setup();
  await api.listMyBooks();
  await api.createBook({title: "T"});
  await api.rejectBook("book 1", "Reason");
  await api.removeComment("c/1", "Spam");
  assert.equal(sessions.count, 4);
  assert.deepEqual(calls.map(c => [c.init.method, c.url]), [
    ["GET", "https://api.example/api/v1/books/mine"],
    ["POST", "https://api.example/api/v1/books"],
    ["POST", "https://api.example/api/v1/moderation/books/book%201/reject"],
    ["DELETE", "https://api.example/api/v1/moderation/comments/c%2F1"],
  ]);
  for (const call of calls) {
    assert.equal(call.init.headers.Authorization, "Bearer session-token");
    assert.equal(call.init.cache, "no-store");
    assert.equal(JSON.stringify(call.init.headers).includes("x-user"), false, "No identity headers are sent.");
  }
  assert.equal(calls[0].init.headers["Content-Type"], undefined);
  assert.equal(calls[2].init.body, JSON.stringify({reason: "Reason"}));
});

test("required calls make no request without a session, while public reads still work", async () => {
  const {api, calls} = setup({token: null});
  await assert.rejects(api.listMyBooks(), {code: "AUTH_REQUIRED", status: 401});
  await assert.rejects(api.addComment("b", "Hello"), {code: "AUTH_REQUIRED"});
  await assert.rejects(api.requestDownloadUrl("b"), {code: "AUTH_REQUIRED"});
  assert.equal(calls.length, 0);
  await api.listCatalog({search: "dune", categoryId: "", genreId: "g 1"});
  await api.listComments("b");
  assert.equal(calls[0].url, "https://api.example/api/v1/books?search=dune&genreId=g+1");
  assert.equal(calls[0].init.headers.Authorization, undefined);
});

test("failures keep their code, status and server value, and network errors are explicit", async () => {
  const conflict = setup({reply: async () => new Response(JSON.stringify({
    success: false, error: {code: "REVISION_CONFLICT", message: "Changed."},
    data: {resourceId: "b", serverRevision: 4, serverValue: {title: "Server"}},
  }), {status: 409})});
  await assert.rejects(conflict.api.updateBook("b", {title: "Mine", clientRevision: 1}), error => {
    assert.ok(error instanceof ContentApiError);
    assert.equal(error.code, "REVISION_CONFLICT");
    assert.equal(error.status, 409);
    assert.equal(error.data.serverRevision, 4);
    return true;
  });
  const malformed = setup({reply: async () => new Response("<html>", {status: 502})});
  await assert.rejects(malformed.api.listCatalog(), {code: "REQUEST_FAILED", status: 502});
  const offline = setup({reply: async () => { throw new Error("socket"); }});
  await assert.rejects(offline.api.listCatalog(), {code: "SERVICE_UNAVAILABLE"});
  const unavailable = setup({reply: async () => new Response(JSON.stringify({
    success: false, error: {code: "STORAGE_UNAVAILABLE", message: "Book storage is temporarily unavailable."}}), {status: 503})});
  await assert.rejects(unavailable.api.listCatalog(), {code: "STORAGE_UNAVAILABLE", status: 503});
});

test("signed upload and download go to the storage host without the session token", async () => {
  const {api, calls} = setup({reply: async (url) => url.includes("download")
    ? new Response(new Blob(["file bytes"]), {status: 200})
    : new Response(null, {status: 200})});
  await api.uploadToSignedUrl("https://storage.example/upload?token=one-time", new Blob(["x"]), "application/pdf");
  const blob = await api.fetchSignedFile("https://storage.example/download?token=one-time");
  assert.equal(await blob.text(), "file bytes");
  for (const call of calls) {
    assert.equal(call.init.headers?.Authorization, undefined);
  }
  assert.equal(calls[0].init.method, "PUT");
  assert.equal(calls[0].init.headers["Content-Type"], "application/pdf");

  const failing = setup({reply: async () => new Response("denied", {status: 403})});
  await assert.rejects(failing.api.uploadToSignedUrl("https://s/u", new Blob(["x"]), "application/pdf"), {code: "UPLOAD_FAILED", status: 403});
  await assert.rejects(failing.api.fetchSignedFile("https://s/d"), {code: "DOWNLOAD_FAILED", status: 403});
  const offline = setup({reply: async () => { throw new Error("socket"); }});
  await assert.rejects(offline.api.uploadToSignedUrl("https://s/u", new Blob(["x"]), "application/pdf"), {code: "UPLOAD_FAILED", status: 0});
});
