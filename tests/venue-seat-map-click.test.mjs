import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

// Issue #173: seat selection reportedly not working on a real device. Could
// not reproduce a click failure with synthetic events (that requires real
// touch/WebKit gesture behavior), but two structural risks were fixed
// regardless: (1) the visual seat map's markers looked tappable but did
// nothing, and (2) the seat list's own nested scroll region on mobile is
// exactly the setup that trips WebKit's tap-vs-scroll disambiguation.

test("venue seat map markers are clickable and toggle the same selection state as the list", async (t) => {
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

  const marker = page.locator("[data-venue-seat-marker]").first();
  await marker.waitFor({ timeout: 10000 });
  assert.equal(await marker.evaluate((el) => el.tagName), "BUTTON", "marker should be a real interactive button now");
  const markerLabel = await marker.getAttribute("aria-label");
  assert.ok(markerLabel, "marker should have an accessible name");

  await marker.click();
  const seatId = await marker.getAttribute("data-venue-seat-marker");
  await page.locator(`[data-backend-seat="${seatId}"]`).waitFor({ timeout: 5000 });
  const listItemClass = await page.locator(`[data-backend-seat="${seatId}"]`).getAttribute("class");
  assert.match(listItemClass ?? "", /border-ink bg-ink/, "clicking the map marker should select the same seat in the list below");
  assert.ok(await page.getByRole("link", { name: "결제하기" }).count() > 0, "selecting via the map should also enable payment");
});

test("the seat list does not create a nested mobile scroll region below lg", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/booking/iu-world-tour`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "9월 12일" }).click();
  await page.getByRole("button", { name: "19:00" }).click();
  await page.getByRole("button", { name: "1매" }).click();
  await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();
  await page.locator("[data-backend-seat]").first().waitFor({ timeout: 10000 });

  const listContainer = page.locator("[data-backend-seat]").first().locator("..");
  const overflowY = await listContainer.evaluate((el) => getComputedStyle(el).overflowY);
  assert.notEqual(overflowY, "auto", "seat list should not be a separately-scrollable region on mobile (issue #173)");
});
