// allow: SIZE_OK - Standalone end-to-end QA harness; keeping the ordered API/browser evidence flow in one file avoids product bundle impact.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium } from "playwright";

const execFileAsync = promisify(execFile);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = await realpath(path.resolve(scriptDir, "../.."));
const args = process.argv.slice(2);
const allowedScenarios = new Set(["all", "api-contract", "browser-watchlist", "current-4500"]);

function optionValue(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args.at(index + 1);
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

const scenario = optionValue("--scenario", "all");
if (!allowedScenarios.has(scenario)) {
  throw new Error(`Unknown scenario "${scenario}". Expected one of ${[...allowedScenarios].join(", ")}`);
}

const evidenceDir = path.resolve(repoRoot, optionValue("--evidence-dir", ".omo/evidence/frontend-backend-contract-alignment/latest"));
const attestationSecret = "qa-app-attestation-secret";
const adminToken = "qa-admin-token";

const report = {
  startedAt: new Date().toISOString(),
  repoRoot,
  scenario,
  checks: [],
  mismatches: [],
  apiResponses: [],
  screenshots: [],
  servers: [],
  portOwners: [],
};

function appAttestation(purpose, ...parts) {
  return crypto
    .createHmac("sha256", attestationSecret)
    .update(["app", purpose, ...parts.map((part) => String(part || ""))].join(":"))
    .digest("hex");
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function api(baseUrl, pathName, body, expectedStatus = 200, headers = {}, label = pathName) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json", ...headers } : headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Keep body excerpt in the report for non-JSON routing failures.
  }
  report.apiResponses.push({
    label,
    path: pathName,
    status: response.status,
    expectedStatus,
    ok: response.status === expectedStatus,
    contentType: response.headers.get("content-type") || "",
    body: json ?? text.slice(0, 240),
  });
  assert.equal(response.status, expectedStatus, `${label} status ${response.status}: ${text.slice(0, 300)}`);
  assert.ok(json, `${label} returned JSON`);
  return json;
}

async function record(name, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn();
    report.checks.push({ name, status: "PASS", durationMs: Date.now() - startedAt, details });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.checks.push({ name, status: "FAIL", durationMs: Date.now() - startedAt, error: message });
    report.mismatches.push({ name, error: message });
  }
}

async function startServer(name, { now = "2026-09-19T17:00:00+09:00" } = {}) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), `ticketground-${name}-`));
  const port = await freePort();
  const adminPort = await freePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      ADMIN_HOSTNAME: "127.0.0.1",
      ADMIN_PORT: String(adminPort),
      TIG_ADMIN_TOKEN: adminToken,
      TIG_DB_PATH: path.join(tempDir, "db.json"),
      TIG_NOW: now,
      TIG_APP_ATTESTATION_SECRET: attestationSecret,
      TIG_SECRET: "qa-runtime-secret",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let exited = false;
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.once("exit", () => {
    exited = true;
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const adminUrl = `http://127.0.0.1:${adminPort}`;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (exited) break;
    try {
      const response = await fetch(`${baseUrl}/api/state`);
      if (response.ok && (response.headers.get("content-type") || "").includes("application/json")) {
        const server = { name, baseUrl, adminUrl, adminToken, tempDir, child, stdout: () => stdout, stderr: () => stderr };
        report.servers.push({ name, baseUrl, adminUrl, tempDir });
        return server;
      }
    } catch {
      // Wait until both HTTP servers are bound.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  child.kill("SIGTERM");
  await rm(tempDir, { recursive: true, force: true });
  throw new Error(`server ${name} did not start: stdout=${stdout} stderr=${stderr}`);
}

async function stopServer(server) {
  if (!server) return;
  if (!server.child.killed) {
    server.child.kill("SIGTERM");
    await new Promise((resolve) => server.child.once("exit", resolve));
  }
  await rm(server.tempDir, { recursive: true, force: true });
}

async function buyFirstTicket(baseUrl, userId = "user_fan_a") {
  const state = await api(baseUrl, "/api/state", undefined, 200, {}, `state before buy ${userId}`);
  const ticket = state.data.tickets.find((item) => item.eventId === "event_kpop_001" && item.status === "ON_SALE");
  assert.ok(ticket, "seeded on-sale kpop ticket exists");
  const purchase = await api(baseUrl, "/api/tickets/buy", {
    userId,
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD",
  }, 200, {}, `buy ${ticket.id}`);
  return { ticket: purchase.data.ticket, purchase: purchase.data };
}

async function screenshot(page, name) {
  const filePath = path.join(evidenceDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  report.screenshots.push(filePath);
  return filePath;
}

function isInsidePath(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function inspectPortOwner(port) {
  try {
    const { stdout } = await execFileAsync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
    const ownerLine = stdout.trim().split(/\n/).slice(1).find(Boolean);
    if (!ownerLine) return { port, listening: false };

    const [command, pidText] = ownerLine.trim().split(/\s+/);
    const pid = Number(pidText);
    let cwd = null;
    let resolvedCwd = null;

    if (Number.isFinite(pid)) {
      try {
        const { stdout: cwdOutput } = await execFileAsync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { encoding: "utf8" });
        cwd = cwdOutput.split(/\n/).find((line) => line.startsWith("n"))?.slice(1) ?? null;
        resolvedCwd = cwd ? await realpath(cwd) : null;
      } catch {
        // CWD may be unavailable for short-lived or protected processes; command/pid still identify the owner.
      }
    }

    return { port, listening: true, command, pid, cwd, resolvedCwd };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 1) {
      return { port, listening: false };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { port, listening: false, error: message };
  }
}

async function checkCurrentDev4500() {
  const baseUrl = "http://127.0.0.1:4500";
  const owner = await inspectPortOwner(4500);
  report.portOwners.push(owner);
  assert.equal(owner.listening, true, "current 4500 must have a listening process before same-origin QA");
  assert.ok(
    owner.resolvedCwd && isInsidePath(owner.resolvedCwd, repoRoot),
    `current 4500 owner mismatch: pid=${owner.pid ?? "unknown"} command=${owner.command ?? "unknown"} cwd=${owner.cwd ?? "unknown"} expected=${repoRoot}`,
  );

  const response = await fetch(`${baseUrl}/api/state`);
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // This is the expected shape of the current dev routing failure.
  }
  report.apiResponses.push({
    label: "current dev 4500 /api/state",
    path: "/api/state",
    status: response.status,
    expectedStatus: 200,
    ok: response.ok && Boolean(json?.ok),
    contentType,
    body: json ?? text.slice(0, 240),
  });
  assert.equal(response.status, 200, "current 4500 /api/state should be public API 200");
  assert.ok(contentType.includes("application/json"), "current 4500 /api/state should return JSON, not HTML");
  assert.equal(json?.ok, true, "current 4500 /api/state should return ok envelope");
}

async function runApiContract() {
  const server = await startServer("contract");
  try {
    const { baseUrl } = server;

    const home = await fetch(`${baseUrl}/`);
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-type") || "", /text\/html/);
    assert.match(await home.text(), /Ticketground|티켓|공연/);

    const publicAdminPage = await fetch(`${baseUrl}/admin`, { redirect: "manual" });
    assert.equal(publicAdminPage.status, 404);
    const publicAdminHtml = await fetch(`${baseUrl}/admin.html`, { redirect: "manual" });
    assert.equal(publicAdminHtml.status, 404);
    const publicAdmin = await api(baseUrl, "/api/admin/summary", undefined, 404, {}, "public admin hidden");
    assert.equal(publicAdmin.error.code, "NOT_FOUND");

    const missingToken = await api(server.adminUrl, "/api/admin/summary", undefined, 401, {}, "admin missing token");
    assert.equal(missingToken.error.code, "ADMIN_TOKEN_REQUIRED");
    const adminSummary = await api(server.adminUrl, "/api/admin/summary", undefined, 200, { "x-tig-admin-token": adminToken }, "admin summary");
    assert.ok(adminSummary.data.stats.totalTickets > 0);
    assert.equal(typeof adminSummary.data.stats.ledgerVerified, "boolean");

    const state = await api(baseUrl, "/api/state", undefined, 200, {}, "public state redaction");
    const publicUser = state.data.users.find((item) => item.id === "user_fan_a");
    assert.equal(publicUser.balance, undefined);
    assert.equal(publicUser.status, undefined);
    assert.equal(publicUser.trustScore, undefined);
    assert.equal(state.data.admissionCredentials, undefined);
    assert.equal(state.data.watchlist, undefined);
    assert.equal(state.data.supportThreads, undefined);

    const session = await api(baseUrl, "/api/users/user_fan_a/session", undefined, 200, {}, "session");
    assert.equal(session.data.status, "ACTIVE");
    assert.equal(typeof session.data.trustScore, "number");
    const updatedProfile = await api(baseUrl, "/api/users/user_fan_a/profile", { name: "민서QA" }, 200, {}, "profile update");
    assert.equal(updatedProfile.data.name, "민서QA");
    const invalidProfile = await api(baseUrl, "/api/users/user_fan_a/profile", { name: "1234567890123" }, 422, {}, "profile invalid length");
    assert.equal(invalidProfile.error.code, "INVALID_PROFILE_NAME");

    const watch = await api(baseUrl, "/api/watchlist", {
      userId: "user_fan_a",
      eventId: "event_kpop_001",
      channels: ["APP_PUSH", "KAKAO"],
      calendarEnabled: true,
      notificationEnabled: true,
    }, 200, {}, "watchlist upsert");
    assert.equal(watch.data.watchlist.eventId, "event_kpop_001");
    assert.equal(watch.data.notificationJobs.length, 2);
    const notify = await api(baseUrl, "/api/watchlist/notify", {
      watchlistId: watch.data.watchlist.id,
      type: "STATUS_CHANGE",
      dispatchNow: true,
    }, 200, {}, "watchlist notify");
    assert.equal(notify.data.notificationJob.status, "SENT");
    const malformedWatch = await api(baseUrl, "/api/watchlist", { userId: "user_fan_a" }, 400, {}, "watchlist malformed");
    assert.equal(malformedWatch.error.code, "MISSING_FIELD");

    const support = await api(baseUrl, "/api/support/threads", {
      userId: "user_fan_a",
      subject: "QA 문의",
      message: "프론트-백엔드 연동 확인",
    }, 200, {}, "support create");
    assert.equal(support.data.status, "OPEN");
    const supportAdd = await api(baseUrl, "/api/support/messages", {
      threadId: support.data.id,
      actorId: "user_fan_a",
      message: "추가 문의",
    }, 200, {}, "support add message");
    assert.equal(supportAdd.data.messages.at(-1).body, "추가 문의");
    const supportReply = await api(server.adminUrl, "/api/admin/support/messages", {
      threadId: support.data.id,
      message: "운영자 답변",
    }, 200, { "x-tig-admin-token": adminToken }, "admin support reply");
    assert.equal(supportReply.data.status, "ANSWERED");
    const emptySupport = await api(baseUrl, "/api/support/threads", {
      userId: "user_fan_a",
      message: " ",
    }, 400, {}, "support empty message");
    assert.equal(emptySupport.error.code, "EMPTY_SUPPORT_MESSAGE");

    const seatMap = await api(baseUrl, "/api/seat-map?eventId=event_kpop_001", undefined, 200, {}, "seat map");
    assert.ok(seatMap.data.seats.length > 0);
    assert.ok(seatMap.data.zones.length > 0);
    const venueMap = await api(baseUrl, "/api/events/event_kpop_001/seat-map", undefined, 200, {}, "event venue map");
    assert.ok(venueMap.data.labels.length > 0);

    const { ticket: transferTicket } = await buyFirstTicket(baseUrl);
    const transfer = await api(baseUrl, "/api/security/direct-transfer-attempt", {
      actorId: "user_fan_a",
      ticketId: transferTicket.id,
      targetUserId: "user_fan_b",
      offeredPrice: 2000,
    }, 200, {}, "direct transfer blocked");
    assert.equal(transfer.data.blocked, true);

    const { ticket: resalePurchaseTicket } = await buyFirstTicket(baseUrl);
    const pool = await api(baseUrl, "/api/resale/list", {
      sellerId: "user_fan_a",
      ticketId: resalePurchaseTicket.id,
      price: resalePurchaseTicket.faceValue,
    }, 200, {}, "resale list");
    const joined = await api(baseUrl, "/api/resale/join", {
      buyerId: "user_scalper",
      poolId: pool.data.id,
    }, 200, {}, "resale join");
    assert.equal(joined.data.buyerCount, 1);
    const purchase = await api(baseUrl, "/api/resale/purchase", {
      buyerId: "user_fan_b",
      poolId: pool.data.id,
      paymentMethod: "CREDIT_CARD",
    }, 200, {}, "resale purchase");
    const expectedFee = Math.ceil(resalePurchaseTicket.faceValue * 0.05);
    assert.equal(purchase.data.fee, expectedFee);
    assert.equal(purchase.data.buyerTotal, resalePurchaseTicket.faceValue + expectedFee);
    assert.equal(purchase.data.sellerSettlement, resalePurchaseTicket.faceValue);
    assert.equal(purchase.data.payment.status, "PAID");
    assert.equal(purchase.data.pool.status, "MATCHED");

    const { ticket: resaleDrawTicket } = await buyFirstTicket(baseUrl);
    const drawPool = await api(baseUrl, "/api/resale/list", {
      sellerId: "user_fan_a",
      ticketId: resaleDrawTicket.id,
      price: resaleDrawTicket.faceValue,
    }, 200, {}, "resale draw list");
    await api(baseUrl, "/api/resale/join", {
      buyerId: "user_fan_b",
      poolId: drawPool.data.id,
    }, 200, {}, "resale draw join");
    const draw = await api(baseUrl, "/api/resale/draw", {
      poolId: drawPool.data.id,
      paymentMethod: "CREDIT_CARD",
    }, 200, {}, "resale draw");
    assert.equal(draw.data.payment.status, "PAID");
    assert.equal(draw.data.fee, Math.ceil(resaleDrawTicket.faceValue * 0.05));
    const { ticket: badPolicyTicket } = await buyFirstTicket(baseUrl);
    const badResale = await api(baseUrl, "/api/resale/list", {
      sellerId: "user_fan_a",
      ticketId: badPolicyTicket.id,
      price: badPolicyTicket.maxPrice + 1,
    }, 422, {}, "resale price policy");
    assert.equal(badResale.error.code, "PRICE_OUT_OF_POLICY");

    const { ticket: admissionTicket, purchase: admissionPurchase } = await buyFirstTicket(baseUrl);
    assert.equal(admissionPurchase.admission.activationChannel, "APP_ONLY");
    assert.equal(admissionPurchase.admissionCredential, undefined);
    const virtualQr = await api(baseUrl, "/api/tickets/virtual-qr", {
      userId: "user_fan_a",
      ticketId: admissionTicket.id,
    }, 200, {}, "virtual qr");
    assert.equal(virtualQr.data.type, "VIRTUAL_TICKET");
    assert.equal(virtualQr.data.signature, undefined);
    const trustedDevice = await api(baseUrl, "/api/devices/trust", {
      userId: "user_fan_a",
      deviceId: "iphone-qa",
      deviceName: "QA iPhone",
      platform: "iOS",
      biometricVerified: true,
      appAttestation: appAttestation("TRUST_DEVICE", "user_fan_a", "iphone-qa"),
    }, 200, {}, "device trust");
    assert.equal(trustedDevice.data.device.status, "TRUSTED");
    const admissionQr = await api(baseUrl, "/api/tickets/qr", {
      userId: "user_fan_a",
      ticketId: admissionTicket.id,
      channel: "APP",
      deviceId: "iphone-qa",
      deviceToken: trustedDevice.data.deviceToken,
      appAttestation: appAttestation("ISSUE_QR", "user_fan_a", "iphone-qa", admissionTicket.id),
    }, 200, {}, "real admission qr");
    assert.equal(admissionQr.data.type, "ADMISSION");
    assert.equal(admissionQr.data.ttlSeconds, 20);
    const accepted = await api(baseUrl, "/api/gate/verify", admissionQr.data, 200, {}, "gate verify accepted");
    assert.equal(accepted.data.valid, true);
    const replay = await api(baseUrl, "/api/gate/verify", admissionQr.data, 200, {}, "gate verify replay");
    assert.equal(replay.data.valid, false);

    const beforeSale = await api(baseUrl, "/api/state", undefined, 200, {}, "state before admin sale");
    const event = beforeSale.data.events.find((item) => item.id === "event_kpop_001");
    assert.ok(event);
    const prices = Object.fromEntries(event.zones.map((zone, index) => [zone.id, zone.faceValue + ((index + 1) * 1000)]));
    const saleUpdate = await api(server.adminUrl, "/api/admin/events/sale", {
      eventId: event.id,
      title: "QA Live Sale",
      category: event.category,
      startsAt: "2026-10-03T20:00:00+09:00",
      venueId: event.venueId,
      saleState: "DISCOUNT_SOON",
      saleNote: "QA sale note",
      discountRate: 15,
      prices,
    }, 200, { "x-tig-admin-token": adminToken }, "admin sale update");
    assert.equal(saleUpdate.data.event.title, "QA Live Sale");
    const afterSale = await api(baseUrl, "/api/state", undefined, 200, {}, "state after admin sale");
    const publicEvent = afterSale.data.events.find((item) => item.id === event.id);
    assert.equal(publicEvent.title, "QA Live Sale");
    assert.equal(publicEvent.saleNote, "QA sale note");
  } finally {
    await stopServer(server);
  }

  const early = await startServer("early", { now: "2026-09-19T15:00:00+09:00" });
  try {
    const { baseUrl } = early;
    const { ticket } = await buyFirstTicket(baseUrl);
    const forgedDevice = await api(baseUrl, "/api/devices/trust", {
      userId: "user_fan_a",
      deviceId: "forged-iphone",
      biometricVerified: true,
    }, 403, {}, "forged device");
    assert.equal(forgedDevice.error.code, "APP_ATTESTATION_REQUIRED");
    const device = await api(baseUrl, "/api/devices/trust", {
      userId: "user_fan_a",
      deviceId: "iphone-early",
      biometricVerified: true,
      appAttestation: appAttestation("TRUST_DEVICE", "user_fan_a", "iphone-early"),
    }, 200, {}, "early device trust");
    const webQr = await api(baseUrl, "/api/tickets/qr", {
      userId: "user_fan_a",
      ticketId: ticket.id,
      channel: "WEB",
    }, 403, {}, "web qr rejected");
    assert.equal(webQr.error.code, "APP_CHANNEL_REQUIRED");
    const earlyQr = await api(baseUrl, "/api/tickets/qr", {
      userId: "user_fan_a",
      ticketId: ticket.id,
      channel: "APP",
      deviceId: "iphone-early",
      deviceToken: device.data.deviceToken,
      appAttestation: appAttestation("ISSUE_QR", "user_fan_a", "iphone-early", ticket.id),
    }, 409, {}, "early qr rejected");
    assert.equal(earlyQr.error.code, "REAL_QR_NOT_READY");
    const forgedQr = await api(baseUrl, "/api/tickets/qr", {
      userId: "user_fan_a",
      ticketId: ticket.id,
      channel: "APP",
      deviceId: "iphone-early",
      deviceToken: device.data.deviceToken,
      appAttestation: appAttestation("ISSUE_QR", "user_fan_b", "iphone-early", ticket.id),
    }, 403, {}, "forged qr rejected");
    assert.equal(forgedQr.error.code, "APP_ATTESTATION_REQUIRED");
  } finally {
    await stopServer(early);
  }
}

async function runBrowserFlow() {
  const server = await startServer("browser");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const page = await context.newPage();
  const responses = [];
  const browserUiMismatches = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/")) return;
    responses.push({ url: url.replace(server.baseUrl, ""), status: response.status(), ok: response.ok() });
  });

  try {
    await page.goto(`${server.baseUrl}/login`, { waitUntil: "networkidle" });
    await page.getByText(/세션 연결됨/).waitFor({ timeout: 10_000 });
    await page.getByLabel("닉네임").fill("민서UIQA");
    await page.getByRole("button", { name: "프로필 저장" }).click();
    await page.getByText(/프로필 저장 완료/).waitFor({ timeout: 10_000 });
    await screenshot(page, "browser-login-profile");

    await page.goto(`${server.baseUrl}/booking/les-miserables`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();
    await page.getByText("실시간 좌석도").waitFor({ timeout: 10_000 });
    await screenshot(page, "browser-booking-before-seat-wait");
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes("석 로드") || text.includes("좌석도를 불러오지 못했습니다") || text.includes("Unexpected");
    }, undefined, { timeout: 10_000 });
    const bookingText = await page.locator("body").innerText();
    assert.match(bookingText, /석 로드/, `booking backend seat map did not load. body=${bookingText.slice(0, 600)}`);
    await page.getByRole("button", { name: "결제 단계로 이동" }).click();
    await page.getByRole("link", { name: "결제하기" }).click();
    await page.waitForURL(/\/checkout\/les-miserables/, { timeout: 10_000 });
    await page.getByLabel(/결제 조건/).check();
    const virtualQrAfterCheckout = page.waitForResponse((response) =>
      response.url().includes("/api/tickets/virtual-qr") &&
      response.request().method() === "POST" &&
      response.status() === 200,
    );
    await page.getByRole("button", { name: "결제 완료" }).click();
    await page.waitForURL(/\/reservation\//, { timeout: 10_000 });
    const virtualQrPayload = await (await virtualQrAfterCheckout).json();
    assert.equal(virtualQrPayload.ok, true);
    await page.waitForFunction(() => {
      const text = document.body.innerText;
      return text.includes("가상 티켓 발급 완료") || text.includes("잠금 · 가상 티켓");
    }, undefined, { timeout: 10_000 });
    await screenshot(page, "browser-reservation-virtual-qr");

    await page.goto(`${server.baseUrl}/watchlist`, { waitUntil: "networkidle" });
    const watchlistSave = page.waitForResponse((response) =>
      response.url().includes("/api/watchlist") &&
      response.request().method() === "POST" &&
      !response.url().includes("/notify"),
    );
    await page.getByRole("button", { name: /SMS 수신/ }).click();
    const watchlistPayload = await (await watchlistSave).json();
    assert.equal(watchlistPayload.ok, true);
    assert.equal(watchlistPayload.data.watchlist.eventId, "event_kpop_001");
    await screenshot(page, "browser-watchlist-channel-save");
    const watchlistTextAfterSave = await page.locator("body").innerText();
    if (/invalid_type|expected array|received undefined|Invalid input/i.test(watchlistTextAfterSave)) {
      browserUiMismatches.push("watchlist channel save exposes raw Zod validation JSON instead of a user-safe success/error message");
    }
    await page.getByRole("button", { name: "즉시 알림 기록" }).first().click();
    await page.getByText(/알림 기록 완료 · 발송됨/).waitFor({ timeout: 10_000 });
    await screenshot(page, "browser-watchlist-notify");

    await page.goto(`${server.baseUrl}/support/inquiry`, { waitUntil: "networkidle" });
    await page.getByTestId("inquiry-compose").fill("UI QA 문의 등록");
    await page.getByTestId("inquiry-send").click();
    await page.getByText(/문의 전송 완료/).waitFor({ timeout: 10_000 });
    await page.getByTestId("inquiry-compose").fill("UI QA 추가 메시지");
    await page.getByTestId("inquiry-send").click();
    await page.getByText(/문의 전송 완료/).waitFor({ timeout: 10_000 });
    await screenshot(page, "browser-support-thread");

    await page.goto(`${server.baseUrl}/resale`, { waitUntil: "networkidle" });
    await page.getByText(/보유 티켓 확인|보유 티켓이 없습니다/).waitFor({ timeout: 10_000 });
    await page.getByTestId("resale-register").click();
    await page.getByText(/풀 .* 등록|공식 재판매 풀 등록 완료/).waitFor({ timeout: 10_000 });
    await page.getByRole("button", { name: "구하기" }).click();
    await page.getByTestId("resale-purchase").click();
    await page.getByText(/매칭 완료 · 구매자 총액/).waitFor({ timeout: 10_000 });
    await screenshot(page, "browser-resale-purchase");

    await page.goto(`${server.baseUrl}/transfer`, { waitUntil: "networkidle" });
    await page.getByLabel("받는 사람 정보").fill("qa-recipient");
    await page.getByRole("button", { name: "양도 요청" }).click();
    await page.getByText(/지정 양도 차단|테스트 티켓 확보/).waitFor({ timeout: 10_000 });
    await page.getByText(/지정 양도 차단/).waitFor({ timeout: 10_000 });
    await screenshot(page, "browser-transfer-blocked");

    const requiredPaths = [
      "/api/users/user_fan_a/session",
      "/api/users/user_fan_a/profile",
      "/api/seat-map?eventId=event_kpop_001",
      "/api/tickets/buy",
      "/api/tickets/virtual-qr",
      "/api/watchlist",
      "/api/watchlist/notify",
      "/api/support/threads",
      "/api/support/messages",
      "/api/resale/list",
      "/api/resale/join",
      "/api/resale/purchase",
      "/api/security/direct-transfer-attempt",
    ];
    for (const requiredPath of requiredPaths) {
      assert.ok(
        responses.some((item) => item.url.includes(requiredPath) && item.status >= 200 && item.status < 300),
        `browser flow did not observe successful ${requiredPath}`,
      );
    }
    assert.ok(responses.every((item) => item.status < 400), `browser flow API failures: ${JSON.stringify(responses.filter((item) => item.status >= 400))}`);
    assert.deepEqual(browserUiMismatches, [], `browser UI mismatches: ${browserUiMismatches.join("; ")}`);
  } finally {
    report.browserResponses = responses;
    report.browserUiMismatches = browserUiMismatches;
    await context.close();
    await browser.close();
    await stopServer(server);
  }
}

const scenarioChecks = {
  "current-4500": [
    ["current dev 4500 serves public API on same origin", checkCurrentDev4500],
  ],
  "api-contract": [
    ["production API contract matches backend expectations", runApiContract],
  ],
  "browser-watchlist": [
    ["production browser flows call backend and render resulting state", runBrowserFlow],
  ],
  all: [
    ["current dev 4500 serves public API on same origin", checkCurrentDev4500],
    ["production API contract matches backend expectations", runApiContract],
    ["production browser flows call backend and render resulting state", runBrowserFlow],
  ],
};

await mkdir(evidenceDir, { recursive: true });
for (const [name, fn] of scenarioChecks[scenario]) {
  await record(name, fn);
}

report.finishedAt = new Date().toISOString();
report.summary = {
  total: report.checks.length,
  passed: report.checks.filter((check) => check.status === "PASS").length,
  failed: report.checks.filter((check) => check.status === "FAIL").length,
};

await writeFile(path.join(evidenceDir, "functional-qa-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.failed > 0) {
  process.exitCode = 1;
}
