import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";
import { installPublishedChartFixture, publishedChartEnvelope } from "./seat-chart-browser-fixture.mjs";

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
  await installPublishedChartFixture(page, baseUrl, ["iu-world-tour"]);

  await page.goto(`${baseUrl}/booking/iu-world-tour`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "9월 12일" }).click();
  await page.getByRole("button", { name: "19:00" }).click();
  await page.getByRole("button", { name: "1매" }).click();
  await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();
  const seat = page.locator("[data-seat-map-seat]").first();
  await seat.waitFor({ timeout: 10000 });
  assert.equal(await page.getByRole("heading", { name: "실제 구매 가능한 티켓 선택" }).count(), 0);
  assert.equal((await seat.textContent())?.trim(), "01");
  assert.match(await seat.getAttribute("aria-label"), /· [\d,]+원$/);
  await seat.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  const seatBox = await seat.boundingBox();
  assert.ok(seatBox);
  assert.ok(seatBox.width >= 24 && seatBox.height >= 24, `seat touch target was ${seatBox.width}x${seatBox.height}`);
  await page.touchscreen.tap(seatBox.x + seatBox.width / 2, seatBox.y + seatBox.height / 2);
  assert.equal(await seat.getAttribute("aria-pressed"), "true");

  const scrollRegion = page.locator("[data-chart-seat-scroll]");
  await scrollRegion.waitFor();
  const scrollMetrics = await scrollRegion.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  assert.ok(scrollMetrics.scrollWidth > scrollMetrics.clientWidth);
  assert.equal(scrollMetrics.overflowX, "auto");
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
  await installPublishedChartFixture(page, baseUrl, ["iu-world-tour"]);

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
  await installPublishedChartFixture(page, baseUrl, ["iu-world-tour"]);

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
  await installPublishedChartFixture(page, baseUrl, ["iu-world-tour"]);

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

test("variable table markers select the requested backend chair tickets as one unit", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  t.after(() => page.close());

  const backendSeats = [
    apiSeat("table-ticket-1", "T1-1", 42),
    apiSeat("table-ticket-2", "T1-2", 50),
    apiSeat("table-ticket-3", "T1-3", 58),
  ];
  await page.route("**/api/seat-map?**", (route) => route.fulfill({ json: seatMapEnvelope(backendSeats) }));
  await page.route("**/api/seat-charts/for-show/iu-world-tour?**", (route) => route.fulfill({
    json: {
      ok: true,
      source: "published",
      chart: null,
      record: { id: "table-chart", name: "가변 테이블 QA", boundVenue: { id: "venue-1", name: "예술의전당" } },
      inventory: {
        seats: [{
          id: "table-variable",
          label: "T1",
          displayLabel: "T1",
          tier: "R",
          price: 165000,
          sold: false,
          x: 50,
          y: 50,
          objectId: "table-1",
          objectType: "table",
          bookingMode: "variable",
          minOccupancy: 2,
          maxOccupancy: 3,
          memberLabels: ["T1-1", "T1-2", "T1-3"],
        }],
        bounds: { minX: 40, minY: 40, maxX: 60, maxY: 60 },
      },
    },
  }));

  await openSeatStep(page, baseUrl);
  const table = page.locator('[data-seat-map-seat="table-variable"]');
  await table.waitFor();
  await table.click();
  assert.equal(await table.getAttribute("aria-pressed"), "true");
  await page.locator("aside").getByText("2/2매", { exact: true }).waitFor();

  const checkoutHref = await page.getByRole("link", { name: "결제하기", exact: true }).getAttribute("href");
  assert.ok(checkoutHref);
  const checkout = new URL(checkoutHref, baseUrl);
  assert.equal(checkout.searchParams.get("count"), "2");
  assert.deepEqual(checkout.searchParams.get("ticketIds")?.split(","), ["table-ticket-1", "table-ticket-2"]);
});

test("whole-table markers display the exact mixed-tier total before selection", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  t.after(() => page.close());

  const backendSeats = [
    { ...apiSeat("mixed-vip", "T2-1", 46), price: 190000 },
    { ...apiSeat("mixed-r", "T2-2", 54), price: 160000 },
  ];
  await page.route("**/api/seat-map?**", (route) => route.fulfill({ json: seatMapEnvelope(backendSeats) }));
  await page.route("**/api/seat-charts/for-show/iu-world-tour?**", (route) => route.fulfill({
    json: {
      ok: true,
      source: "published",
      chart: null,
      record: { id: "mixed-table-chart", name: "혼합 등급 테이블", boundVenue: { id: "venue-1", name: "예술의전당" } },
      inventory: {
        seats: [{
          id: "mixed-table",
          label: "T2",
          displayLabel: "T2",
          tier: "VIP",
          price: 350000,
          sold: false,
          x: 50,
          y: 50,
          objectId: "table-2",
          objectType: "table",
          bookingMode: "whole",
          memberLabels: ["T2-1", "T2-2"],
          memberSeats: [{ label: "T2-1", price: 190000 }, { label: "T2-2", price: 160000 }],
        }],
        bounds: { minX: 40, minY: 40, maxX: 60, maxY: 60 },
      },
    },
  }));

  await openSeatStep(page, baseUrl);
  const table = page.locator('[data-seat-map-seat="mixed-table"]');
  await table.waitFor();
  assert.match(await table.getAttribute("aria-label"), /350,000원$/);
  await table.click();
  await page.locator("aside").getByText("350,000원", { exact: true }).waitFor();
  await page.locator("aside").getByText("2/2매", { exact: true }).waitFor();
});

test("published charts keep sold-seat spacing, visible labels, and reliable mobile scrolling", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  t.after(() => page.close());

  const backendSeats = Array.from({ length: 202 }, (_, index) => {
    const fullLabel = index === 1 ? "ORA-1" : index === 2 ? "ORB-1" : `R-${String(index + 1).padStart(3, "0")}`;
    const seat = apiSeat(
      index === 0 ? "sold-ticket" : `open-ticket-${index}`,
      index === 1 || index === 2 ? "1" : fullLabel,
      10 + index,
      index !== 0,
    );
    return { ...seat, label: fullLabel };
  });
  const chartSeats = backendSeats.map((seat, index) => ({
    id: `layout-${index + 1}`,
    label: seat.label,
    displayLabel: index === 1 ? "휠체어석" : seat.label,
    tier: "R",
    price: 165000,
    sold: false,
    x: 10 + (index % 20) * 8,
    y: 20 + Math.floor(index / 20) * 8,
    objectId: "dense-row",
    objectType: "row",
  }));
  await page.route("**/api/seat-map?**", (route) => route.fulfill({ json: seatMapEnvelope(backendSeats) }));
  await page.route("**/api/seat-charts/for-show/iu-world-tour?**", (route) => route.fulfill({
    json: {
      ok: true,
      source: "published",
      chart: null,
      record: { id: "dense-chart", name: "조밀 좌석 QA", boundVenue: { id: "venue-1", name: "예술의전당" } },
      inventory: { seats: chartSeats, bounds: { minX: 0, minY: 0, maxX: 180, maxY: 120 } },
    },
  }));

  await openSeatStep(page, baseUrl);
  await page.getByText("게시 배치도 · 조밀 좌석 QA").waitFor();
  assert.equal(await page.locator('[data-seat-map-seat="sold-ticket"]').count(), 0);
  const firstOpen = page.locator('[data-seat-map-seat="open-ticket-1"]');
  await firstOpen.waitFor();
  assert.equal((await firstOpen.textContent())?.trim(), "휠체어석");
  assert.equal((await page.locator('[data-seat-map-seat="open-ticket-2"]').textContent())?.trim(), "ORB-1");
  await firstOpen.click();
  await page.locator("aside").getByText("ORA-1", { exact: true }).waitFor();
  const left = Number.parseFloat((await firstOpen.getAttribute("style"))?.match(/left:\s*([\d.]+)%/)?.[1] ?? "NaN");
  assert.ok(Math.abs(left - ((18 + 24) / 228) * 100) < 0.01, `open seat shifted to ${left}%`);
  assert.equal(await page.locator("[data-seat-map-seat]").count(), 200);
  assert.equal((await page.locator("[data-chart-seat-page]").textContent())?.trim(), "1 / 2");
  const scrollState = await page.locator("[data-chart-seat-scroll]").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    maxHeight: getComputedStyle(element).maxHeight,
  }));
  assert.equal(scrollState.maxHeight, "none");
  assert.equal(scrollState.scrollHeight, scrollState.clientHeight);
  await page.getByRole("button", { name: "다음 좌석" }).click();
  const finalSeat = page.locator('[data-seat-map-seat="open-ticket-201"]');
  await finalSeat.waitFor();
  assert.equal(await finalSeat.evaluate((element) => document.activeElement === element), true);
  assert.equal(await page.locator("[data-seat-map-seat]").count(), 1);
  assert.equal((await finalSeat.textContent())?.trim(), "R-202");
  await finalSeat.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  const box = await finalSeat.boundingBox();
  assert.ok(box);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  assert.equal(await finalSeat.getAttribute("aria-pressed"), "true");
});

test("dense single-row published charts use page scrolling for reliable mobile taps", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  t.after(() => page.close());

  const backendSeats = Array.from({ length: 40 }, (_, index) => apiSeat(
    `dense-ticket-${index}`,
    `ORA-${index + 1}`,
    index * 0.5,
  ));
  const chartSeats = backendSeats.map((seat, index) => ({
    id: `dense-layout-${index}`,
    label: seat.displayCode,
    displayLabel: seat.displayCode,
    tier: "R",
    price: 165000,
    sold: false,
    x: index * 0.5,
    y: 20,
    objectId: "dense-short-row",
    objectType: "row",
  }));
  await page.route("**/api/seat-map?**", (route) => route.fulfill({ json: seatMapEnvelope(backendSeats) }));
  await page.route("**/api/seat-charts/for-show/iu-world-tour?**", (route) => route.fulfill({
    json: {
      ok: true,
      source: "published",
      chart: null,
      record: { id: "short-row-chart", name: "단일 조밀 행", boundVenue: { id: "venue-1", name: "예술의전당" } },
      inventory: { seats: chartSeats, bounds: { minX: 0, minY: 0, maxX: 40, maxY: 40 } },
    },
  }));

  await openSeatStep(page, baseUrl);
  const scrollState = await page.locator("[data-dense-chart-grid]").evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    maxHeight: getComputedStyle(element).maxHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  assert.equal(scrollState.maxHeight, "none");
  assert.equal(scrollState.overflowY, "visible");
  assert.equal(scrollState.scrollHeight, scrollState.clientHeight);
  assert.ok(scrollState.clientHeight < 640, `dense chart grid grew to ${scrollState.clientHeight}px`);
  const lastSeat = page.locator('[data-seat-map-seat="dense-ticket-39"]');
  await lastSeat.scrollIntoViewIfNeeded();
  const lastSeatBox = await lastSeat.boundingBox();
  assert.ok(lastSeatBox);
  await page.touchscreen.tap(lastSeatBox.x + lastSeatBox.width / 2, lastSeatBox.y + lastSeatBox.height / 2);
  assert.equal(await lastSeat.getAttribute("aria-pressed"), "true");
  await page.getByRole("link", { name: "결제하기", exact: true }).waitFor();
});

test("wide shallow published charts use the touch grid instead of a massive horizontal canvas", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  t.after(() => page.close());

  const backendSeats = Array.from({ length: 10 }, (_, index) => apiSeat(
    `wide-ticket-${index}`,
    `W-${index + 1}`,
    index * 1000,
  ));
  const chartSeats = backendSeats.map((seat, index) => ({
    id: `wide-layout-${index}`,
    label: seat.displayCode,
    displayLabel: seat.displayCode,
    tier: "R",
    price: 165000,
    sold: false,
    x: index * 1000,
    y: 20,
    objectId: "wide-row",
    objectType: "row",
  }));
  await page.route("**/api/seat-map?**", (route) => route.fulfill({ json: seatMapEnvelope(backendSeats) }));
  await page.route("**/api/seat-charts/for-show/iu-world-tour?**", (route) => route.fulfill({
    json: {
      ok: true,
      source: "published",
      chart: null,
      record: { id: "wide-chart", name: "초광폭 좌석 QA", boundVenue: { id: "venue-1", name: "예술의전당" } },
      inventory: { seats: chartSeats, bounds: { minX: 0, minY: 0, maxX: 10000, maxY: 40 } },
    },
  }));

  await openSeatStep(page, baseUrl);
  const grid = page.locator("[data-dense-chart-grid]");
  await grid.waitFor();
  assert.equal(await page.locator("[data-chart-seat-scroll] > div[style*='min-width']").count(), 0);
  const lastSeat = page.locator('[data-seat-map-seat="wide-ticket-9"]');
  await lastSeat.click();
  assert.equal(await lastSeat.getAttribute("aria-pressed"), "true");
});

test("published venue chart keeps available markers anchored to the full seat layout", async (t) => {
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
    ...Array.from({ length: 9996 }, (_, offset) => {
      const index = offset + 4;
      const seat = apiSeat(`bulk-${index}`, `R-${index + 1}`, 10 + (index % 4) * 10);
      return {
        ...seat,
        mapPosition: { ...seat.mapPosition, y: 50 + Math.floor(index / 4) },
      };
    }),
  ];
  await page.route("**/api/seat-map?**", (route) => route.fulfill({ json: seatMapEnvelope(backendSeats) }));
  await page.route("**/api/seat-charts/for-show/iu-world-tour?**", (route) => route.fulfill({
    json: publishedChartEnvelope(backendSeats, "전체 좌석 기준 배치도"),
  }));

  await openSeatStep(page, baseUrl);
  const anchoredSeat = page.locator('[data-seat-map-seat="open-middle"]');
  await anchoredSeat.waitFor();
  assert.equal(await page.locator('[data-seat-map-seat="sold-middle"]').count(), 0);
  await page.locator("[data-dense-chart-grid]").waitFor();
  const mapBox = await page.locator("[data-chart-seat-scroll]").boundingBox();
  assert.ok(mapBox);
  assert.ok(mapBox.height < 700, `10,000-seat map grew to ${mapBox.height}px tall`);
  assert.equal(await page.locator("[data-seat-map-seat]").count(), 200);
  assert.equal(await page.locator("[data-seat-map-seat=\"bulk-49\"]").count(), 1);
  const differentRow = page.locator('[data-seat-map-seat="bulk-49"]');
  await differentRow.evaluate((element) => element.scrollIntoView({ block: "center", inline: "center" }));
  const differentRowBox = await differentRow.boundingBox();
  assert.ok(differentRowBox);
  await page.touchscreen.tap(
    differentRowBox.x + differentRowBox.width / 2,
    differentRowBox.y + differentRowBox.height / 2,
  );
  assert.equal(await differentRow.getAttribute("aria-pressed"), "true");
  await page.getByRole("button", { name: "다음 좌석" }).click();
  const nextPageSeat = page.locator('[data-seat-map-seat="bulk-201"]');
  await nextPageSeat.waitFor();
  assert.equal(await nextPageSeat.evaluate((element) => document.activeElement === element), true);
});

test("published venue chart omits unavailable seats before paging", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  t.after(() => page.close());

  const backendSeats = Array.from({ length: 251 }, (_, index) => {
    const seat = apiSeat(`inventory-${index}`, `R-${index + 1}`, 10 + (index % 5) * 10, index >= 50);
    return { ...seat, mapPosition: { ...seat.mapPosition, y: 50 + Math.floor(index / 5) } };
  });
  await page.route("**/api/seat-map?**", (route) => route.fulfill({ json: seatMapEnvelope(backendSeats) }));
  await page.route("**/api/seat-charts/for-show/iu-world-tour?**", (route) => route.fulfill({
    json: publishedChartEnvelope(backendSeats, "가용 좌석 페이지 배치도"),
  }));

  await openSeatStep(page, baseUrl);
  const firstSellableSeat = page.locator('[data-seat-map-seat="inventory-50"]');
  await firstSellableSeat.waitFor();
  assert.equal(await page.locator('[data-seat-map-seat="inventory-0"]').count(), 0);
  assert.equal((await page.locator("[data-chart-seat-page]").textContent())?.trim(), "1 / 2");
  await firstSellableSeat.click();
  assert.equal(await firstSellableSeat.getAttribute("aria-pressed"), "true");
});

test("changing performances resets the upper seat map to its first page", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  t.after(() => page.close());

  await page.route("**/api/seat-map?**", (route) => {
    const performanceDateId = new URL(route.request().url()).searchParams.get("performanceDateId");
    const prefix = performanceDateId === "perf_958d01b9687e" ? "second" : "first";
    const seats = Array.from({ length: 251 }, (_, index) => {
      const seat = apiSeat(`${prefix}-${index}`, `R-${index + 1}`, 10 + (index % 5) * 10);
      return { ...seat, mapPosition: { ...seat.mapPosition, y: 50 + Math.floor(index / 5) } };
    });
    return route.fulfill({ json: seatMapEnvelope(seats) });
  });
  await page.route("**/api/seat-charts/for-show/iu-world-tour?**", (route) => route.fulfill({
    json: publishedChartEnvelope(Array.from({ length: 251 }, (_, index) => {
      const seat = apiSeat(`layout-${index}`, `R-${index + 1}`, 10 + (index % 5) * 10);
      return { ...seat, mapPosition: { ...seat.mapPosition, y: 50 + Math.floor(index / 5) } };
    }), "회차 전환 배치도"),
  }));

  await openSeatStep(page, baseUrl);
  await page.getByRole("button", { name: "다음 좌석" }).click();
  await page.locator('[data-seat-map-seat="first-200"]').waitFor();

  await page.getByRole("button", { name: "1. 날짜·회차" }).click();
  await page.getByRole("button", { name: "9월 13일" }).click();
  await page.getByRole("button", { name: "18:00" }).click();
  await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();

  await page.locator('[data-seat-map-seat="second-0"]').waitFor();
  assert.equal(await page.locator('[data-seat-map-seat="second-200"]').count(), 0);
  assert.equal((await page.locator("[data-chart-seat-page]").textContent())?.trim(), "1 / 2");
});

test("sold-out seat maps show an explicit unavailable state", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  t.after(() => page.close());

  const backendSeats = Array.from({ length: 4 }, (_, index) => apiSeat(
    `sold-${index}`,
    `R-${index + 1}`,
    10 + index * 10,
    false,
  ));
  await page.route("**/api/seat-map?**", (route) => route.fulfill({ json: seatMapEnvelope(backendSeats) }));
  await page.route("**/api/seat-charts/for-show/iu-world-tour?**", (route) => route.fulfill({
    json: publishedChartEnvelope(backendSeats, "매진 배치도"),
  }));

  await page.goto(`${baseUrl}/booking/iu-world-tour`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "9월 12일" }).click();
  await page.getByRole("button", { name: "19:00" }).click();
  assert.equal(await page.getByRole("button", { name: "좌석 선택으로 이동" }).isDisabled(), true);
  assert.equal(await page.locator("[data-seat-map-seat]").count(), 0);
});
