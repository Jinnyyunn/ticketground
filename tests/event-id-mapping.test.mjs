import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer, verifyIdentity } from "./backend-test-utils.mjs";

test("booking pages fetch each show's mapped backend event", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());

  await assertBookingEventSource(page, baseUrl, {
    slug: "les-miserables",
    eventId: "event_c945b7fa842c",
    sourceTitle: "레미제라블 40주년 (Les Miserables 40th Anniversary)"
  });
  await assertBookingEventSource(page, baseUrl, {
    slug: "palette-festival",
    eventId: "event_d91d3c4c539a",
    sourceTitle: "2026 Palette Festival"
  });
  await assertBookingEventSource(page, baseUrl, {
    slug: "hadestown",
    eventId: "event_521ce6187445",
    sourceTitle: "하데스타운"
  });
});

test("checkout fallback uses the current show's mapped backend event", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());

  await checkoutWithoutSelectedTicket(page, baseUrl, "palette-festival");
});

test("booking requests the seat map for the selected performance", async (t) => {
  // Given: a show with more than one performance.
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());
  const catalog = await (await fetch(`${baseUrl}/api/catalog`)).json();
  const event = catalog.data.events.find((item) => item.slug === "les-miserables");
  const performance = event?.dates.find((item) => item.startsAt.startsWith("2026-05-14T19:30"));
  assert.ok(performance);
  const seatMapRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/seat-map");

  // When: the booking page opens the chosen date and time.
  await page.goto(`${baseUrl}/booking/les-miserables?date=2026.05.14&time=19%3A30`, { waitUntil: "domcontentloaded" });

  // Then: the seat-map request is scoped to that exact backend performance.
  const requestUrl = new URL((await seatMapRequest).url());
  assert.equal(requestUrl.searchParams.get("performanceDateId"), performance.id);
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
  await page.getByText(sourceTitle).first().waitFor({ timeout: 5000 });
}

async function checkoutWithoutSelectedTicket(page, baseUrl, slug) {
  await verifyIdentity(baseUrl, "user_fan_a", "010-9000-0001");
  await page.addInitScript(() => {
    window.localStorage.setItem("ticketground:session-user-id", "user_fan_a");
  });
  const stateResponse = await fetch(`${baseUrl}/api/state`);
  const statePayload = await stateResponse.json();
  const catalogPayload = await (await fetch(`${baseUrl}/api/catalog`)).json();
  const event = catalogPayload.data.events.find((item) => item.slug === slug);
  const performance = event?.dates.find((item) => item.startsAt.startsWith("2026-07-05T12:00"));
  assert.ok(performance);
  await page.goto(`${baseUrl}/checkout/${slug}?date=2026.07.05&time=12%3A00&seats=&base=121000&fee=2000&total=123000&count=1`, {
    waitUntil: "networkidle"
  });
  const purchaseRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/payments/bootpay/purchase";
  });
  const purchaseResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/payments/bootpay/purchase";
  });

  await page.getByLabel(/결제 조건/).check();
  await page.getByRole("button", { name: "결제 완료" }).click();

  const request = await purchaseRequest;
  const response = await purchaseResponse;
  const requestBody = request.postDataJSON();
  const selectedTicket = statePayload.data.tickets.find((ticket) => ticket.id === requestBody.ticketId);
  assert.ok(selectedTicket, `checkout selected unknown ticket ${requestBody.ticketId}`);
  assert.equal(selectedTicket.eventId, "event_d91d3c4c539a");
  assert.equal(selectedTicket.performanceDateId, performance.id);

  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.data.event.id, "event_d91d3c4c539a");
  return selectedTicket;
}
