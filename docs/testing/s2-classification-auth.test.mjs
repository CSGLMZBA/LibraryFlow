import assert from "node:assert/strict";
import { test } from "node:test";
import { createClassificationRouter } from "../../apps/backend/src/routes/classification-routes.ts";
import { createAuthGuard } from "../../apps/backend/src/middleware/auth-guard.ts";

const identities = {
  reader: {uid: "r", role: "reader"},
  publisher: {uid: "p", role: "publisher"},
  moderator: {uid: "m", role: "moderator"},
};
const router = createClassificationRouter(createAuthGuard(async token => identities[token] ?? null, "moderator"));

function call(method, url, token, body) {
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 200, locals: {},
      setHeader() {}, status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; resolve(this); return this; },
    };
    router.handle({method, url, body, headers: token ? {authorization: `Bearer ${token}`} : {}},
      response, error => reject(error ?? new Error("Route not handled")));
  });
}

test("classification reads are public but writes require a moderator", async () => {
  assert.equal((await call("GET", "/")).statusCode, 200);
  const before = (await call("GET", "/")).body.data;
  for (const [method, url] of [["POST", "/"], ["PATCH", "/category-fiction"]]) {
    const payload = {type: "category", name: "Injected"};
    assert.equal((await call(method, url, undefined, payload)).statusCode, 401);
    assert.equal((await call(method, url, "reader", payload)).statusCode, 403);
    assert.equal((await call(method, url, "publisher", payload)).statusCode, 403);
  }
  assert.deepEqual((await call("GET", "/")).body.data, before, "Rejected requests must not change classifications.");
  const created = await call("POST", "/", "moderator", {type: "category", name: "Moderator Category"});
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.data.name, "Moderator Category");
});
