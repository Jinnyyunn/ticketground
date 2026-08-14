import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

async function nativeCredential(baseUrl) {
  const login = await api(baseUrl, "/api/auth/google/native", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  return login.data.session.credential;
}

async function watchlistRequest(baseUrl, pathname, {
  body,
  credential,
  expectedStatus = 200,
  key,
  method = "GET"
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

test("principal watchlist is isolated and duplicate add is durable idempotent", async (t) => {
  configureGoogleEnv(t, true);
  const dataDir = await mkdtemp(path.join(tmpdir(), "ticketground-watchlist-native-"));
  const dbPath = path.join(dataDir, "db.json");
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const first = await startServer(t, { dbPath });
  const credential = await nativeCredential(first.baseUrl);
  const state = await api(first.baseUrl, "/api/state");
  const eventId = state.data.events[0].id;

  const denied = await watchlistRequest(first.baseUrl, "/api/me/watchlist", { expectedStatus: 401 });
  assert.equal(denied.error.code, "NATIVE_SESSION_INVALID");

  const [created, replay] = await Promise.all([
    watchlistRequest(first.baseUrl, `/api/me/watchlist/${eventId}`, {
      credential, key: "watch-add", method: "PUT", body: { notificationEnabled: true }
    }),
    watchlistRequest(first.baseUrl, `/api/me/watchlist/${eventId}`, {
      credential, key: "watch-add", method: "PUT", body: { notificationEnabled: true }
    })
  ]);
  assert.deepEqual(replay.data, created.data);
  assert.equal(created.data.eventId, eventId);
  assert.equal(created.data.userId.startsWith("google_user_"), true);

  const conflict = await watchlistRequest(first.baseUrl, `/api/me/watchlist/${eventId}`, {
    credential,
    key: "watch-add",
    method: "PUT",
    body: { notificationEnabled: false },
    expectedStatus: 409
  });
  assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  const listed = await watchlistRequest(first.baseUrl, "/api/me/watchlist?userId=user_fan_a", { credential });
  assert.deepEqual(listed.data.map((item) => item.id), [created.data.id]);

  await first.stop();
  const restarted = await startServer(t, { dbPath });
  const restored = await watchlistRequest(restarted.baseUrl, "/api/me/watchlist", { credential });
  assert.deepEqual(restored.data.map((item) => item.id), [created.data.id]);
});

test("notification disable cancels pending jobs and failed owner injection is ignored", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const credential = await nativeCredential(server.baseUrl);
  const state = await api(server.baseUrl, "/api/state");
  const eventId = state.data.events[1].id;

  const created = await watchlistRequest(server.baseUrl, `/api/me/watchlist/${eventId}`, {
    credential,
    key: "watch-owner",
    method: "PUT",
    body: { userId: "user_fan_a", channels: ["APP_PUSH"], notificationEnabled: true }
  });
  assert.equal(created.data.userId.startsWith("google_user_"), true);
  assert.equal(created.data.notificationJobs.every((job) => job.status === "SCHEDULED"), true);

  const disabled = await watchlistRequest(server.baseUrl, `/api/me/watchlist/${eventId}/notification`, {
    credential,
    key: "watch-notification-off",
    method: "PUT",
    body: { enabled: false, userId: "user_fan_a" }
  });
  assert.equal(disabled.data.notificationEnabled, false);
  assert.equal(disabled.data.notificationJobs.every((job) => job.status === "CANCELLED"), true);
});

test("remove returns an authoritative replay-safe receipt", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const credential = await nativeCredential(server.baseUrl);
  const state = await api(server.baseUrl, "/api/state");
  const eventId = state.data.events[2].id;

  await watchlistRequest(server.baseUrl, `/api/me/watchlist/${eventId}`, {
    credential, key: "watch-before-remove", method: "PUT", body: {}
  });
  const removed = await watchlistRequest(server.baseUrl, `/api/me/watchlist/${eventId}`, {
    credential, key: "watch-remove", method: "DELETE"
  });
  const replay = await watchlistRequest(server.baseUrl, `/api/me/watchlist/${eventId}`, {
    credential, key: "watch-remove", method: "DELETE"
  });
  assert.deepEqual(removed.data, { removed: true, eventId });
  assert.deepEqual(replay.data, removed.data);

  const empty = await watchlistRequest(server.baseUrl, "/api/me/watchlist", { credential });
  assert.deepEqual(empty.data, []);
});
