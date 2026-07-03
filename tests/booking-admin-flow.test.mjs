import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { adminApi, api, startServer } from "./backend-test-utils.mjs";

async function text(baseUrl, pathName, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${pathName}`);
  assert.equal(response.status, expectedStatus, `${pathName} status`);
  return {
    body: await response.text(),
    contentType: response.headers.get("content-type") || ""
  };
}

async function adminSessionRequest(server, pathName, { body, cookie, csrf, expectedStatus = 200 } = {}) {
  const response = await fetch(`${server.adminUrl}${pathName}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { "x-tig-csrf": csrf } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  const json = await response.json();
  assert.equal(response.status, expectedStatus, `${pathName} status ${response.status}: ${JSON.stringify(json)}`);
  return { json, setCookie: response.headers.get("set-cookie") || "" };
}

function eventById(state, eventId = "event_kpop_001") {
  const event = state.data.events.find((item) => item.id === eventId);
  assert.ok(event, `${eventId} exists`);
  return event;
}

test("public and admin HTTP surfaces stay separated", async (t) => {
  const server = await startServer(t);
  const { baseUrl, adminUrl } = server;

  const home = await text(baseUrl, "/");
  assert.match(home.body, /Ticketground|티켓/);
  assert.doesNotMatch(home.body, /운영 콘솔|href="\/admin"/);

  const publicAdminPage = await fetch(`${baseUrl}/admin`, { redirect: "manual" });
  assert.equal(publicAdminPage.status, 404);

  const publicConsole = await api(baseUrl, "/console", null, 404);
  assert.equal(publicConsole.error.code, "NOT_FOUND");

  const publicAdminHtml = await fetch(`${baseUrl}/admin.html`, { redirect: "manual" });
  assert.equal(publicAdminHtml.status, 404);

  const publicAdmin = await api(baseUrl, "/api/admin/summary", null, 404);
  assert.equal(publicAdmin.error.code, "NOT_FOUND");

  const missingToken = await api(adminUrl, "/api/admin/summary", null, 401);
  assert.equal(missingToken.error.code, "ADMIN_TOKEN_REQUIRED");

  const adminSummary = await adminApi(server, "/api/admin/summary");
  assert.ok(adminSummary.data.stats.totalTickets > 0);
  assert.equal(typeof adminSummary.data.stats.ledgerVerified, "boolean");

  const adminRoot = await fetch(`${adminUrl}/`, { redirect: "manual" });
  assert.equal(adminRoot.status, 302);
  assert.equal(adminRoot.headers.get("location"), "/console");

  const adminConsole = await fetch(`${adminUrl}/console`, { redirect: "manual" });
  assert.equal(adminConsole.status, 200);
  assert.match(await adminConsole.text(), /운영 콘솔|Ticketground Admin/);
});

test("browser admin session uses HttpOnly cookie, csrf, ACL, and create-event mutation", async (t) => {
  const server = await startServer(t);

  const badLogin = await adminSessionRequest(server, "/api/admin/login", {
    body: { username: "", password: "" },
    expectedStatus: 401
  });
  assert.equal(badLogin.json.error.code, "ADMIN_LOGIN_FAILED");

  const login = await adminSessionRequest(server, "/api/admin/login", {
    body: { username: "admin", password: "admin" }
  });
  assert.match(login.setCookie, /tig_admin_session=/);
  assert.match(login.setCookie, /HttpOnly/);
  assert.match(login.setCookie, /SameSite=Lax/);
  assert.ok(login.json.data.csrf);
  assert.equal(login.json.data.admin.username, "admin");
  assert.ok(login.json.data.admin.permissions.includes("catalog.manage"));
  assert.doesNotMatch(JSON.stringify(login.json.data), /backend-test-admin-token|password|cookie/i);

  const cookie = login.setCookie.split(";")[0];
  const csrf = login.json.data.csrf;
  const session = await adminSessionRequest(server, "/api/admin/session", { cookie });
  assert.deepEqual(session.json.data.admin.roles.map((role) => role.name), ["Owner"]);
  assert.ok(session.json.data.permissionCatalog.some((permission) => permission.key === "acl.read"));

  const summary = await adminSessionRequest(server, "/api/admin/summary", { cookie });
  assert.ok(summary.json.data.stats.totalTickets > 0);

  const malformedCookie = await adminSessionRequest(server, "/api/admin/summary", {
    cookie: "tig_admin_session=%E0%A4%A",
    expectedStatus: 401
  });
  assert.equal(malformedCookie.json.error.code, "ADMIN_TOKEN_REQUIRED");

  const invalidCsrf = await adminSessionRequest(server, "/api/admin/users/status", {
    cookie,
    csrf: "bad-csrf",
    body: { userId: "user_fan_b", status: "WATCHLIST" },
    expectedStatus: 403
  });
  assert.equal(invalidCsrf.json.error.code, "CSRF_REQUIRED");

  const status = await adminSessionRequest(server, "/api/admin/users/status", {
    cookie,
    csrf,
    body: { userId: "user_fan_b", status: "WATCHLIST", reason: "session csrf test" }
  });
  assert.equal(status.json.data.status, "WATCHLIST");

  const before = await api(server.baseUrl, "/api/state");
  const create = await adminSessionRequest(server, "/api/admin/events/create", {
    cookie,
    csrf,
    body: {
      title: "Session Created Draft",
      category: "concert",
      startsAt: "2026-12-24T19:30:00+09:00",
      venueId: "venue_jamsil_olympic",
      saleState: "OPEN_SOON",
      saleNote: "session create event",
      prices: { zone_vip: 160000, zone_r: 120000, zone_s: 90000 }
    }
  });
  assert.equal(create.json.data.event.title, "Session Created Draft");
  assert.ok(create.json.data.ticketsCreated > 0);

  const after = await api(server.baseUrl, "/api/state");
  assert.equal(after.data.events.length, before.data.events.length + 1);
  assert.ok(after.data.events.some((event) => event.id === create.json.data.event.id));
  assert.ok(after.data.tickets.some((ticket) => ticket.eventId === create.json.data.event.id));

  const tokenSummary = await adminApi(server, "/api/admin/summary");
  assert.ok(tokenSummary.data.events || tokenSummary.data.stats.totalTickets >= after.data.tickets.length);
});

test("readonly browser admin session renders dashboard without privileged API fanout", async (t) => {
  const server = await startServer(t, { env: { TIG_ADMIN_ROLES: "readonly" } });
  const login = await adminSessionRequest(server, "/api/admin/login", {
    body: { username: "admin", password: "admin" }
  });
  const cookie = login.setCookie.split(";")[0];
  assert.deepEqual(login.json.data.admin.roles.map((role) => role.name), ["Readonly"]);
  assert.ok(login.json.data.admin.permissions.includes("admin.dashboard.read"));
  assert.ok(login.json.data.admin.permissions.includes("acl.read"));
  assert.equal(login.json.data.admin.permissions.includes("catalog.manage"), false);

  const summary = await adminSessionRequest(server, "/api/admin/summary", { cookie });
  assert.ok(summary.json.data.stats.totalTickets > 0);

  const deniedVenues = await adminSessionRequest(server, "/api/admin/venues", {
    cookie,
    expectedStatus: 403
  });
  assert.equal(deniedVenues.json.error.code, "ADMIN_PERMISSION_DENIED");

  const deniedRoute = await adminSessionRequest(server, "/api/admin/unmapped", {
    cookie,
    expectedStatus: 403
  });
  assert.equal(deniedRoute.json.error.code, "ADMIN_ROUTE_DENIED");

  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const privilegedResponses = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname === "/api/admin/venues") {
      privilegedResponses.push(response.status());
    }
  });

  await page.goto(`${server.adminUrl}/console`);
  await page.locator('input[name="username"]').fill("admin");
  await page.locator('input[name="password"]').fill("admin");
  await page.getByRole("button", { name: "로그인" }).click();
  await page.getByText("전체 티켓").waitFor();

  assert.equal(await page.getByText("공연/티켓 생성").count(), 0);
  assert.equal(await page.getByText("Sale 저장").count(), 0);
  assert.equal(await page.getByText("계정 상태 저장").count(), 0);
  assert.equal(await page.getByText("문의 처리").count(), 0);
  assert.equal(await page.getByText("ACL/Roles").count(), 1);
  assert.deepEqual(privilegedResponses, []);
});

test("admin venue map images resolve through public assets", async (t) => {
  const server = await startServer(t);
  const venues = await adminApi(server, "/api/admin/venues");

  for (const venue of venues.data.venues) {
    assert.match(venue.mapImage, /^\/assets\//, `${venue.id} map image uses public assets`);
    const response = await fetch(`${server.baseUrl}${venue.mapImage}`);
    assert.equal(response.status, 200, `${venue.id} map image status`);
  }
});

test("admin sale settings update public event state and ticket prices", async (t) => {
  const server = await startServer(t);
  const { baseUrl } = server;
  const before = await api(baseUrl, "/api/state");
  const event = eventById(before);
  const prices = Object.fromEntries(event.zones.map((zone, index) => [zone.id, zone.faceValue + ((index + 1) * 1000)]));

  const updated = await adminApi(server, "/api/admin/events/sale", {
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
  const server = await startServer(t);
  const { baseUrl } = server;
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
  const reply = await adminApi(server, "/api/admin/support/messages", {
    threadId: support.data.id,
    message: "운영자 답변"
  });
  assert.equal(reply.data.status, "ANSWERED");

  const status = await adminApi(server, "/api/admin/users/statuses", {
    updates: [{ userId: "user_fan_b", status: "WATCHLIST" }],
    reason: "QA status update"
  });
  assert.equal(status.data[0].status, "WATCHLIST");

  const seatMap = await api(baseUrl, "/api/events/event_kpop_001/seat-map");
  assert.ok(seatMap.data.seats.length > 0);
  assert.ok(seatMap.data.labels.length > 0);

  const admin = await adminApi(server, "/api/admin/summary");
  assert.ok(admin.data.stats.watchlistEntries >= 1);
  assert.ok(admin.data.stats.supportOpen >= 1);
  assert.ok(admin.data.users.some((user) => user.id === "user_fan_b" && user.status === "WATCHLIST"));
});
