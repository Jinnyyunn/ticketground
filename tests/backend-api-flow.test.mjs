import test from "node:test";
import assert from "node:assert/strict";
import { adminApi, api, bootstrapAdminPassword, buyFirstTicket, startServer } from "./backend-test-utils.mjs";

test("public server serves the Next frontend and backend API on one port", async (t) => {
  const { baseUrl } = await startServer(t);

  const health = await api(baseUrl, "/api/health");
  assert.equal(health.data.status, "UP");
  assert.equal(health.data.version, "78b3c7c");

  const home = await fetch(`${baseUrl}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type") || "", /text\/html/);
  assert.match(await home.text(), /Ticketground|티켓그라운드|공연/);

  const publicAdmin = await fetch(`${baseUrl}/admin`, { redirect: "manual" });
  assert.equal(publicAdmin.status, 404);

  const state = await api(baseUrl, "/api/state");
  assert.ok(state.data.backendSummary.events > 0);

  const catalog = await api(baseUrl, "/api/catalog");
  const boundedCatalog = await api(baseUrl, "/api/catalog?limit=1");
  assert.ok(catalog.data.events.length > 1);
  assert.equal(boundedCatalog.data.events.length, 1);
});

test("backend watchlist, notification, seat map, and admin summary APIs remain usable", async (t) => {
  const server = await startServer(t);
  const { baseUrl } = server;

  const watch = await api(baseUrl, "/api/watchlist", {
    userId: "user_fan_a",
    eventId: "event_kpop_001",
    channels: ["APP_PUSH", "KAKAO"],
    calendarEnabled: true,
    notificationEnabled: true
  });
  assert.equal(watch.data.watchlist.eventId, "event_kpop_001");
  assert.equal(watch.data.notificationJobs.length, 2);

  const userWatchlist = await api(baseUrl, "/api/users/user_fan_a/watchlist");
  assert.equal(userWatchlist.data.length, 1);

  const notify = await api(baseUrl, "/api/watchlist/notify", {
    watchlistId: watch.data.watchlist.id,
    type: "STATUS_CHANGE",
    dispatchNow: true
  });
  assert.equal(notify.data.notificationJob.status, "SENT");

  const state = await api(baseUrl, "/api/state");
  const performanceDateId = state.data.events
    .find((event) => event.id === "event_kpop_001").dates[0].id;
  const seatMap = await api(
    baseUrl,
    `/api/seat-map?eventId=event_kpop_001&performanceDateId=${performanceDateId}`
  );
  assert.ok(seatMap.data.seats.length > 0);
  assert.ok(seatMap.data.zones.length > 0);
  const expectedTicketIDs = state.data.tickets
    .filter((ticket) =>
      ticket.eventId === "event_kpop_001" && ticket.performanceDateId === performanceDateId
    )
    .map((ticket) => ticket.id)
    .sort();
  assert.deepEqual(seatMap.data.seats.map((seat) => seat.id).sort(), expectedTicketIDs);

  const publicAdmin = await api(baseUrl, "/api/admin/summary", null, 404);
  assert.equal(publicAdmin.error.code, "NOT_FOUND");
  const publicLedger = await api(baseUrl, "/api/ledger", null, 404);
  assert.equal(publicLedger.error.code, "NOT_FOUND");
  const publicLedgerVerify = await api(baseUrl, "/api/ledger/verify", null, 404);
  assert.equal(publicLedgerVerify.error.code, "NOT_FOUND");

  const admin = await adminApi(server, "/api/admin/summary");
  assert.equal(admin.data.stats.watchlistEntries, 1);
  assert.ok(admin.data.stats.notificationJobs >= 3);
});

test("admin summary has the same overview shape for token and browser-session auth", async (t) => {
  // Given: an authenticated browser-session admin and the token admin surface.
  const server = await startServer(t);
  const loginResponse = await fetch(`${server.adminUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: bootstrapAdminPassword })
  });
  await loginResponse.json();
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get("set-cookie").split(";")[0];

  // When: both auth modes request the legacy summary route.
  const sessionResponse = await fetch(`${server.adminUrl}/api/admin/summary`, {
    headers: { Cookie: cookie }
  });
  const token = await adminApi(server, "/api/admin/summary");
  const session = await sessionResponse.json();

  // Then: both receive the normalized overview-only payload, not raw users/tickets/event arrays.
  assert.equal(sessionResponse.status, 200);
  assert.deepEqual(token.data, session.data);
  assert.ok(token.data.stats.totalTickets > 0);
  assert.equal(token.data.event, undefined);
  assert.equal(token.data.users, undefined);
  assert.equal(token.data.tickets, undefined);
});

test("seat-map API rejects an explicit missing event id", async (t) => {
  // Given: a running backend with seeded events.
  const { baseUrl } = await startServer(t);

  // When: the caller asks for a specific event id that does not exist.
  const seatMap = await api(
    baseUrl,
    "/api/seat-map?eventId=missing-event&performanceDateId=missing-performance",
    null,
    404
  );

  // Then: the API reports the missing event instead of falling back to the first event.
  assert.equal(seatMap.error.code, "EVENT_NOT_FOUND");
});

test("seat-map API requires an explicit performance date", async (t) => {
  const { baseUrl } = await startServer(t);

  const seatMap = await api(baseUrl, "/api/seat-map?eventId=event_kpop_001", null, 400);

  assert.equal(seatMap.error.code, "MISSING_FIELD");
});

test("public demo session supports login profile lookup and nickname update without exposing state users", async (t) => {
  const { baseUrl } = await startServer(t);

  const state = await api(baseUrl, "/api/state");
  const publicUser = state.data.users.find((item) => item.id === "user_fan_a");
  assert.equal(publicUser.name, "민서");
  assert.equal(publicUser.balance, undefined);
  assert.equal(publicUser.status, undefined);
  assert.equal(publicUser.trustScore, undefined);

  const session = await api(baseUrl, "/api/users/user_fan_a/session");
  assert.equal(session.data.id, "user_fan_a");
  assert.equal(session.data.name, "민서");
  assert.equal(session.data.balance, undefined);
  assert.equal(session.data.status, "ACTIVE");
  assert.equal(typeof session.data.trustScore, "number");

  const updated = await api(baseUrl, "/api/users/user_fan_a/profile", {
    name: "민서수정"
  });
  assert.equal(updated.data.name, "민서수정");

  const refreshed = await api(baseUrl, "/api/users/user_fan_a/session");
  assert.equal(refreshed.data.name, "민서수정");

  const longName = await api(baseUrl, "/api/users/user_fan_a/profile", {
    name: "1234567890123"
  }, 422);
  assert.equal(longName.error.code, "INVALID_PROFILE_NAME");
});

test("direct transfer attempt rejects spoofed actors without penalizing the victim", async (t) => {
  // Given: the demo owner has a ticket and another existing user starts with a clean trust profile.
  const server = await startServer(t);
  const { ticket } = await buyFirstTicket(server.baseUrl);
  const before = await adminApi(server, "/api/admin/workspaces/accounts?search=user_fan_b");
  const victimBefore = before.data.users.find((user) => user.id === "user_fan_b");
  assert.equal(victimBefore.trustScore, 88);
  assert.equal(victimBefore.sanctions.length, 0);

  // When: a caller tries to put that other user's id into the actor field.
  const rejected = await api(server.baseUrl, "/api/security/direct-transfer-attempt", {
    actorId: "user_fan_b",
    ticketId: ticket.id,
    targetUserId: "user_fan_a",
    offeredPrice: 2000
  }, 403);

  // Then: the endpoint rejects the spoof and leaves the victim's reputation untouched.
  assert.equal(rejected.error.code, "TICKET_OWNER_MISMATCH");
  const after = await adminApi(server, "/api/admin/workspaces/accounts?search=user_fan_b");
  const victimAfter = after.data.users.find((user) => user.id === "user_fan_b");
  assert.equal(victimAfter.trustScore, 88);
  assert.equal(victimAfter.status, "ACTIVE");
  assert.equal(victimAfter.sanctions.length, 0);
});

test("public validation rejects malformed watchlist and support requests", async (t) => {
  const { baseUrl } = await startServer(t);

  const malformedWatch = await api(baseUrl, "/api/watchlist", {
    userId: "user_fan_a"
  }, 400);
  assert.equal(malformedWatch.error.code, "MISSING_FIELD");

  const emptySupport = await api(baseUrl, "/api/support/threads", {
    userId: "user_fan_a",
    message: " "
  }, 400);
  assert.equal(emptySupport.error.code, "EMPTY_SUPPORT_MESSAGE");
});
