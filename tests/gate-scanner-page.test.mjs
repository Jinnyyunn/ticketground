import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import {
  adminApi,
  api,
  buyFirstNativeTicket,
  issueIosAdmissionQr,
  nativeGoogleLogin,
  startAttestedServer,
  trustIosDevice
} from "./backend-test-utils.mjs";

async function issueAdmissionQrPayload(server) {
  const { baseUrl } = server;
  const login = await nativeGoogleLogin(baseUrl);
  const { ticket } = await buyFirstNativeTicket(baseUrl, login);
  const device = await trustIosDevice(baseUrl, login, {
    deviceId: "gate-page-test-iphone",
    deviceName: "Gate Page Test iPhone"
  });
  const qr = await issueIosAdmissionQr(baseUrl, login, {
    ticketId: ticket.id,
    deviceId: "gate-page-test-iphone",
    deviceToken: device.data.deviceToken
  });
  return JSON.stringify({
    ticketId: qr.data.ticketId,
    ownerId: qr.data.ownerId,
    expiresAt: qr.data.expiresAt,
    nonce: qr.data.nonce,
    signature: qr.data.signature
  });
}

test("gate page: registering a token switches to the scanner, and manual QR entry admits a real ticket", async (t) => {
  const server = await startAttestedServer(t);
  const issued = await adminApi(server, "/api/admin/gate-sessions", { gateLabel: "정문 A" });
  const qrPayload = await issueAdmissionQrPayload(server);

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  t.after(() => context.close());
  const page = await context.newPage();

  await page.goto(`${server.baseUrl}/gate`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "게이트 단말 등록" }).waitFor({ timeout: 5000 });

  await page.getByPlaceholder("예: 정문 A").fill("정문 A");
  await page.getByPlaceholder("관리자 화면에서 발급된 토큰을 붙여넣으세요").fill(issued.data.token);
  await page.getByRole("button", { name: "이 기기 등록하기" }).click();

  // The registration screen is gone and the scanner shell (with the camera
  // permission gate, since headless Chrome has no real camera) is up.
  await page.getByRole("button", { name: "스캔 시작" }).waitFor({ timeout: 5000 });

  await page.getByText("카메라 대신 QR 값 직접 입력").click();
  await page.locator("textarea").fill(qrPayload);
  await page.getByRole("button", { name: "확인" }).click();

  await page.getByRole("status").getByText("입장 가능").waitFor({ timeout: 5000 });

  const state = await api(server.baseUrl, "/api/state");
  const ticketId = JSON.parse(qrPayload).ticketId;
  const admitted = state.data.tickets.find((item) => item.id === ticketId);
  assert.equal(admitted.status, "ADMITTED");

  // Reload: the gate token persists (localStorage) so the scanner shell
  // shows immediately, no re-registration needed.
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "스캔 시작" }).waitFor({ timeout: 5000 });
  await page.getByText("정문 A").waitFor({ timeout: 5000 });
});

test("gate page: an invalid gate token is rejected with the server's error, not a silent failure", async (t) => {
  const server = await startAttestedServer(t);
  const qrPayload = await issueAdmissionQrPayload(server);

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  t.after(() => page.close());

  await page.goto(`${server.baseUrl}/gate`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("관리자 화면에서 발급된 토큰을 붙여넣으세요").fill("not-a-real-gate-token");
  await page.getByRole("button", { name: "이 기기 등록하기" }).click();
  await page.getByRole("button", { name: "스캔 시작" }).waitFor({ timeout: 5000 });

  await page.getByText("카메라 대신 QR 값 직접 입력").click();
  await page.locator("textarea").fill(qrPayload);
  await page.getByRole("button", { name: "확인" }).click();

  await page.getByRole("status").getByText("유효하지 않은 게이트 세션입니다.").waitFor({ timeout: 5000 });
});

test("gate page: a scan made while offline is queued, then confirmed automatically once back online", async (t) => {
  const server = await startAttestedServer(t);
  const issued = await adminApi(server, "/api/admin/gate-sessions", { gateLabel: "정문 B" });
  const qrPayload = await issueAdmissionQrPayload(server);

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  t.after(() => context.close());
  const page = await context.newPage();

  await page.goto(`${server.baseUrl}/gate`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("관리자 화면에서 발급된 토큰을 붙여넣으세요").fill(issued.data.token);
  await page.getByRole("button", { name: "이 기기 등록하기" }).click();
  await page.getByRole("button", { name: "스캔 시작" }).waitFor({ timeout: 5000 });

  await context.setOffline(true);
  await page.getByText("오프라인").waitFor({ timeout: 5000 });

  await page.getByText("카메라 대신 QR 값 직접 입력").click();
  await page.locator("textarea").fill(qrPayload);
  await page.getByRole("button", { name: "확인" }).click();
  await page.getByRole("status").getByText("오프라인 상태").waitFor({ timeout: 5000 });
  await page.getByText("대기열 1건").waitFor({ timeout: 5000 });

  // While still offline, the ticket must not have been admitted server-side -
  // queuing is a client-local holding pattern, not a bypass.
  const stillOnSale = await api(server.baseUrl, "/api/state");
  const ticketId = JSON.parse(qrPayload).ticketId;
  assert.notEqual(stillOnSale.data.tickets.find((item) => item.id === ticketId).status, "ADMITTED");

  await context.setOffline(false);
  await page.getByText("온라인", { exact: true }).waitFor({ timeout: 5000 });
  await page.getByText("대기열 1건").waitFor({ state: "hidden", timeout: 5000 });

  const admittedAfterReconnect = await api(server.baseUrl, "/api/state");
  assert.equal(admittedAfterReconnect.data.tickets.find((item) => item.id === ticketId).status, "ADMITTED");
});
