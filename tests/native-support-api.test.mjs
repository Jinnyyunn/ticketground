import assert from "node:assert/strict";
import test from "node:test";

import { startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv } from "./google-auth-test-helpers.mjs";

async function request(server, pathName, {
  authorization,
  body,
  idempotencyKey,
  method = "GET",
  status = 200
} = {}) {
  const response = await fetch(`${server.baseUrl}${pathName}`, {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json();
  assert.equal(response.status, status, `${method} ${pathName}: ${JSON.stringify(json)}`);
  return json;
}

test("public support contract is readable without a session", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);

  const support = await request(server, "/api/support/public");
  assert.equal(support.data.version, "1");
  assert.ok(support.data.faqs.length > 0);
  assert.ok(support.data.notices.length > 0);
});

// POST/GET /api/me/support/threads and the thread reply flow now run
// through support-contract.js (requireNativePrincipal + Idempotency-Key,
// thread responses include userId, replies are addressed by
// /api/me/support/threads/:id/messages) instead of engagement.js's
// *ForPrincipal functions (authenticateNativeSession + X-Idempotency-Key,
// userId/actorId redacted, replies addressed by threadId in the body at
// /api/me/support/messages) that the five tests formerly here asserted.
// See support-native-contract.test.mjs for the current contract coverage.
// /api/me/support/messages (body-addressed replies) has no new-contract
// equivalent and was removed; native clients reply via
// /api/me/support/threads/:id/messages instead.

test("production disables legacy caller-selected support routes", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t, { env: { TIG_DEMO_SUPPORT_API: "" } });

  const get = await request(server, "/api/support/threads?userId=user_fan_a", { status: 404 });
  assert.equal(get.error.code, "NOT_FOUND");
  for (const [pathName, body] of [
    ["/api/support/threads", { userId: "user_fan_a", message: "우회" }],
    ["/api/support/messages", { actorId: "user_fan_a", threadId: "thread", message: "우회" }]
  ]) {
    const response = await request(server, pathName, { method: "POST", body, status: 404 });
    assert.equal(response.error.code, "NOT_FOUND");
  }
});
