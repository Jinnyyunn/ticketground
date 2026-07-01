import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("booking pages fetch each show's mapped backend event", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());

  await assertBookingEventSource(page, baseUrl, {
    slug: "les-miserables",
    eventId: "event_musical_001",
    sourceTitle: "Midnight Sonata"
  });
  await assertBookingEventSource(page, baseUrl, {
    slug: "palette-festival",
    eventId: "event_festival_001",
    sourceTitle: "Tig Summer Beat Festival"
  });
});

test("checkout fallback buys from the current show's mapped backend event", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());

  await checkoutWithoutSelectedTicket(page, baseUrl, "palette-festival");
});

async function assertBookingEventSource(page, baseUrl, { slug, eventId, sourceTitle }) {
  const seatMapResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/seat-map";
  });

  await page.goto(`${baseUrl}/booking/${slug}`, { waitUntil: "domcontentloaded" });

  const response = await seatMapResponse;
  const requestUrl = new URL(response.url());
  const payload = await response.json();
  assert.equal(requestUrl.searchParams.get("eventId"), eventId, `${slug} should fetch its mapped backend event`);
  assert.equal(payload.data.event.title, sourceTitle);
  await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();
  await page.getByText(sourceTitle).waitFor({ timeout: 5000 });
}

async function checkoutWithoutSelectedTicket(page, baseUrl, slug) {
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const statePayload = await stateResponse.json();
  await page.goto(`${baseUrl}/checkout/${slug}?date=2026.07.04&time=12%3A00&seats=&base=121000&fee=2000&total=123000&count=1`, {
    waitUntil: "networkidle"
  });
  const purchaseRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/tickets/buy";
  });
  const purchaseResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/tickets/buy";
  });

  await page.getByLabel(/결제 조건/).check();
  await page.getByRole("button", { name: "결제 완료" }).click();

  const request = await purchaseRequest;
  const response = await purchaseResponse;
  const requestBody = request.postDataJSON();
  const selectedTicket = statePayload.data.tickets.find((ticket) => ticket.id === requestBody.ticketId);
  assert.ok(selectedTicket, `checkout selected unknown ticket ${requestBody.ticketId}`);
  assert.equal(selectedTicket.eventId, "event_festival_001");

  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "EVENT_NOT_ON_SALE");
  return selectedTicket;
}
