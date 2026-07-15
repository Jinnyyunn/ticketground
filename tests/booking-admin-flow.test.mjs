import test from "node:test";
import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { chromium } from "playwright";
import { normalizeAdminIpAllowlist } from "../backend/admin-acl.js";
import { adminApi, api, bootstrapAdminPassword, buyFirstTicket, startServer, verifyIdentity } from "./backend-test-utils.mjs";

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

test("admin login rejects excessive attempts from one client IP", async (t) => {
  const server = await startServer(t);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const failedLogin = await adminSessionRequest(server, "/api/admin/login", {
      body: { username: "admin", password: `wrong-password-${attempt}` },
      expectedStatus: 401
    });
    assert.equal(failedLogin.json.error.code, "ADMIN_LOGIN_FAILED");
  }

  const limitedLogin = await adminSessionRequest(server, "/api/admin/login", {
    body: { username: "admin", password: bootstrapAdminPassword },
    expectedStatus: 429
  });
  assert.equal(limitedLogin.json.error.code, "RATE_LIMITED");
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

test("browser admin inventory and resale operations work through changed controls", async (t) => {
  // Given: an open resale pool and an unread support alert visible to the admin console.
  const server = await startServer(t);
  const { ticket } = await buyFirstTicket(server.baseUrl);
  const pool = await api(server.baseUrl, "/api/resale/list", {
    sellerId: "user_fan_a",
    ticketId: ticket.id,
    price: ticket.faceValue
  });
  await api(server.baseUrl, "/api/support/threads", {
    userId: "user_fan_b",
    subject: "브라우저 알림 확인",
    message: "운영 알림 확인 요청"
  });

  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const bulkRequests = [];
  const cancelRequests = [];
  const ackRequests = [];
  page.on("request", (request) => {
    const pathName = new URL(request.url()).pathname;
    if (pathName === "/api/admin/tickets/statuses") bulkRequests.push(request.postDataJSON());
    if (pathName === "/api/admin/resale/cancel") cancelRequests.push(request.postDataJSON());
    if (pathName === "/api/admin/alerts/ack") ackRequests.push(request.postDataJSON());
  });

  // When: the operator filters inventory and bulk-holds one visible ticket.
  await page.goto(`${server.adminUrl}/console/inventory`);
  await page.locator('input[name="username"]').fill("admin");
  await page.locator('input[name="password"]').fill(bootstrapAdminPassword);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.getByRole("heading", { name: "티켓 재고 상태" }).waitFor();
  await page.locator('select[name="eventId"]').selectOption("event_kpop_001");
  await page.getByRole("button", { name: "필터 적용" }).click();
  await page.getByText(/건 중 .*건 표시/).waitFor();
  await page.locator('select[name="performanceDateId"]').selectOption("perf_kpop_20260919_1900");
  await page.locator('select[name="zoneId"]').selectOption("zone_vip");
  await page.getByRole("button", { name: "필터 적용" }).click();
  await page.getByText(/건 중 .*건 표시/).waitFor();
  await page.locator("tbody tr", { hasText: "판매 중" }).first().locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "선택 보류" }).click();
  await page.getByText("1개 티켓 상태가 갱신되었습니다.").waitFor();

  // Then: resale operations and alert acknowledgement are also driven through the UI.
  await page.getByRole("link", { name: "재판매/양도" }).click();
  await page.getByRole("heading", { name: "재판매/양도 현황" }).waitFor();
  await page.locator('input[name="reason"]').first().fill("브라우저 QA 강제 취소");
  await page.getByRole("button", { name: "강제 취소" }).first().click();
  await page.getByText("재판매 풀이 취소되었습니다.").waitFor();
  await page.getByRole("button", { name: "모두 확인" }).click();
  await page.getByText("운영 알림을 확인 처리했습니다.").waitFor();

  assert.equal(bulkRequests.length, 1);
  assert.equal(bulkRequests[0].updates[0].status, "ADMIN_HOLD");
  assert.equal(cancelRequests.length, 1);
  assert.equal(cancelRequests[0].poolId, pool.data.id);
  assert.equal(cancelRequests[0].reason, "브라우저 QA 강제 취소");
  assert.equal(ackRequests.length, 1);
  assert.ok(ackRequests[0].alertIds.length > 0);
});

test("browser admin finance and audit workspaces expose filters, payload detail, and export", async (t) => {
  // Given: purchase and resale data visible to finance plus ledger payloads visible to audit.
  const server = await startServer(t);
  const { ticket } = await buyFirstTicket(server.baseUrl);
  const pool = await api(server.baseUrl, "/api/resale/list", {
    sellerId: "user_fan_a",
    ticketId: ticket.id,
    price: ticket.faceValue
  });
  await verifyIdentity(server.baseUrl, "user_fan_b", "010-9000-0002");
  await api(server.baseUrl, "/api/resale/purchase", {
    buyerId: "user_fan_b",
    poolId: pool.data.id,
    paymentMethod: "BANK_TRANSFER"
  });

  const browser = await chromium.launch();
  t.after(() => browser.close());
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // When: the operator filters finance to the resale payment method.
  await page.goto(`${server.adminUrl}/console/finance`);
  await page.locator('input[name="username"]').fill("admin");
  await page.locator('input[name="password"]').fill(bootstrapAdminPassword);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.getByRole("heading", { name: "정산 거래" }).waitFor();
  await page.locator('select[name="method"]').selectOption("BANK_TRANSFER");
  await page.getByRole("button", { name: "필터 적용" }).click();
  await page.getByRole("cell", { name: "공식 재판매" }).waitFor();
  await page.getByText(/플랫폼 수수료/).waitFor();

  // Then: audit filtering exposes the full payload and CSV export downloads.
  await page.getByRole("link", { name: "감사 원장" }).click();
  await page.getByRole("heading", { level: 2, name: "감사 원장" }).waitFor();
  await page.locator('input[name="action"]').fill("RESALE_PURCHASE_MATCHED");
  await page.getByRole("button", { name: "필터 적용" }).click();
  await page.getByRole("button", { name: "RESALE_PURCHASE_MATCHED" }).first().click();
  await page.getByText("sellerSettlement").waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "내보내기" }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /ledger\.csv$/);
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

test("admin inventory workspace filters, paginates, and summarizes selected event zones", async (t) => {
  // Given: seeded tickets across multiple events, dates, and zones.
  const server = await startServer(t);
  const state = await api(server.baseUrl, "/api/state");
  const event = eventById(state);
  const performanceDateId = event.dates[1].id;
  const zoneId = event.zones[1].id;

  // When: the operator narrows inventory to one event/date/zone with a small page size.
  const inventory = await adminApi(server, `/api/admin/workspaces/inventory?eventId=${event.id}&performanceDateId=${performanceDateId}&zoneId=${zoneId}&limit=3&page=1`);

  // Then: only the requested slice is returned, page metadata is bounded, and all event zones are summarized.
  assert.equal(inventory.data.tickets.length, 3);
  assert.equal(inventory.data.page.limit, 3);
  assert.equal(inventory.data.page.page, 1);
  assert.ok(inventory.data.page.total > 3);
  assert.ok(inventory.data.page.hasNext);
  assert.ok(inventory.data.tickets.every((ticket) => ticket.eventId === event.id));
  assert.ok(inventory.data.tickets.every((ticket) => ticket.performanceDateId === performanceDateId));
  assert.ok(inventory.data.tickets.every((ticket) => ticket.zoneId === zoneId));
  assert.deepEqual(inventory.data.filters, { eventId: event.id, performanceDateId, zoneId });
  assert.deepEqual(inventory.data.zoneSummary.map((zone) => zone.zoneId), event.zones.map((zone) => zone.id));
  assert.equal(inventory.data.zoneSummary.find((zone) => zone.zoneId === zoneId).availableCount > 0, true);
});

test("admin finance workspace filters transactions and summarizes payment totals", async (t) => {
  // Given: one primary purchase and one resale purchase with known fee math.
  const server = await startServer(t);
  const { ticket } = await buyFirstTicket(server.baseUrl);
  const pool = await api(server.baseUrl, "/api/resale/list", {
    sellerId: "user_fan_a",
    ticketId: ticket.id,
    price: ticket.faceValue
  });
  await verifyIdentity(server.baseUrl, "user_fan_b", "010-9000-0002");
  const resale = await api(server.baseUrl, "/api/resale/purchase", {
    buyerId: "user_fan_b",
    poolId: pool.data.id,
    paymentMethod: "BANK_TRANSFER"
  });
  const resaleFee = Math.ceil(ticket.faceValue * 0.05);

  // When: finance reads all transactions and then filters to the resale payment method.
  const finance = await adminApi(server, "/api/admin/workspaces/finance?eventId=event_kpop_001&limit=10");
  const transferOnly = await adminApi(server, "/api/admin/workspaces/finance?eventId=event_kpop_001&method=BANK_TRANSFER&status=PAID&limit=10");

  // Then: summary totals match the real purchase/resale records created through commerce.
  assert.equal(finance.data.summary.count, 2);
  assert.equal(finance.data.summary.totalAmount, ticket.faceValue + resale.data.buyerTotal);
  assert.equal(finance.data.summary.totalFees, resaleFee);
  assert.equal(finance.data.summary.totalSettlements, ticket.faceValue);
  assert.equal(transferOnly.data.transactions.length, 1);
  assert.equal(transferOnly.data.transactions[0].type, "RESALE");
  assert.equal(transferOnly.data.transactions[0].method, "BANK_TRANSFER");
  assert.equal(transferOnly.data.summary.totalAmount, resale.data.buyerTotal);
});

test("admin audit workspace filters, paginates, and returns full payloads", async (t) => {
  // Given: two admin actions that write detailed USER_STATUS_UPDATED payloads.
  const server = await startServer(t);
  await adminApi(server, "/api/admin/users/status", {
    userId: "user_fan_a",
    status: "WATCHLIST",
    reason: "audit page one"
  });
  await adminApi(server, "/api/admin/users/status", {
    userId: "user_fan_b",
    status: "BANNED",
    reason: "audit page two"
  });

  // When: the audit workspace is filtered to that action and paginated.
  const audit = await adminApi(server, "/api/admin/workspaces/audit?action=USER_STATUS_UPDATED&actorId=ADMIN&limit=1&page=1");
  const nextPage = await adminApi(server, "/api/admin/workspaces/audit?action=USER_STATUS_UPDATED&actorId=ADMIN&limit=1&page=2");

  // Then: full payloads are included and page metadata walks the full ledger result set.
  assert.equal(audit.data.ledger.length, 1);
  assert.equal(audit.data.page.limit, 1);
  assert.equal(audit.data.page.total, 2);
  assert.equal(audit.data.page.hasNext, true);
  assert.equal(audit.data.ledger[0].action, "USER_STATUS_UPDATED");
  assert.equal(audit.data.ledger[0].actorId, "ADMIN");
  assert.ok(["audit page one", "audit page two"].includes(audit.data.ledger[0].payload.reason));
  assert.equal(nextPage.data.ledger.length, 1);
  assert.notEqual(nextPage.data.ledger[0].index, audit.data.ledger[0].index);
});

test("admin ledger CSV export returns filtered CSV and session permissions are enforced", async (t) => {
  // Given: an audit entry and browser-session roles with different read scopes.
  const server = await startServer(t);
  await adminApi(server, "/api/admin/users/status", {
    userId: "user_fan_a",
    status: "WATCHLIST",
    reason: "csv export reason"
  });
  const financeOnlyServer = await startServer(t, { env: { TIG_ADMIN_ROLES: "finance" } });
  const readonlyServer = await startServer(t, { env: { TIG_ADMIN_ROLES: "readonly" } });
  const financeLogin = await adminSessionRequest(financeOnlyServer, "/api/admin/login", {
    body: { username: "admin", password: bootstrapAdminPassword }
  });
  const readonlyLogin = await adminSessionRequest(readonlyServer, "/api/admin/login", {
    body: { username: "admin", password: bootstrapAdminPassword }
  });

  // When: CSV export uses action filters and restricted sessions request finance/export routes.
  const exportResponse = await fetch(`${server.adminUrl}/api/admin/ledger/export?action=USER_STATUS_UPDATED&actorId=ADMIN`, {
    headers: { "x-tig-admin-token": server.adminToken }
  });
  const csv = await exportResponse.text();
  const deniedExport = await adminSessionRequest(financeOnlyServer, "/api/admin/ledger/export", {
    cookie: financeLogin.setCookie.split(";")[0],
    expectedStatus: 403
  });
  const deniedFinance = await adminSessionRequest(readonlyServer, "/api/admin/workspaces/finance", {
    cookie: readonlyLogin.setCookie.split(";")[0],
    expectedStatus: 403
  });
  const allowedFinance = await adminSessionRequest(financeOnlyServer, "/api/admin/workspaces/finance", {
    cookie: financeLogin.setCookie.split(";")[0]
  });

  // Then: the export is real CSV with filtered rows and permissions match read/security scopes.
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-type") || "", /text\/csv/);
  assert.match(csv.split("\n")[0], /^"timestamp","actor","action","payload"$/);
  assert.match(csv, /USER_STATUS_UPDATED/);
  assert.match(csv, /csv export reason/);
  assert.doesNotMatch(csv, /BOOTSTRAP/);
  assert.equal(deniedExport.json.error.detail.permission, "security.manage");
  assert.equal(deniedFinance.json.error.detail.permission, "finance.read");
  assert.equal(Array.isArray(allowedFinance.json.data.transactions), true);
});

test("admin bulk ticket status update is transactional when one ticket is invalid", async (t) => {
  // Given: two available inventory tickets and one already-owned ticket.
  const server = await startServer(t);
  const state = await api(server.baseUrl, "/api/state");
  const availableTickets = state.data.tickets.filter((ticket) => ticket.eventId === "event_kpop_001" && ticket.status === "ON_SALE").slice(0, 2);
  assert.equal(availableTickets.length, 2);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const purchase = await api(server.baseUrl, "/api/tickets/buy", {
    userId: "user_fan_a",
    ticketId: availableTickets[1].id,
    paymentMethod: "CREDIT_CARD"
  });

  // When: a batch contains one valid update followed by a locked ticket.
  const rejected = await adminApi(server, "/api/admin/tickets/statuses", {
    updates: [
      { ticketId: availableTickets[0].id, status: "ADMIN_HOLD" },
      { ticketId: purchase.data.ticket.id, status: "ADMIN_HOLD" }
    ]
  }, 409);

  // Then: the error identifies the failed ticket and no earlier update is committed.
  assert.equal(rejected.error.code, "TICKET_LOCKED");
  assert.equal(rejected.error.detail.ticketId, purchase.data.ticket.id);
  const afterRejected = await api(server.baseUrl, "/api/state");
  assert.equal(afterRejected.data.tickets.find((ticket) => ticket.id === availableTickets[0].id).status, "ON_SALE");
  assert.equal(afterRejected.data.tickets.find((ticket) => ticket.id === purchase.data.ticket.id).status, "OWNED");

  const accepted = await adminApi(server, "/api/admin/tickets/statuses", {
    updates: [{ ticketId: availableTickets[0].id, status: "ADMIN_HOLD" }]
  });
  assert.deepEqual(accepted.data.map((ticket) => ticket.status), ["ADMIN_HOLD"]);
});

test("admin can force cancel another seller resale pool with an audit reason", async (t) => {
  // Given: a seller-owned open resale pool.
  const server = await startServer(t);
  const { ticket } = await buyFirstTicket(server.baseUrl);
  const pool = await api(server.baseUrl, "/api/resale/list", {
    sellerId: "user_fan_a",
    ticketId: ticket.id,
    price: ticket.faceValue
  });

  // When: admin force-cancels it without being the seller.
  const canceled = await adminApi(server, "/api/admin/resale/cancel", {
    poolId: pool.data.id,
    reason: "판매자 응답 없음"
  });

  // Then: the pool closes, the ticket returns to owned, and the ledger records the admin action.
  assert.equal(canceled.data.status, "CANCELED");
  const admin = await adminApi(server, "/api/admin/summary");
  assert.equal(admin.data.resalePools.find((item) => item.id === pool.data.id).cancelReason, "판매자 응답 없음");
  assert.equal(admin.data.tickets.find((item) => item.id === ticket.id).status, "OWNED");
  assert.ok(admin.data.ledger.some((entry) => entry.action === "ADMIN_RESALE_POOL_CANCELED" && entry.payload.poolId === pool.data.id));
});

test("admin alert acknowledgement reduces overview unread count", async (t) => {
  // Given: a support thread creates an unread operator alert.
  const server = await startServer(t);
  await api(server.baseUrl, "/api/support/threads", {
    userId: "user_fan_a",
    subject: "알림 확인 테스트",
    message: "읽음 처리 확인"
  });
  const resale = await adminApi(server, "/api/admin/workspaces/resale");
  const alert = resale.data.operatorAlerts.find((item) => item.status !== "ACKED");
  assert.ok(alert);
  const before = await adminApi(server, "/api/admin/summary");
  assert.ok(before.data.stats.operatorAlerts > 0);

  // When: the alert is acknowledged through the admin endpoint.
  const acked = await adminApi(server, "/api/admin/alerts/ack", {
    alertIds: [alert.id]
  });

  // Then: the same overview count drops and the resale workspace shows ACKED.
  assert.deepEqual(acked.data.acknowledgedAlertIds, [alert.id]);
  const after = await adminApi(server, "/api/admin/summary");
  assert.equal(after.data.stats.operatorAlerts, before.data.stats.operatorAlerts - 1);
  const refreshed = await adminApi(server, "/api/admin/workspaces/resale");
  assert.equal(refreshed.data.operatorAlerts.find((item) => item.id === alert.id).status, "ACKED");
});
