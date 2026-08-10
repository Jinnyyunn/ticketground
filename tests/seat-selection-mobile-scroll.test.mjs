import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

// The seat map is now the only selection surface. These tests exercise real
// pointer coordinates, the horizontally scrolled edge, and keyboard input so
// the visual markers cannot regress into decorative or unreliable controls.

const apiSeat = (id, displayCode, x, available = true) => ({
  id,
  label: displayCode,
  displayCode,
  zoneId: "zone_r",
  zoneName: "R석",
  price: 165000,
  status: available ? "ON_SALE" : "SOLD",
  available,
  mapPosition: { x, y: 50, width: 5, height: 5, rotate: 0, shape: "actual-map" },
});

const seatMapEnvelope = (seats) => ({
  ok: true,
  data: {
    event: { id: "event_ca5eae7ab951", title: "IU 2026 WORLD TOUR", venueId: "venue_jamsil", venue: "잠실종합운동장" },
    map: { title: "QA 좌석도", image: "/assets/generic-arena-floor.svg", description: "QA" },
    zones: [{ id: "zone_r", name: "R석", price: 165000, available: seats.filter((seat) => seat.available).length }],
    seats,
  },
});

async function openSeatStep(page, baseUrl) {
  await page.goto(`${baseUrl}/booking/iu-world-tour`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "9월 12일" }).click();
  await page.getByRole("button", { name: "19:00" }).click();
  await page.getByRole("button", { name: "1매" }).click();
  await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();
}

test("mobile selects tickets directly from the seat map without a duplicate list", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/booking/iu-world-tour`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "9월 12일" }).click();
  await page.getByRole("button", { name: "19:00" }).click();
  await page.getByRole("button", { name: "1매" }).click();
  await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();
  const seat = page.locator("[data-seat-map-seat]").first();
  await seat.waitFor({ timeout: 10000 });
  assert.equal(await page.getByRole("heading", { name: "실제 구매 가능한 티켓 선택" }).count(), 0);
  assert.equal((await seat.textContent())?.trim(), "01");
  await page.getByLabel("구역 범례").getByText(/VIP석 · 198,000원/).waitFor();
  await seat.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  const seatBox = await seat.boundingBox();
  assert.ok(seatBox);
  assert.ok(seatBox.width >= 24 && seatBox.height >= 24, `seat touch target was ${seatBox.width}x${seatBox.height}`);
  await page.touchscreen.tap(seatBox.x + seatBox.width / 2, seatBox.y + seatBox.height / 2);
  assert.equal(await seat.getAttribute("aria-pressed"), "true");

  const scrollRegion = page.locator("[data-seat-map-scroll]");
  await scrollRegion.waitFor();
  const describedBy = await scrollRegion.getAttribute("aria-describedby");
  assert.ok(describedBy);
  await page.locator(`#${describedBy}`).filter({ hasText: "좌우로 밀어" }).waitFor();
  const mapHelper = page.getByText(/이 지도는 구역별 대략적인 위치를 보여주는 개략도/);
  assert.equal(await mapHelper.evaluate((element) => getComputedStyle(element).wordBreak), "keep-all");
  await seat.click();
  assert.equal(await seat.getAttribute("aria-pressed"), "false");

  const seatIds = await page.locator("[data-seat-map-seat]").evaluateAll((markers) =>
    markers.map((marker) => marker.getAttribute("data-seat-map-seat")).filter(Boolean),
  );
  assert.equal(seatIds.length, 124, "every available ticket should remain selectable after removing the list");
  for (const seatId of seatIds) {
    const target = page.locator(`[data-seat-map-seat="${seatId}"]`);
    await target.scrollIntoViewIfNeeded();
    const targetBox = await target.boundingBox();
    assert.ok(targetBox);
    const center = {
      x: targetBox.x + targetBox.width / 2,
      y: targetBox.y + targetBox.height / 2,
    };
    const hitSeatId = await page.evaluate(({ x, y }) =>
      document.elementFromPoint(x, y)?.closest("[data-seat-map-seat]")?.getAttribute("data-seat-map-seat"),
    center);
    assert.equal(hitSeatId, seatId, `${seatId} center was covered by ${hitSeatId}`);
    await page.touchscreen.tap(center.x, center.y);
    await page.waitForFunction((id) =>
      document.querySelector(`[data-seat-map-seat="${id}"]`)?.getAttribute("aria-pressed") === "true",
    seatId, { timeout: 1000 });
    assert.equal(await target.getAttribute("aria-pressed"), "true", `${seatId} did not become selected`);
  }
});

test("tablet selects tickets directly from the seat map without a duplicate list", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  // 820px: a common iPad portrait width, and >= the sm breakpoint (640px)
  // but < lg (1024px) - the exact range the "below lg" cutoff affects that
  // isn't covered by the 390px mobile / 1293px desktop cases above.
  const page = await browser.newPage({ viewport: { width: 820, height: 1180 }, isMobile: true });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/booking/iu-world-tour`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "9월 12일" }).click();
  await page.getByRole("button", { name: "19:00" }).click();
  await page.getByRole("button", { name: "1매" }).click();
  await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();
  const seat = page.locator("[data-seat-map-seat]").first();
  await seat.waitFor({ timeout: 10000 });
  assert.equal(await page.getByRole("heading", { name: "실제 구매 가능한 티켓 선택" }).count(), 0);
  await seat.click();
  assert.equal(await seat.getAttribute("aria-pressed"), "true");
});

test("desktop selects tickets directly from the seat map without a duplicate list", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 } });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/booking/iu-world-tour`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "9월 12일" }).click();
  await page.getByRole("button", { name: "19:00" }).click();
  await page.getByRole("button", { name: "1매" }).click();
  await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();
  const seat = page.locator("[data-seat-map-seat]").first();
  await seat.waitFor({ timeout: 10000 });
  assert.equal(await page.getByRole("heading", { name: "실제 구매 가능한 티켓 선택" }).count(), 0);
  await seat.click();
  assert.equal(await seat.getAttribute("aria-pressed"), "true");
});

test("venue seat map markers are the only selectable ticket surface", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 } });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/booking/iu-world-tour`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "9월 12일" }).click();
  await page.getByRole("button", { name: "19:00" }).click();
  await page.getByRole("button", { name: "1매" }).click();
  await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();

  const marker = page.locator("[data-seat-map-seat]").first();
  await marker.waitFor({ timeout: 10000 });
  assert.equal(await marker.evaluate((el) => el.tagName), "BUTTON");
  assert.equal(await page.getByRole("heading", { name: "실제 구매 가능한 티켓 선택" }).count(), 0);
  await marker.focus();
  await page.keyboard.press("Enter");
  assert.equal(await marker.getAttribute("aria-pressed"), "true");
  await page.getByRole("link", { name: "결제하기", exact: true }).waitFor({ timeout: 5000 });
});

test("published charts keep sold-seat spacing, visible labels, and reliable mobile scrolling", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  t.after(() => page.close());

  const backendSeats = [
    apiSeat("sold-ticket", "R-01", 10, false),
    apiSeat("open-ticket-1", "R-02", 20),
    apiSeat("open-ticket-2", "R-03", 30),
  ];
  const chartSeats = backendSeats.map((seat, index) => ({
    id: `layout-${index + 1}`,
    label: `unmatched-${index + 1}`,
    displayLabel: `unmatched-${index + 1}`,
    tier: "R",
    price: 165000,
    sold: false,
    x: 10 + index * 8,
    y: 20,
    objectId: "dense-row",
    objectType: "row",
  }));
  await page.route("**/api/seat-map?**", (route) => route.fulfill({ json: seatMapEnvelope(backendSeats) }));
  await page.route("**/api/seat-charts/for-show/iu-world-tour?**", (route) => route.fulfill({
    json: {
      ok: true,
      source: "published",
      chart: null,
      record: { id: "dense-chart", name: "조밀 좌석 QA", boundShowSlugs: ["iu-world-tour"] },
      inventory: { seats: chartSeats, bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 } },
    },
  }));

  await openSeatStep(page, baseUrl);
  await page.getByText("게시 배치도 · 조밀 좌석 QA").waitFor();
  assert.equal(await page.locator('[data-seat-map-seat="sold-ticket"]').count(), 0);
  const firstOpen = page.locator('[data-seat-map-seat="open-ticket-1"]');
  await firstOpen.waitFor();
  assert.equal((await firstOpen.textContent())?.trim(), "02");
  const left = Number.parseFloat((await firstOpen.getAttribute("style"))?.match(/left:\s*([\d.]+)%/)?.[1] ?? "NaN");
  assert.ok(Math.abs(left - ((18 + 24) / 148) * 100) < 0.01, `open seat shifted to ${left}%`);
  const scrollState = await page.locator("[data-chart-seat-scroll]").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    maxHeight: getComputedStyle(element).maxHeight,
  }));
  assert.equal(scrollState.maxHeight, "none");
  assert.equal(scrollState.scrollHeight, scrollState.clientHeight);
  await firstOpen.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  const box = await firstOpen.boundingBox();
  assert.ok(box);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  assert.equal(await firstOpen.getAttribute("aria-pressed"), "true");
});

test("venue fallback keeps available markers anchored to the full seat layout", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  t.after(() => page.close());

  const backendSeats = [
    apiSeat("open-left", "R-01", 10),
    apiSeat("sold-middle", "R-02", 20, false),
    apiSeat("open-middle", "R-03", 30),
    apiSeat("open-right", "R-04", 40),
  ];
  await page.route("**/api/seat-map?**", (route) => route.fulfill({ json: seatMapEnvelope(backendSeats) }));
  await page.route("**/api/seat-charts/for-show/iu-world-tour?**", (route) => route.fulfill({
    json: { ok: true, source: "fallback", chart: null, record: null, inventory: null },
  }));

  await openSeatStep(page, baseUrl);
  const anchoredSeat = page.locator('[data-venue-seat-marker="open-middle"]');
  await anchoredSeat.waitFor();
  assert.equal(await page.locator('[data-venue-seat-marker="sold-middle"]').count(), 0);
  const left = Number.parseFloat((await anchoredSeat.getAttribute("style"))?.match(/left:\s*([\d.]+)%/)?.[1] ?? "NaN");
  assert.ok(Math.abs(left - 64) < 0.01, `remaining seat moved to ${left}%`);
});
