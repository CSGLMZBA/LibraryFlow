import assert from "node:assert/strict";
import { test } from "node:test";
import { internalRouter } from "../../apps/backend/src/routes/internal-routes.ts";

const secret = "s".repeat(40);

function call(authorization) {
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 200, headers: {},
      setHeader() {}, status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; resolve(this); return this; },
    };
    internalRouter.handle({method: "POST", url: "/publisher-applications/expire",
      headers: authorization ? {authorization} : {}}, response,
      error => reject(error ?? new Error("Route not handled")));
  });
}

test("expiry route requires the worker secret and reports disabled when cloud applications are off", async () => {
  const previous = process.env.DELETION_WORKER_SECRET;
  process.env.DELETION_WORKER_SECRET = secret;
  try {
    assert.equal((await call()).statusCode, 401);
    assert.equal((await call(`Bearer ${"x".repeat(40)}`)).statusCode, 401);
    const accepted = await call(`Bearer ${secret}`);
    assert.equal(accepted.statusCode, 200);
    assert.deepEqual(accepted.body, {success: true, data: {enabled: false, expired: 0, failed: 0}});
    delete process.env.DELETION_WORKER_SECRET;
    assert.equal((await call(`Bearer ${secret}`)).statusCode, 503);
  } finally {
    if (previous === undefined) delete process.env.DELETION_WORKER_SECRET;
    else process.env.DELETION_WORKER_SECRET = previous;
  }
});
