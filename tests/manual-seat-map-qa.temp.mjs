import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const cleanups = [];
const t = { after(callback) { cleanups.push(callback); } };
const seats = Array.from({ length: 10000 }, (_, index) => ({
  id: `bulk-${index}`,
  label: `R-${index + 1}`,
  displayCode: `R-${index + 1}`,
  zoneId: "zone_r",
  zoneName: "R석",
  price: 165000,
  status: index === 1 ? "SOLD" : "ON_SALE",
  available: index !== 1,
  mapPosition: { x: 10 + (index % 4) * 10, y: 50 + Math.floor(index / 4), width: 5, height: 5, rotate: 0, shape: "actual-map" },
}));
const server = await startServer(t);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.route("**/api/seat-map?**", (route) => route.fulfill({ json: { ok: true, data: {
    event: { id: "event_ca5eae7ab951", title: "IU 2026 WORLD TOUR", venueId: "venue_jamsil", venue: "잠실종합운동장" },
    map: { title: "QA 좌석도", image: "/assets/generic-arena-floor.svg", description: "QA" },
    zones: [{ id: "zone_r", name: "R석", price: 165000, available: 9999 }], seats,
  } } }));
  await page.route("**/api/seat-charts/for-show/iu-world-tour?**", (route) => route.fulfill({ json: { ok: true, source: "fallback", chart: null, record: null, inventory: null } }));
  await page.goto(`${server.baseUrl}/booking/iu-world-tour`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "9월 12일" }).click();
  await page.getByRole("button", { name: "19:00" }).click();
  await page.getByRole("button", { name: "1매" }).click();
  await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();
  const target = page.locator('[data-seat-map-seat="bulk-49"]');
  await target.waitFor();
  await target.click();
  await page.screenshot({ path: "/tmp/ticketground-seat-map-dense-final.png", fullPage: true });
  process.stdout.write(`${JSON.stringify({
    selected: await target.getAttribute("aria-pressed"),
    markerCount: await page.locator("[data-venue-seat-marker]").count(),
    duplicateHeadingCount: await page.getByRole("heading", { name: "실제 구매 가능한 티켓 선택" }).count(),
    pager: (await page.locator("[data-seat-map-page]").textContent())?.trim() ?? null,
  })}\n`);
  await page.close();
} finally {
  await browser.close();
  for (const cleanup of cleanups.reverse()) await cleanup();
}
