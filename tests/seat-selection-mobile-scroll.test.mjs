import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

// Issue #173: seat selection reportedly not working on a real device. The
// real, always-functional seat list had its own nested scroll region on
// mobile (max-h-[260px] overflow-y-auto), reached only after scrolling the
// outer page down to it - exactly the setup WebKit's tap-vs-scroll gesture
// disambiguation is known to misfire on. Could not reproduce a synthetic
// click failure directly (that requires real touch/WebKit behavior), so
// this removes the structural risk regardless.
//
// A companion fix making the illustrative seat map's markers clickable was
// tried and reverted: an independent verification pass found that on real
// seeded data, adjacent markers can sit only a few px apart (the venue-map
// position formula in backend/admin-seatmaps.js spaces seats by angle at a
// fixed per-zone radius, so dense zones cluster tightly), so a tap could
// silently select the wrong seat - confirmed with both a forced click and a
// real touchscreen.tap() at actual on-screen coordinates. The map stays
// decorative/non-interactive; the list below remains the only selection path.

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

test("tablet-width viewports also get the unconstrained layout (below lg, same as mobile)", async (t) => {
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
  await page.locator("[data-backend-seat]").first().waitFor({ timeout: 10000 });

  const listContainer = page.locator("[data-backend-seat]").first().locator("..");
  const overflowY = await listContainer.evaluate((el) => getComputedStyle(el).overflowY);
  // Intentional, not just untested: the WebKit tap-vs-scroll issue this
  // fix targets applies to any touch device, tablets included, so tablet
  // width deliberately shares mobile's unconstrained layout rather than
  // getting its own three-way breakpoint split.
  assert.notEqual(overflowY, "auto", "tablet-width should share mobile's unconstrained layout, not desktop's scroll cap");
});

test("desktop keeps the constrained, scrollable seat-list layout unchanged", async (t) => {
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
  await page.locator("[data-backend-seat]").first().waitFor({ timeout: 10000 });

  const listContainer = page.locator("[data-backend-seat]").first().locator("..");
  const overflowY = await listContainer.evaluate((el) => getComputedStyle(el).overflowY);
  assert.equal(overflowY, "auto", "desktop seat list should keep its constrained, scrollable layout");
});

test("venue seat map markers remain decorative (not clickable) - no per-marker selection state to get wrong", async (t) => {
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
  assert.equal(await marker.evaluate((el) => el.tagName), "SPAN", "marker should stay a decorative, non-interactive element");
  assert.equal(await marker.getAttribute("aria-hidden"), "true");
});
