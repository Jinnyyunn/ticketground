import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { adminApi, api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

async function nativeLogin(server) {
  const login = await api(server.baseUrl, "/api/auth/google/native", {
    credential: GOOGLE_AUTH_TEST_CREDENTIAL
  });
  return {
    authorization: `Bearer ${login.data.session.credential}`,
    user: login.data.user
  };
}

async function request(server, pathName, {
  authorization,
  body,
  method = "GET",
  status = 200
} = {}) {
  const response = await fetch(`${server.baseUrl}${pathName}`, {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json();
  assert.equal(response.status, status, `${method} ${pathName}: ${JSON.stringify(json)}`);
  return json;
}

test("native watchlist binds reads and preferences to the bearer principal", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const login = await nativeLogin(server);

  const state = await api(server.baseUrl, "/api/state");
  const eventID = state.data.events[0].id;

  const missing = await request(server, "/api/me/watchlist", { status: 401 });
  assert.equal(missing.error.code, "NATIVE_SESSION_INVALID");

  const malformedEvent = await request(server, "/api/me/watchlist/%", {
    authorization: login.authorization,
    method: "PUT",
    body: { notificationEnabled: true },
    status: 400
  });
  assert.equal(malformedEvent.error.code, "INVALID_EVENT_ID");

  const created = await request(server, `/api/me/watchlist/${eventID}`, {
    authorization: login.authorization,
    method: "PUT",
    body: {
      userId: "user_fan_a",
      channels: ["APP_PUSH"],
      calendarEnabled: true,
      notificationEnabled: true
    }
  });
  assert.equal(created.data.eventId, eventID);
  assert.equal(created.data.userId, undefined);
  assert.equal(created.data.notificationEnabled, true);
  assert.ok(created.data.notificationJobs.every((job) => job.status === "SCHEDULED"));

  const own = await request(server, "/api/me/watchlist?userId=user_fan_a", {
    authorization: login.authorization
  });
  assert.deepEqual(own.data.map((item) => item.eventId), [eventID]);
  assert.ok(own.data.every((item) => item.userId === undefined));

  const victim = await request(server, "/api/users/user_fan_a/watchlist");
  assert.deepEqual(victim.data, []);

  const disabled = await request(server, `/api/me/watchlist/${eventID}`, {
    authorization: login.authorization,
    method: "PUT",
    body: {
      channels: ["APP_PUSH"],
      calendarEnabled: false,
      notificationEnabled: false
    }
  });
  assert.equal(disabled.data.notificationEnabled, false);
  assert.ok(disabled.data.notificationJobs.every((job) => job.status === "CANCELED"));
  const ledger = await adminApi(server, "/api/ledger");
  const preferenceEntry = ledger.data.find((entry) => entry.action === "WATCHLIST_UPSERTED");
  assert.equal(preferenceEntry.payload.scheduledJobs, 0);
  assert.equal(preferenceEntry.payload.canceledJobs, 2);
});

test("native watchlist persists across restart and delete cancels scheduled jobs", async (t) => {
  configureGoogleEnv(t, true);
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-watchlist-persistence-"));
  const dbPath = path.join(tempDir, "db.json");
  t.after(() => rm(tempDir, { recursive: true, force: true }));

  const firstServer = await startServer(t, { dbPath });
  const login = await nativeLogin(firstServer);
  const state = await api(firstServer.baseUrl, "/api/state");
  const eventID = state.data.events[0].id;
  await request(firstServer, `/api/me/watchlist/${eventID}`, {
    authorization: login.authorization,
    method: "PUT",
    body: { channels: ["APP_PUSH"], notificationEnabled: true, calendarEnabled: false }
  });
  await firstServer.stop();

  const secondServer = await startServer(t, { dbPath });
  const restored = await request(secondServer, "/api/me/watchlist", {
    authorization: login.authorization
  });
  assert.deepEqual(restored.data.map((item) => item.eventId), [eventID]);

  const removed = await request(secondServer, `/api/me/watchlist/${eventID}`, {
    authorization: login.authorization,
    method: "DELETE"
  });
  assert.deepEqual(removed.data, { deleted: true, eventId: eventID });

  const retried = await request(secondServer, `/api/me/watchlist/${eventID}`, {
    authorization: login.authorization,
    method: "DELETE"
  });
  assert.deepEqual(retried.data, { deleted: true, eventId: eventID });

  const empty = await request(secondServer, "/api/me/watchlist", {
    authorization: login.authorization
  });
  assert.deepEqual(empty.data, []);
});

test("native watchlist cannot delete another user's event", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const login = await nativeLogin(server);
  const state = await api(server.baseUrl, "/api/state");
  const eventID = state.data.events[1].id;

  await api(server.baseUrl, "/api/watchlist", {
    userId: "user_fan_a",
    eventId: eventID,
    channels: ["APP_PUSH"],
    notificationEnabled: true
  });

  const absentForPrincipal = await request(server, `/api/me/watchlist/${eventID}`, {
    authorization: login.authorization,
    method: "DELETE"
  });
  assert.deepEqual(absentForPrincipal.data, { deleted: true, eventId: eventID });

  const victim = await request(server, "/api/users/user_fan_a/watchlist");
  assert.deepEqual(victim.data.map((item) => item.eventId), [eventID]);
});

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
