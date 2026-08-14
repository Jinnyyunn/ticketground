import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

async function credential(baseUrl) {
  const login = await api(baseUrl, "/api/auth/google/native", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  return login.data.session.credential;
}

async function request(baseUrl, pathname, { body, credential: token, expectedStatus = 200, key, method = "GET" } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(payload));
  return payload;
}

test("queue, hold, reconnect, release, and reservation draft are principal-owned and idempotent", async (t) => {
  configureGoogleEnv(t, true);
  const dataDir = await mkdtemp(path.join(tmpdir(), "ticketground-booking-session-"));
  const dbPath = path.join(dataDir, "db.json");
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const first = await startServer(t, { dbPath });
  const token = await credential(first.baseUrl);
  const state = await api(first.baseUrl, "/api/state");
  const event = state.data.events[0];
  const performanceId = event.performanceDates?.[0]?.id || event.dates?.[0]?.id;
  const ticket = state.data.tickets.find((item) => item.eventId === event.id && item.performanceDateId === performanceId && item.status === "ON_SALE");
  assert.ok(ticket);

  const denied = await request(first.baseUrl, "/api/me/booking/queues", { body: {}, method: "POST", expectedStatus: 401 });
  assert.equal(denied.error.code, "NATIVE_SESSION_INVALID");

  const queue = await request(first.baseUrl, "/api/me/booking/queues", {
    body: { eventId: event.id, performanceId }, credential: token, key: "queue-1", method: "POST"
  });
  const queueReplay = await request(first.baseUrl, "/api/me/booking/queues", {
    body: { eventId: event.id, performanceId }, credential: token, key: "queue-1", method: "POST"
  });
  assert.deepEqual(queueReplay.data, queue.data);
  assert.equal(queue.data.status, "READY");

  const seats = await request(first.baseUrl, `/api/me/booking/events/${event.id}/performances/${performanceId}/seats?queueId=${queue.data.id}`, { credential: token });
  const revision = seats.data.revision;
  assert.equal(seats.data.seats.find((item) => item.ticketId === ticket.id).state, "SELECTABLE");

  const hold = await request(first.baseUrl, "/api/me/booking/holds", {
    body: { queueId: queue.data.id, ticketId: ticket.id, revision }, credential: token, key: "hold-1", method: "POST"
  });
  const holdReplay = await request(first.baseUrl, "/api/me/booking/holds", {
    body: { queueId: queue.data.id, ticketId: ticket.id, revision }, credential: token, key: "hold-1", method: "POST"
  });
  assert.deepEqual(holdReplay.data, hold.data);
  assert.equal(hold.data.status, "ACTIVE");

  const stale = await request(first.baseUrl, "/api/me/booking/holds", {
    body: { queueId: queue.data.id, ticketId: ticket.id, revision }, credential: token, key: "hold-stale", method: "POST", expectedStatus: 409
  });
  assert.equal(stale.error.code, "INVENTORY_REVISION_MISMATCH");

  const renewed = await request(first.baseUrl, `/api/me/booking/holds/${hold.data.id}/renew`, {
    body: {}, credential: token, key: "renew-1", method: "POST"
  });
  assert.equal(Date.parse(renewed.data.expiresAt) > Date.parse(hold.data.expiresAt), true);

  const draft = await request(first.baseUrl, "/api/me/booking/drafts", {
    body: { holdId: hold.data.id }, credential: token, key: "draft-1", method: "POST"
  });
  assert.equal(draft.data.status, "AWAITING_PAYMENT");
  assert.equal(Object.hasOwn(draft.data, "paidAt"), false);

  await first.stop();
  const restarted = await startServer(t, { dbPath });
  const restoredQueue = await request(restarted.baseUrl, `/api/me/booking/queues/${queue.data.id}`, { credential: token });
  const restoredDraft = await request(restarted.baseUrl, `/api/me/booking/drafts/${draft.data.id}`, { credential: token });
  assert.equal(restoredQueue.data.id, queue.data.id);
  assert.equal(restoredDraft.data.holdId, hold.data.id);

  const released = await request(restarted.baseUrl, `/api/me/booking/holds/${hold.data.id}`, {
    credential: token, key: "release-1", method: "DELETE"
  });
  assert.equal(released.data.status, "RELEASED");
});

test("expired queues and holds transition explicitly and cannot produce drafts", async (t) => {
  configureGoogleEnv(t, true);
  const dataDir = await mkdtemp(path.join(tmpdir(), "ticketground-booking-expiry-"));
  const dbPath = path.join(dataDir, "db.json");
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const first = await startServer(t, { dbPath, now: "2026-09-19T17:00:00+09:00" });
  const token = await credential(first.baseUrl);
  const state = await api(first.baseUrl, "/api/state");
  const event = state.data.events[0];
  const performanceId = event.performanceDates?.[0]?.id || event.dates?.[0]?.id;
  const ticket = state.data.tickets.find((item) => item.eventId === event.id && item.performanceDateId === performanceId && item.status === "ON_SALE");
  const queue = await request(first.baseUrl, "/api/me/booking/queues", {
    body: { eventId: event.id, performanceId }, credential: token, key: "expiry-queue", method: "POST"
  });
  const seats = await request(first.baseUrl, `/api/me/booking/events/${event.id}/performances/${performanceId}/seats?queueId=${queue.data.id}`, { credential: token });
  const hold = await request(first.baseUrl, "/api/me/booking/holds", {
    body: { queueId: queue.data.id, ticketId: ticket.id, revision: seats.data.revision }, credential: token, key: "expiry-hold", method: "POST"
  });
  await first.stop();

  const later = await startServer(t, { dbPath, now: "2026-09-19T17:20:00+09:00" });
  const expiredQueue = await request(later.baseUrl, `/api/me/booking/queues/${queue.data.id}`, { credential: token });
  assert.equal(expiredQueue.data.status, "EXPIRED");
  const rejected = await request(later.baseUrl, "/api/me/booking/drafts", {
    body: { holdId: hold.data.id }, credential: token, key: "expired-draft", method: "POST", expectedStatus: 409
  });
  assert.equal(rejected.error.code, "HOLD_INACTIVE");
});
