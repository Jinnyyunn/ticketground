import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("cancel request button follows required reason state", async (t) => {
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
  assert.equal(await submitButton.isDisabled(), false, "reason selection enables the request button");

  const refundConfirmation = page.getByLabel(/취소 수수료와 환불 예정 금액을 확인했습니다/);
  assert.equal(await refundConfirmation.isChecked(), false, "refund confirmation is optional for enabling");

  await refundConfirmation.check();
  assert.equal(await submitButton.isDisabled(), false, "checking optional confirmation keeps the button enabled");

  await refundConfirmation.uncheck();
  assert.equal(await submitButton.isDisabled(), false, "unchecking optional confirmation does not disable the button");

  await page.getByLabel("좌석 변경 후 재예매").check();
  await page.getByText("선택 사유: 좌석 변경 후 재예매").waitFor();
  assert.equal(await submitButton.isDisabled(), false, "changing reason keeps the button enabled");

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
