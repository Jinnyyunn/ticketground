import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("booking seat selection goes to the single checkout page without an intermediate payment panel", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/booking/les-miserables?date=2026.05.13&time=19%3A30`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();
  await page.getByRole("heading", { name: "좌석 선택" }).waitFor({ timeout: 5000 });
  assert.equal(await page.getByRole("heading", { name: "결제수단" }).count(), 0);

  const paymentButton = page.getByRole("link", { name: "결제하기", exact: true });
  await paymentButton.waitFor({ timeout: 5000 });
  await paymentButton.click();

  await page.waitForURL(/\/checkout\/les-miserables/, { timeout: 5000 });
  await page.getByRole("heading", { name: "결제 정보 확인", level: 1 }).waitFor({ timeout: 5000 });
  await page.getByRole("heading", { name: "예매 정보", level: 2 }).waitFor({ timeout: 5000 });
  assert.equal(await page.getByRole("heading", { name: "결제수단", level: 2 }).count(), 1);
});
