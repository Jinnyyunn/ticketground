import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { api, startServer, verifyIdentity } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

async function nativeLogin(baseUrl) {
  const login = await api(baseUrl, "/api/auth/google/native", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  return login.data;
}

async function accountRequest(baseUrl, pathname, {
  body,
  credential,
  expectedStatus = 200,
  key,
  method = body === undefined ? "GET" : "PATCH"
} = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(payload));
  return payload;
}

test("principal account profile rejects unauthenticated and unapproved fields", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const login = await nativeLogin(server.baseUrl);
  const credential = login.session.credential;

  const denied = await accountRequest(server.baseUrl, "/api/me/profile", { expectedStatus: 401 });
  assert.equal(denied.error.code, "NATIVE_SESSION_INVALID");

  const profile = await accountRequest(server.baseUrl, "/api/me/profile?userId=user_fan_a", { credential });
  assert.equal(profile.data.id, login.user.id);
  assert.equal(profile.data.name, login.user.name);
  assert.equal(profile.data.balance, undefined);

  for (const name of ["", " ", "a".repeat(41), "잘못된\n이름"]) {
    const invalid = await accountRequest(server.baseUrl, "/api/me/profile", {
      body: { name },
      credential,
      expectedStatus: 422,
      key: `invalid-${name.length}`
    });
    assert.equal(invalid.error.code, "PROFILE_NAME_INVALID");
  }

  const extra = await accountRequest(server.baseUrl, "/api/me/profile", {
    body: { name: "안전한 이름", status: "ADMIN" },
    credential,
    expectedStatus: 422,
    key: "profile-extra-field"
  });
  assert.equal(extra.error.code, "PROFILE_FIELDS_INVALID");
});

test("profile update is durable, idempotent, and bound to the bearer principal", async (t) => {
  configureGoogleEnv(t, true);
  const dataDir = await mkdtemp(path.join(tmpdir(), "ticketground-account-native-"));
  const dbPath = path.join(dataDir, "db.json");
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const first = await startServer(t, { dbPath });
  const login = await nativeLogin(first.baseUrl);
  const credential = login.session.credential;

  const update = await accountRequest(first.baseUrl, "/api/me/profile", {
    body: { name: "새 이름" }, credential, key: "profile-update"
  });
  const replay = await accountRequest(first.baseUrl, "/api/me/profile", {
    body: { name: "새 이름" }, credential, key: "profile-update"
  });
  assert.deepEqual(replay.data, update.data);
  assert.equal(update.data.name, "새 이름");

  const conflict = await accountRequest(first.baseUrl, "/api/me/profile", {
    body: { name: "다른 이름" }, credential, key: "profile-update", expectedStatus: 409
  });
  assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  await first.stop();
  const restarted = await startServer(t, { dbPath });
  const restored = await accountRequest(restarted.baseUrl, "/api/me/profile", { credential });
  assert.equal(restored.data.name, "새 이름");
});

test("reservations return only principal-owned sanitized tickets and hide foreign details", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const login = await nativeLogin(server.baseUrl);
  const credential = login.session.credential;

  const empty = await accountRequest(server.baseUrl, "/api/me/reservations", { credential });
  assert.deepEqual(empty.data, []);

  await verifyIdentity(server.baseUrl, login.user.id, "010-9000-7001");
  const state = await api(server.baseUrl, "/api/state");
  const ticket = state.data.tickets.find((item) => item.status === "ON_SALE");
  assert.ok(ticket);
  await api(server.baseUrl, "/api/tickets/buy", {
    userId: login.user.id,
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD"
  });

  const reservations = await accountRequest(server.baseUrl, "/api/me/reservations?userId=user_fan_a", { credential });
  assert.equal(reservations.data.length, 1);
  assert.equal(reservations.data[0].ticketId, ticket.id);
  assert.equal(reservations.data[0].ownerId, undefined);
  assert.equal(reservations.data[0].currentQr, undefined);
  assert.equal(reservations.data[0].admissionCredentialId, undefined);
  assert.equal(reservations.data[0].event.title.length > 0, true);

  const detail = await accountRequest(
    server.baseUrl,
    `/api/me/reservations/${encodeURIComponent(ticket.id)}`,
    { credential }
  );
  assert.deepEqual(detail.data, reservations.data[0]);

  const foreignTicket = state.data.tickets.find((item) => item.id !== ticket.id);
  const hidden = await accountRequest(
    server.baseUrl,
    `/api/me/reservations/${encodeURIComponent(foreignTicket.id)}`,
    { credential, expectedStatus: 404 }
  );
  assert.equal(hidden.error.code, "RESERVATION_NOT_FOUND");
});
