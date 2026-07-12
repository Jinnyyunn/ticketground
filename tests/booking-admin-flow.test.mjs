import test from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { chromium } from "playwright";
import { normalizeAdminIpAllowlist } from "../backend/admin-acl.js";
import { adminApi, api, bootstrapAdminPassword, startServer } from "./backend-test-utils.mjs";

const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAF/wJ/0R5yyAAAAABJRU5ErkJggg==";

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
    body: { username: "admin", password: bootstrapAdminPassword }
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
  assert.deepEqual(session.json.data.admin.roles.map((role) => role.name), ["소유자"]);
  assert.ok(session.json.data.permissionCatalog.some((permission) => permission.key === "acl.read"));

  const summary = await adminSessionRequest(server, "/api/admin/summary", { cookie });
  assert.ok(summary.json.data.stats.totalTickets > 0);
  assert.equal(summary.json.data.tickets, undefined);
  assert.equal(summary.json.data.users, undefined);

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
      prices: { zone_vip: 160000, zone_r: 120000, zone_s: 90000 },
      imageDataUrl: tinyPng
    }
  });
  assert.equal(create.json.data.event.title, "Session Created Draft");
  assert.ok(create.json.data.ticketsCreated > 0);
  assert.match(create.json.data.event.image, /^\/uploads\/admin\/event-poster_/);
  t.after(() => rm(new URL(`../public${create.json.data.event.image}`, import.meta.url), { force: true }));
  const uploadedPoster = await fetch(`${server.baseUrl}${create.json.data.event.image}`);
  assert.equal(uploadedPoster.status, 200);
  assert.match(uploadedPoster.headers.get("content-type") || "", /image\/png/);

  const after = await api(server.baseUrl, "/api/state");
  assert.equal(after.data.events.length, before.data.events.length + 1);
  assert.ok(after.data.events.every((event) => typeof event.slug === "string" && event.slug.length > 0));
  assert.ok(after.data.events.some((event) => event.id === create.json.data.event.id));
  assert.equal(after.data.events.find((event) => event.id === create.json.data.event.id)?.slug, create.json.data.event.slug);
  assert.ok(after.data.tickets.some((ticket) => ticket.eventId === create.json.data.event.id));

  const tokenSummary = await adminApi(server, "/api/admin/summary");
  assert.ok(tokenSummary.data.events || tokenSummary.data.stats.totalTickets >= after.data.tickets.length);
  const tokenAcl = await adminApi(server, "/api/admin/workspaces/acl");
  assert.equal(tokenAcl.data.adminAccounts.some((account) => account.username === "admin" && account.bootstrap), true);
});

test("administrator account IP ACL protects login and active sessions", async (t) => {
  const server = await startServer(t);
  const bootstrap = await adminSessionRequest(server, "/api/admin/login", { body: { username: "admin", password: bootstrapAdminPassword } });
  const cookie = bootstrap.setCookie.split(";")[0];
  const csrf = bootstrap.json.data.csrf;
  const created = await adminSessionRequest(server, "/api/admin/admin-accounts", {
    cookie,
    csrf,
    body: { username: "ops-qa", password: "ops-qa-password", roleKeys: ["readonly"], ipAllowlist: ["127.0.0.1/32"] }
  });
  assert.equal(created.json.data.username, "ops-qa");
  assert.deepEqual(created.json.data.ipAllowlist, ["127.0.0.1/32"]);
  assert.doesNotMatch(JSON.stringify(created.json.data), /passwordHash|passwordSalt/);
  assert.deepEqual(created.json.data.roleKeys, ["readonly"]);

  const aclWorkspace = await adminSessionRequest(server, "/api/admin/workspaces/acl", { cookie });
  const bootstrapAccount = aclWorkspace.json.data.adminAccounts.find((account) => account.username === "admin");
  assert.ok(bootstrapAccount);
  assert.equal(bootstrapAccount.bootstrap, true);
  assert.deepEqual(bootstrapAccount.roleKeys, ["owner"]);
  assert.deepEqual(aclWorkspace.json.data.adminAccounts.find((account) => account.id === created.json.data.id)?.roleKeys, ["readonly"]);

  const duplicateBootstrap = await adminSessionRequest(server, "/api/admin/admin-accounts", {
    cookie,
    csrf,
    body: { username: "admin", password: "another-password", roleKeys: ["readonly"] },
    expectedStatus: 409
  });
  assert.equal(duplicateBootstrap.json.error.code, "ADMIN_ACCOUNT_EXISTS");

  const secondary = await adminSessionRequest(server, "/api/admin/login", { body: { username: "ops-qa", password: "ops-qa-password" } });
  const secondaryCookie = secondary.setCookie.split(";")[0];
  const secondarySession = await adminSessionRequest(server, "/api/admin/session", { cookie: secondaryCookie });
  assert.equal(secondarySession.json.data.admin.username, "ops-qa");

  const preservedAcl = await adminSessionRequest(server, "/api/admin/admin-accounts/update", {
    cookie,
    csrf,
    body: { adminId: created.json.data.id, roleKeys: ["readonly"], active: true }
  });
  assert.deepEqual(preservedAcl.json.data.ipAllowlist, ["127.0.0.1/32"]);

  await adminSessionRequest(server, "/api/admin/admin-accounts/update", {
    cookie,
    csrf,
    body: { adminId: created.json.data.id, roleKeys: ["readonly"], ipAllowlist: ["10.0.0.0/8"], active: true }
  });
  const deniedActiveSession = await adminSessionRequest(server, "/api/admin/session", { cookie: secondaryCookie, expectedStatus: 403 });
  assert.equal(deniedActiveSession.json.error.code, "ADMIN_IP_DENIED");
  const deniedLogin = await adminSessionRequest(server, "/api/admin/login", { body: { username: "ops-qa", password: "ops-qa-password" }, expectedStatus: 403 });
  assert.equal(deniedLogin.json.error.code, "ADMIN_IP_DENIED");
});

test("bootstrap administrator IP ACL protects bootstrap login", async (t) => {
  const server = await startServer(t, { env: { TIG_ADMIN_IP_ALLOWLIST: "10.0.0.0/8" } });
  const deniedLogin = await adminSessionRequest(server, "/api/admin/login", {
    body: { username: "admin", password: bootstrapAdminPassword },
    expectedStatus: 403
  });
  assert.equal(deniedLogin.json.error.code, "ADMIN_IP_DENIED");
});

test("administrator cannot assign a role with permissions they do not hold", async (t) => {
  const server = await startServer(t);
  const owner = await adminSessionRequest(server, "/api/admin/login", { body: { username: "admin", password: bootstrapAdminPassword } });
  const ownerCookie = owner.setCookie.split(";")[0];
  const ownerCsrf = owner.json.data.csrf;
  const created = await adminSessionRequest(server, "/api/admin/admin-accounts", {
    cookie: ownerCookie,
    csrf: ownerCsrf,
    body: { username: "catalog-admin", password: "catalog-admin-password", roleKeys: ["admin"], ipAllowlist: [] }
  });
  const adminLogin = await adminSessionRequest(server, "/api/admin/login", { body: { username: "catalog-admin", password: "catalog-admin-password" } });
  const adminCookie = adminLogin.setCookie.split(";")[0];
  const reservedBootstrap = await adminSessionRequest(server, "/api/admin/admin-accounts", {
    cookie: adminCookie,
    csrf: adminLogin.json.data.csrf,
    body: { username: "admin", password: "reserved-admin-password", roleKeys: ["readonly"], ipAllowlist: [] },
    expectedStatus: 409
  });
  assert.equal(reservedBootstrap.json.error.code, "ADMIN_ACCOUNT_EXISTS");
  const secondaryAcl = await adminSessionRequest(server, "/api/admin/workspaces/acl", { cookie: adminCookie });
  assert.equal(secondaryAcl.json.data.adminAccounts.some((account) => account.username === "admin" && account.bootstrap), true);
  const denied = await adminSessionRequest(server, "/api/admin/admin-accounts", {
    cookie: adminCookie,
    csrf: adminLogin.json.data.csrf,
    body: { username: "forbidden-owner", password: "forbidden-owner-password", roleKeys: ["owner"], ipAllowlist: [] },
    expectedStatus: 403
  });
  assert.equal(denied.json.error.code, "ADMIN_ROLE_ESCALATION");
  assert.ok(created.json.data.id);
});

test("administrator IP ACL rejects malformed CIDR entries", () => {
  assert.throws(() => normalizeAdminIpAllowlist(["10.0.0.0/8/32"]), /IPv4 주소 또는 CIDR/);
});

test("readonly browser admin session renders dashboard without privileged API fanout", async (t) => {
  const server = await startServer(t, { env: { TIG_ADMIN_ROLES: "readonly" } });
  const login = await adminSessionRequest(server, "/api/admin/login", {
    body: { username: "admin", password: bootstrapAdminPassword }
  });
  const cookie = login.setCookie.split(";")[0];
  assert.deepEqual(login.json.data.admin.roles.map((role) => role.name), ["조회 전용"]);
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
  await page.locator('input[name="password"]').fill(bootstrapAdminPassword);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.getByText("전체 티켓").waitFor();

  assert.equal(await page.getByText("공연/티켓 생성").count(), 0);
  assert.equal(await page.getByText("Sale 저장").count(), 0);
  assert.equal(await page.getByText("계정 상태 저장").count(), 0);
  assert.equal(await page.getByText("문의 처리").count(), 0);
  assert.equal(await page.getByText("관리자/ACL").count(), 1);
  assert.deepEqual(privilegedResponses, []);
});

test("catalog workspace validates a missing performance title without submitting", async (t) => {
  const server = await startServer(t);
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(`${server.adminUrl}/console/catalog`);
  await page.locator('input[name="username"]').fill("admin");
  await page.locator('input[name="password"]').fill(bootstrapAdminPassword);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.getByRole("heading", { name: "신규 공연/티켓 추가" }).waitFor();

  const createRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/admin/events/create") {
      createRequests.push(request.method());
    }
  });
  await page.locator('input[name="title"]').fill("");
  await page.getByRole("button", { name: "공연/티켓 생성" }).click();

  await page.getByText("공연명을 입력해주세요.").waitFor();
  assert.deepEqual(createRequests, []);
});

test("catalog browser upload publishes a poster-backed performance to the public detail page", async (t) => {
  const server = await startServer(t);
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const title = "브라우저 업로드 공개 공연";

  await page.goto(`${server.adminUrl}/console/catalog`);
  await page.locator('input[name="username"]').fill("admin");
  await page.locator('input[name="password"]').fill(bootstrapAdminPassword);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.getByRole("heading", { name: "신규 공연/티켓 추가" }).waitFor();
  await page.locator('input[name="title"]').fill(title);
  await page.locator('input[name="poster"]').setInputFiles({
    name: "poster.png",
    mimeType: "image/png",
    buffer: Buffer.from(tinyPng.split(",")[1], "base64")
  });
  await page.getByRole("button", { name: "공연/티켓 생성" }).click();
  await page.getByText("신규 공연과 티켓이 생성되었습니다.").waitFor();

  const state = await api(server.baseUrl, "/api/state");
  const event = state.data.events.find((item) => item.title === title);
  assert.ok(event);
  t.after(() => rm(new URL(`../public${event.image}`, import.meta.url), { force: true }));

  await page.goto(`${server.baseUrl}/`);
  const publicCard = page.getByRole("link", { name: new RegExp(title) });
  await publicCard.waitFor();
  await publicCard.click();
  await page.getByRole("heading", { name: title }).waitFor();
  assert.equal(await page.getByRole("img", { name: `${title} 포스터` }).count(), 1);
});

test("browser console menus load focused workspaces and save support status", async (t) => {
  const server = await startServer(t);
  await api(server.baseUrl, "/api/support/threads", {
    userId: "user_fan_a",
    subject: "콘솔 상태 변경 확인",
    message: "운영자 답변을 기다립니다."
  });
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const statusRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/admin/support/status") {
      statusRequests.push(request.postDataJSON());
    }
  });

  await page.goto(`${server.adminUrl}/console`);
  await page.locator('input[name="username"]').fill("admin");
  await page.locator('input[name="password"]').fill(bootstrapAdminPassword);
  await page.getByRole("button", { name: "로그인" }).click();

  for (const [label, heading] of [["공연/상품", "공연/상품"], ["판매 설정", "판매 설정"], ["계정", "계정"], ["재판매/양도", "재판매/양도"]]) {
    await page.getByRole("link", { name: label }).click();
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  }

  await page.getByRole("link", { name: "고객 지원" }).click();
  await page.getByRole("heading", { name: "고객 지원", exact: true }).waitFor();
  await page.locator('select[name="status"]').selectOption("CLOSED");
  await page.getByRole("button", { name: "문의 답변 등록" }).click();
  await page.getByText("문의 답변과 상태가 갱신되었습니다.").waitFor();
  assert.equal(statusRequests.length, 1);
  assert.equal(statusRequests[0].status, "CLOSED");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.getByRole("link", { name: "관리자/ACL" }).click();
  await page.getByRole("heading", { name: "관리자/ACL", exact: true }).waitFor();
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
