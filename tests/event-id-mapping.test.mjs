import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer, verifyIdentity } from "./backend-test-utils.mjs";
import { installPublishedChartFixture } from "./seat-chart-browser-fixture.mjs";

test("booking pages fetch each show's mapped backend event", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());
  await installPublishedChartFixture(page, baseUrl, ["les-miserables", "palette-festival", "hadestown"]);

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

test("checkout without a selected ticket blocks payment instead of guessing the current show's event", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());

  await assertCheckoutBlocksWithoutSelectedTicket(page, baseUrl, "palette-festival");
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

async function assertCheckoutBlocksWithoutSelectedTicket(page, baseUrl, slug) {
  await verifyIdentity(baseUrl, "user_fan_a", "010-9000-0001");
  await page.addInitScript(() => {
    window.localStorage.setItem("ticketground:session-user-id", "user_fan_a");
  });
  const catalogPayload = await (await fetch(`${baseUrl}/api/catalog`)).json();
  const event = catalogPayload.data.events.find((item) => item.slug === slug);
  const performance = event?.dates.find((item) => item.startsAt.startsWith("2026-07-05T12:00"));
  assert.ok(performance);

  // A purchase request must never fire when the checkout page lost its ticketId — this used to
  // silently fall back to a random ON_SALE ticket for the show instead of blocking payment.
  let purchaseRequested = false;
  await page.route("**/api/tickets/buy", (route) => {
    purchaseRequested = true;
    return route.continue();
  });

  await page.goto(`${baseUrl}/checkout/${slug}?date=2026.07.05&time=12%3A00&seats=&base=121000&fee=2000&total=123000&count=1`, {
    waitUntil: "networkidle"
  });

  const payButton = page.getByRole("button", { name: "결제 완료" });
  await payButton.waitFor({ timeout: 5000 });
  assert.equal(await payButton.isDisabled(), true);
  await page.getByText("선택된 좌석 정보를 확인할 수 없습니다. 좌석 선택 화면으로 돌아가 다시 선택해주세요.").waitFor({ timeout: 5000 });
  assert.equal(purchaseRequested, false, "checkout must not silently substitute a ticket and pay for it");
}
