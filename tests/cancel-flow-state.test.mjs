import test from "node:test";
import assert from "node:assert/strict";
import { networkInterfaces } from "node:os";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("cancel request button requires reason and refund agreement", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/cancel`, { waitUntil: "networkidle" });

  const submitButton = page.getByRole("button", { name: /mock 취소 요청 완료/ });
  assert.equal(await submitButton.isDisabled(), true, "button starts disabled when no reason is selected");

  await page.getByLabel("일정 변경").check();
  await page.getByText("선택 사유: 일정 변경").waitFor();
  assert.equal(await submitButton.isDisabled(), true, "reason alone keeps the request button disabled");

  const refundConfirmation = page.getByLabel(/취소 수수료와 환불 예정 금액을 확인했습니다/);
  assert.equal(await refundConfirmation.isChecked(), false, "refund confirmation starts unchecked");

  await refundConfirmation.check();
  assert.equal(await submitButton.isDisabled(), false, "reason and refund confirmation enable the button");

  await refundConfirmation.uncheck();
  assert.equal(await submitButton.isDisabled(), true, "unchecking refund confirmation disables the button again");

  await page.getByLabel("좌석 변경 후 재예매").check();
  await page.getByText("선택 사유: 좌석 변경 후 재예매").waitFor();
  assert.equal(await submitButton.isDisabled(), true, "changing reason still requires refund confirmation");
  await refundConfirmation.check();
  assert.equal(await submitButton.isDisabled(), false, "checking refund confirmation after changing reason enables the button");

  await submitButton.click();
  await page.getByRole("heading", { name: "취소·환불 요청이 기록되었습니다" }).waitFor();

  await page.goto(`${baseUrl}/cancel`, { waitUntil: "networkidle" });
  await page.getByText("선택 사유: 아직 선택하지 않음").waitFor();
  assert.equal(await page.getByRole("button", { name: /mock 취소 요청 완료/ }).isDisabled(), true, "fresh cancel page resets to disabled");

  const desktopPage = await browser.newPage({ viewport: { width: 1293, height: 1043 } });
  t.after(() => desktopPage.close());
  await desktopPage.goto(`${baseUrl}/cancel`, { waitUntil: "networkidle" });
  const floatingInquiryBox = await desktopPage.locator('a[aria-label="1:1 문의"]').boundingBox();
  const refundAmountBox = await desktopPage.locator("aside").getByText("346,000원").last().boundingBox();
  assert.ok(floatingInquiryBox, "floating inquiry link is visible on desktop");
  assert.ok(refundAmountBox, "refund amount is visible on desktop");
  assert.equal(overlaps(floatingInquiryBox, refundAmountBox), false, "floating inquiry link does not cover refund amount");
});

test("cancel page uses the selected reservation from the query string", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/cancel?reservation=CTI-26007169-001`, { waitUntil: "networkidle" });

  await page.getByRole("heading", { name: "베를린필 내한공연" }).waitFor();
  await page.getByText("예술의전당 콘서트홀").waitFor();
  await page.getByText("VIP석 A열 12번").waitFor();
  assert.equal(await page.getByRole("heading", { name: "레미제라블 40주년" }).count(), 0, "different reservation cancel page must not fall back to Les Miserables");
});

test("cancel page accepts reservationId as a legacy query alias", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/cancel?reservationId=CTI-26007169-001`, { waitUntil: "networkidle" });

  await page.getByRole("heading", { name: "베를린필 내한공연" }).waitFor();
  await page.getByText("예술의전당 콘서트홀").waitFor();
});

test("cancel request button hydrates through the Tailscale dev origin", async (t) => {
  const tailscaleHost = tailscaleIpv4Address();
  if (!tailscaleHost) t.skip("Tailscale IPv4 address is not available on this machine");

  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  t.after(() => page.close());

  const tailscaleBaseUrl = baseUrl.replace("127.0.0.1", tailscaleHost);
  await page.goto(`${tailscaleBaseUrl}/cancel?reservation=CTI-26007169-001`, { waitUntil: "networkidle" });

  const submitButton = page.getByRole("button", { name: /mock 취소 요청 완료/ });
  await page.getByLabel("일정 변경").check();
  await page.getByLabel(/취소 수수료와 환불 예정 금액을 확인했습니다/).check();
  await page.getByText("선택 사유: 일정 변경").waitFor();

  assert.equal(await submitButton.isDisabled(), false, "Tailscale dev origin must hydrate the cancel form and enable the submit button");
});

test("mypage cancel links carry the selected reservation id", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/mypage`, { waitUntil: "networkidle" });

  const berlinReservation = page.locator("article").filter({ hasText: "베를린필 내한공연" }).first();
  await berlinReservation.getByRole("heading", { name: "베를린필 내한공연" }).waitFor();
  assert.equal(
    await berlinReservation.getByRole("link", { name: "취소" }).getAttribute("href"),
    "/cancel?reservation=CTI-26007169-001",
    "cancel link should preserve the reservation id that the user selected",
  );
});

test("cancel request updates mypage cancel history in demo state", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/mypage`, { waitUntil: "networkidle" });
  assert.equal(await page.locator('[data-account-panel] a[href="/mypage#cancel-history"] strong').textContent(), "0", "cancel counter starts at zero");
  assert.equal(await page.locator("[data-cancel-history-row]").count(), 0, "cancel history starts empty");

  await page.goto(`${baseUrl}/cancel`, { waitUntil: "networkidle" });
  await page.getByLabel("일정 변경").check();
  await page.getByLabel(/취소 수수료와 환불 예정 금액을 확인했습니다/).check();
  await page.getByRole("button", { name: /mock 취소 요청 완료/ }).click();
  await page.getByRole("heading", { name: "취소·환불 요청이 기록되었습니다" }).waitFor();
  await page.getByRole("link", { name: "마이페이지로 이동" }).click();

  await page.getByRole("heading", { name: "취소 내역" }).waitFor();
  assert.equal(await page.locator('[data-account-panel] a[href="/mypage#cancel-history"] strong').textContent(), "1", "cancel counter reflects completed request");
  assert.equal(await page.locator("[data-cancel-history-row]").count(), 1, "cancel history shows the completed request");
  const cancelHistory = page.locator("#cancel-history");
  await cancelHistory.getByRole("heading", { name: "레미제라블 40주년" }).waitFor();
  await cancelHistory.getByText("일정 변경").waitFor();
});

function overlaps(first, second) {
  return first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y;
}

function tailscaleIpv4Address() {
  for (const items of Object.values(networkInterfaces())) {
    for (const item of items || []) {
      if (item.family === "IPv4" && !item.internal && isTailscaleIpv4Address(item.address)) return item.address;
    }
  }
  return "";
}

function isTailscaleIpv4Address(address) {
  const octets = address.split(".").map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  return octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127;
}
