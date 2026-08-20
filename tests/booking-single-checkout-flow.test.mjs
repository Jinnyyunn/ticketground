import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";
import { installPublishedChartFixture } from "./seat-chart-browser-fixture.mjs";

test("booking seat selection goes to the single checkout page without an intermediate payment panel", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());
  await installPublishedChartFixture(page, baseUrl, ["les-miserables"]);

  await page.goto(`${baseUrl}/booking/les-miserables?date=2026.05.13&time=19%3A30`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();
  await page.getByRole("heading", { name: "좌석 선택" }).waitFor({ timeout: 5000 });
  assert.equal(await page.getByRole("heading", { name: "결제수단" }).count(), 0);
  const seatMapSeat = page.locator("[data-seat-map-seat]").first();
  await seatMapSeat.waitFor({ timeout: 5000 });
  assert.equal(await page.locator("[data-static-seat-map]").count(), 0);
  assert.equal(await page.getByRole("heading", { name: "실제 구매 가능한 티켓 선택" }).count(), 0);
  assert.equal(await page.locator("[data-realtime-seat-map]").count(), 1);

  const paymentButton = page.getByRole("link", { name: "결제하기", exact: true });
  await seatMapSeat.click();
  assert.equal(await seatMapSeat.getAttribute("aria-pressed"), "true");
  await paymentButton.waitFor({ timeout: 5000 });
  await paymentButton.click();

  await page.waitForURL(/\/checkout\/les-miserables/, { timeout: 5000 });
  await page.getByRole("heading", { name: "결제 정보 확인", level: 1 }).waitFor({ timeout: 5000 });
  await page.getByRole("heading", { name: "예매 정보", level: 2 }).waitFor({ timeout: 5000 });
  assert.equal(await page.getByRole("heading", { name: "결제수단", level: 2 }).count(), 1);
});

test("booking fails closed when the selected performance seat map is unavailable", async (t) => {
  // Given: the selected performance seat-map request fails.
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());
  await page.route("**/api/seat-map?**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ ok: false, error: { code: "SEAT_MAP_UNAVAILABLE", message: "unavailable" } }),
  }));

  await installPublishedChartFixture(page, baseUrl, ["les-miserables"]);

  // When: the selected performance inventory cannot be loaded.
  await page.goto(`${baseUrl}/booking/les-miserables?date=2026.05.13&time=19%3A30`, { waitUntil: "networkidle" });

  // Then: entry fails closed before a synthetic seat screen can open.
  assert.equal(await page.getByRole("button", { name: "좌석 선택으로 이동" }).isDisabled(), true);
  assert.equal(await page.locator("[data-static-seat-map]").count(), 0);
  assert.equal(await page.getByRole("link", { name: "결제하기", exact: true }).count(), 0);
});

test("seat map keeps two selected seats and replaces the oldest seat when quantity is two", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());
  await installPublishedChartFixture(page, baseUrl, ["les-miserables"]);

  const isSelected = async (seatButton) => (await seatButton.getAttribute("aria-pressed")) === "true";

  // Given: the booking page is on the realtime backend seat picker with quantity set to two.
  await page.goto(`${baseUrl}/booking/les-miserables?date=2026.05.13&time=19%3A30`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "2매" }).click();
  await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();
  await page.locator("[data-seat-map-seat]").first().waitFor({ timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-seat-map-seat]").length >= 3);

  const firstSeat = page.locator("[data-seat-map-seat]").nth(0);
  const secondSeat = page.locator("[data-seat-map-seat]").nth(1);
  const thirdSeat = page.locator("[data-seat-map-seat]").nth(2);

  // When: two different backend seats are selected.
  await firstSeat.click();
  await secondSeat.click();

  // Then: both seats remain selected and the summary reflects two of two seats.
  assert.equal(await isSelected(firstSeat), true);
  assert.equal(await isSelected(secondSeat), true);
  await page.getByText("2/2매", { exact: true }).waitFor({ timeout: 5000 });

  // When: a third backend seat is selected while already at the two-seat limit.
  await thirdSeat.click();

  // Then: the oldest selected seat is released and the second plus third seats stay selected.
  assert.equal(await isSelected(firstSeat), false);
  assert.equal(await isSelected(secondSeat), true);
  assert.equal(await isSelected(thirdSeat), true);
  await page.getByText("2/2매", { exact: true }).waitFor({ timeout: 5000 });
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
  const ticket = statePayload.data.tickets.find((item) => item.eventId === "event_c945b7fa842c" && item.status === "ON_SALE");
  assert.ok(ticket, "seeded les-miserables ticket exists");

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

test("checkout blocks payment instead of silently substituting a seat when ticketId is missing", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());

  // Given: a checkout URL that lost its ticketId (e.g. corrupted link, back-navigation) but
  // otherwise looks like a normal checkout deep link.
  const missingTicketUrl = new URL(`${baseUrl}/checkout/les-miserables`);
  missingTicketUrl.searchParams.set("date", "2026.05.13");
  missingTicketUrl.searchParams.set("time", "19:30");

  // When: the checkout page loads without a ticketId.
  await page.goto(missingTicketUrl.toString(), { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "결제 정보 확인", level: 1 }).waitFor({ timeout: 5000 });

  // Then: the payment button stays disabled and the page tells the user to reselect a seat,
  // instead of silently buying whatever seat happens to still be on sale.
  const payButton = page.getByRole("button", { name: "결제 완료" });
  await payButton.waitFor({ timeout: 5000 });
  assert.equal(await payButton.isDisabled(), true);
  await page.getByText("선택된 좌석 정보를 확인할 수 없습니다. 좌석 선택 화면으로 돌아가 다시 선택해주세요.").waitFor({ timeout: 5000 });
});
