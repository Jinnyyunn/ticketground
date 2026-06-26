import test from "node:test";
import assert from "node:assert/strict";
import { api, startServer } from "./backend-test-utils.mjs";

async function text(baseUrl, pathName, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${pathName}`);
  assert.equal(response.status, expectedStatus, `${pathName} status`);
  return {
    body: await response.text(),
    contentType: response.headers.get("content-type") || ""
  };
}

function eventById(state, eventId = "event_kpop_001") {
  const event = state.data.events.find((item) => item.id === eventId);
  assert.ok(event, `${eventId} exists`);
  return event;
}

test("public and admin HTTP surfaces stay separated", async (t) => {
  const { baseUrl, adminUrl } = await startServer(t);

  const home = await text(baseUrl, "/");
  assert.match(home.body, /Ticketground|Tig/);

  const appAsset = await text(baseUrl, "/app.js");
  assert.match(appAsset.contentType, /javascript/);

  const adminHtml = await text(adminUrl, "/admin.html");
  assert.match(adminHtml.body, /Ticketground Console|운영 통합 콘솔/);

  const publicAdmin = await api(baseUrl, "/api/admin/summary", null, 404);
  assert.equal(publicAdmin.error.code, "NOT_FOUND");

  const adminSummary = await api(adminUrl, "/api/admin/summary");
  assert.ok(adminSummary.data.stats.totalTickets > 0);
  assert.equal(typeof adminSummary.data.stats.ledgerVerified, "boolean");
});

test("admin sale settings update public event state and ticket prices", async (t) => {
  const { baseUrl, adminUrl } = await startServer(t);
  const before = await api(baseUrl, "/api/state");
  const event = eventById(before);
  const prices = Object.fromEntries(event.zones.map((zone, index) => [zone.id, zone.faceValue + ((index + 1) * 1000)]));

  const updated = await api(adminUrl, "/api/admin/events/sale", {
    eventId: event.id,
    title: "QA Live Sale",
    category: event.category,
    startsAt: "2026-10-03T20:00:00+09:00",
    venueId: event.venueId,
    saleState: "DISCOUNT_SOON",
    saleNote: "QA sale note",
    discountRate: 15,
    prices
  });

  assert.equal(updated.data.event.title, "QA Live Sale");
  assert.equal(updated.data.event.saleState, "DISCOUNT_SOON");
  assert.equal(updated.data.event.discountRate, 15);
  assert.ok(updated.data.repricedTickets > 0);

  const after = await api(baseUrl, "/api/state");
  const publicEvent = eventById(after);
  assert.equal(publicEvent.title, "QA Live Sale");
  assert.equal(publicEvent.saleNote, "QA sale note");
  assert.equal(publicEvent.dates[0].startsAt, "2026-10-03T20:00:00+09:00");

  const onSaleTicket = after.data.tickets.find((ticket) => ticket.eventId === event.id && ticket.status === "ON_SALE");
  assert.ok(onSaleTicket, "available ticket remains visible after repricing");
  assert.equal(onSaleTicket.faceValue, prices[onSaleTicket.zoneId]);
});

test("account, support, watchlist, and seat-map APIs remain observable", async (t) => {
  const { baseUrl, adminUrl } = await startServer(t);
  const watch = await api(baseUrl, "/api/watchlist", {
    userId: "user_fan_a",
    eventId: "event_kpop_001",
    channels: ["APP_PUSH", "KAKAO"],
    calendarEnabled: true,
    notificationEnabled: true
  });
  assert.equal(watch.data.notificationJobs.length, 2);

  const support = await api(baseUrl, "/api/support/threads", {
    userId: "user_fan_a",
    subject: "QA 문의",
    message: "예매 흐름 확인 요청"
  });
  const reply = await api(adminUrl, "/api/admin/support/messages", {
    threadId: support.data.id,
    message: "운영자 답변"
  });
  assert.equal(reply.data.status, "ANSWERED");

  const status = await api(adminUrl, "/api/admin/users/statuses", {
    updates: [{ userId: "user_fan_b", status: "WATCHLIST" }],
    reason: "QA status update"
  });
  assert.equal(status.data[0].status, "WATCHLIST");

  const seatMap = await api(baseUrl, "/api/events/event_kpop_001/seat-map");
  assert.ok(seatMap.data.seats.length > 0);
  assert.ok(seatMap.data.labels.length > 0);

  const admin = await api(adminUrl, "/api/admin/summary");
  assert.ok(admin.data.stats.watchlistEntries >= 1);
  assert.ok(admin.data.stats.supportOpen >= 1);
  assert.ok(admin.data.users.some((user) => user.id === "user_fan_b" && user.status === "WATCHLIST"));
});
