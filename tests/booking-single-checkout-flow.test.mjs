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
  await page.locator("[data-backend-seat]").first().waitFor({ timeout: 5000 });
  assert.equal(await page.locator("[data-static-seat-map]").count(), 0);

  const paymentButton = page.getByRole("link", { name: "결제하기", exact: true });
  await page.locator("[data-backend-seat]").first().click();
  await paymentButton.waitFor({ timeout: 5000 });
  await paymentButton.click();

  await page.waitForURL(/\/checkout\/les-miserables/, { timeout: 5000 });
  await page.getByRole("heading", { name: "결제 정보 확인", level: 1 }).waitFor({ timeout: 5000 });
  await page.getByRole("heading", { name: "예매 정보", level: 2 }).waitFor({ timeout: 5000 });
  assert.equal(await page.getByRole("heading", { name: "결제수단", level: 2 }).count(), 1);
});

test("checkout ignores tampered URL amount parameters for a selected backend ticket", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());

  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const statePayload = await stateResponse.json();
  assert.equal(statePayload.ok, true);
  const ticket = statePayload.data.tickets.find((item) => item.eventId === "event_musical_001" && item.status === "ON_SALE");
  assert.ok(ticket, "seeded musical ticket exists");

  const tamperedUrl = new URL(`${baseUrl}/checkout/les-miserables`);
  tamperedUrl.searchParams.set("date", "2026.05.13");
  tamperedUrl.searchParams.set("time", "19:30");
  tamperedUrl.searchParams.set("seats", ticket.seatLabel);
  tamperedUrl.searchParams.set("count", "1");
  tamperedUrl.searchParams.set("ticketId", ticket.id);
  tamperedUrl.searchParams.set("base", "1");
  tamperedUrl.searchParams.set("fee", "1");
  tamperedUrl.searchParams.set("total", "2");

  await page.goto(tamperedUrl.toString(), { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "결제 정보 확인", level: 1 }).waitFor({ timeout: 5000 });
  await page.getByText(`${ticket.faceValue.toLocaleString("ko-KR")}원`).first().waitFor({ timeout: 5000 });
  const bodyText = await page.locator("body").innerText();
  assert.doesNotMatch(bodyText, /좌석 금액\s*1원/);
  assert.doesNotMatch(bodyText, /총 결제금액\s*2원/);
});
