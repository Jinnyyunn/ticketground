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
  const hasBody = body !== undefined;
  const response = await fetch(`${server.baseUrl}${pathName}`, {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      ...(hasBody ? { "Content-Type": "application/json" } : {})
    },
    body: hasBody ? JSON.stringify(body) : undefined
  });
  const json = await response.json();
  assert.equal(response.status, status, `${method} ${pathName}: ${JSON.stringify(json)}`);
  return json;
}

// GET/PUT/DELETE /api/me/watchlist(/:eventId) now run through
// watchlist-contract.js (requireNativePrincipal + Idempotency-Key, keeps
// userId on returned items, DELETE responds { removed, eventId }, and adds
// PUT /api/me/watchlist/:eventId/notification for the notification-only
// toggle) instead of engagement.js's *ForPrincipal functions
// (authenticateNativeSession + X-Idempotency-Key, userId redacted, DELETE
// responds { deleted, eventId }) that the three tests formerly here
// asserted. See watchlist-native-contract.test.mjs for the current
// contract coverage.

test("production disables legacy caller-selected watchlist routes", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t, { env: { TIG_DEMO_WATCHLIST_API: "" } });

  const legacyGet = await request(server, "/api/users/user_fan_a/watchlist", { status: 404 });
  assert.equal(legacyGet.error.code, "NOT_FOUND");

  for (const [pathName, body] of [
    ["/api/watchlist", { userId: "user_fan_a", eventId: "event_kpop_001" }],
    ["/api/watchlist/notify", { userId: "user_fan_a", eventId: "event_kpop_001" }]
  ]) {
    const response = await request(server, pathName, { method: "POST", body, status: 404 });
    assert.equal(response.error.code, "NOT_FOUND");
  }
});
