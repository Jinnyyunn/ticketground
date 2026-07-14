import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { api, appAttestation, appAttestationFor, startServer } from "./backend-test-utils.mjs";

test("api-only health and GET routes do not rewrite the DB file", async (t) => {
  // Given: the API-only server has finished startup and the DB file is stable.
  const server = await startServer(t);
  const before = await stat(server.dbPath);

  // When: mobile connectivity and read-only state endpoints are called.
  const health = await api(server.apiOnlyUrl, "/api/health");
  const state = await api(server.apiOnlyUrl, "/api/state");
  const after = await stat(server.dbPath);

  // Then: health is cheap, /api/state omits the full ticket table by default, and no GET rewrites the DB.
  assert.equal(health.data.status, "UP");
  assert.equal(typeof health.data.time, "string");
  assert.equal(state.data.tickets, undefined);
  assert.equal(typeof state.data.backendSummary.tickets, "number");
  assert.equal(after.mtimeMs, before.mtimeMs);
});

test("app config reflects environment overrides", async (t) => {
  // Given: ops-provided mobile version and maintenance env vars.
  const server = await startServer(t, {
    env: {
      TIG_APP_MIN_VERSION: "1.4.0",
      TIG_APP_RECOMMENDED_VERSION: "1.6.2",
      TIG_MAINTENANCE_MODE: "1",
      TIG_MAINTENANCE_MESSAGE: "점검 중입니다."
    }
  });

  // When: the app reads runtime configuration.
  const config = await api(server.apiOnlyUrl, "/api/app/config");

  // Then: env overrides and app-channel endpoint policy are returned.
  assert.equal(config.data.minSupportedVersion, "1.4.0");
  assert.equal(config.data.recommendedVersion, "1.6.2");
  assert.equal(config.data.maintenanceMode, true);
  assert.equal(config.data.maintenanceMessage, "점검 중입니다.");
  assert.deepEqual(config.data.appChannelRequired, ["/api/devices/trust", "/api/tickets/qr"]);
});

test("attestation nonce is required, single-use, and expires", async (t) => {
  // Given: a short nonce TTL for an integration-speed expiry check.
  const server = await startServer(t, { env: { TIG_APP_ATTESTATION_NONCE_TTL_MS: "50" } });
  const first = await appAttestationFor(server.baseUrl, "TRUST_DEVICE", "user_fan_a", "iphone-single-use");

  // When: one valid trust request consumes the nonce.
  const trusted = await api(server.baseUrl, "/api/devices/trust", {
    userId: "user_fan_a",
    deviceId: "iphone-single-use",
    biometricVerified: true,
    ...first
  });

  // Then: replaying the same signed nonce is rejected.
  assert.equal(trusted.data.device.status, "TRUSTED");
  const replay = await api(server.baseUrl, "/api/devices/trust", {
    userId: "user_fan_a",
    deviceId: "iphone-single-use",
    biometricVerified: true,
    ...first
  }, 403);
  assert.equal(replay.error.code, "APP_ATTESTATION_REQUIRED");

  // When: another nonce is allowed to expire.
  const expiredNonce = await api(server.baseUrl, "/api/devices/attestation-nonce?purpose=TRUST_DEVICE");
  await new Promise((resolve) => setTimeout(resolve, 80));
  const expired = await api(server.baseUrl, "/api/devices/trust", {
    userId: "user_fan_a",
    deviceId: "iphone-expired",
    biometricVerified: true,
    nonce: expiredNonce.data.nonce,
    appAttestation: appAttestation("TRUST_DEVICE", expiredNonce.data.nonce, "user_fan_a", "iphone-expired")
  }, 403);

  // Then: expired nonces are rejected too.
  assert.equal(expired.error.code, "APP_ATTESTATION_REQUIRED");
});

test("demo profile endpoints never mint bearer tokens", async (t) => {
  // Given: the legacy demo lookup and profile update routes are unauthenticated compatibility endpoints.
  const server = await startServer(t);
  const session = await api(server.baseUrl, "/api/users/user_fan_a/session");
  const updated = await api(server.baseUrl, "/api/users/user_fan_a/profile", {
    name: "민서수정"
  });

  // Then: neither response can be used to mint a signed bearer credential.
  assert.equal(session.data.id, "user_fan_a");
  assert.equal(session.data.sessionToken, undefined);
  assert.equal(updated.data.id, "user_fan_a");
  assert.equal(updated.data.name, "민서수정");
  assert.equal(updated.data.sessionToken, undefined);
});

test("malformed bearer headers are ignored on public endpoints", async (t) => {
  // Given: a mobile client has a corrupt or expired local token but calls a public endpoint.
  const server = await startServer(t);

  // When: the public catalog receives an invalid Authorization header.
  const catalog = await api(server.baseUrl, "/api/catalog", null, 200, {
    Authorization: "Bearer garbage.not.a.token"
  });

  // Then: public API availability is not tied to bearer-token freshness.
  assert.ok(Array.isArray(catalog.data.events));
});

test("real login bearer token authorizes only the matching user", async (t) => {
  // Given: Google test-mode login issues the additive bearer token for google_user_test.
  const server = await startServer(t, {
    env: {
      TIG_GOOGLE_AUTH_TEST_MODE: "1"
    }
  });
  const session = await api(server.baseUrl, "/api/auth/google", {
    credential: "ticketground-google-test-credential"
  });
  assert.equal(session.data.id, "google_user_test");
  assert.equal(typeof session.data.sessionToken, "string");

  // When: the legacy web-style request sends no token.
  const legacy = await api(server.baseUrl, "/api/users/user_fan_a/tickets");

  // Then: backwards-compatible demo access remains allowed.
  assert.ok(Array.isArray(legacy.data));

  // When: the token is sent against its own owner-scoped route.
  const ownTickets = await api(server.baseUrl, "/api/users/google_user_test/tickets", null, 200, {
    Authorization: `Bearer ${session.data.sessionToken}`
  });

  // Then: same-user ownership checks accept it.
  assert.ok(Array.isArray(ownTickets.data));

  // When: the same token is sent against another user's owner-scoped route.
  const mismatch = await api(server.baseUrl, "/api/users/user_fan_a/tickets", null, 403, {
    Authorization: `Bearer ${session.data.sessionToken}`
  });

  // Then: the optional bearer layer rejects the mismatch case.
  assert.equal(mismatch.error.code, "TOKEN_USER_MISMATCH");
});

test("push-token registration persists and watchlist notify tolerates stub delivery", async (t) => {
  // Given: a user and event with an app push watchlist.
  const server = await startServer(t);
  const registered = await api(server.baseUrl, "/api/devices/push-token", {
    userId: "user_fan_a",
    platform: "ios",
    token: "ExponentPushToken[test-token]"
  });
  const watch = await api(server.baseUrl, "/api/watchlist", {
    userId: "user_fan_a",
    eventId: "event_kpop_001",
    channels: ["APP_PUSH"],
    notificationEnabled: true
  });

  // When: a watchlist notification is recorded for immediate dispatch.
  const notified = await api(server.baseUrl, "/api/watchlist/notify", {
    watchlistId: watch.data.watchlist.id,
    dispatchNow: true
  });
  const db = JSON.parse(await readFile(server.dbPath, "utf8"));

  // Then: the token is upserted and the stub push path does not break notification recording.
  assert.equal(registered.data.platform, "ios");
  assert.equal(db.pushTokens.length, 1);
  assert.equal(db.pushTokens[0].userId, "user_fan_a");
  assert.equal(db.pushTokens[0].token, "ExponentPushToken[test-token]");
  assert.equal(notified.data.notificationJob.status, "SENT");
});
