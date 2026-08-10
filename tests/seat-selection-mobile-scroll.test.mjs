import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

// The seat map is now the only selection surface. These tests exercise real
// pointer coordinates, the horizontally scrolled edge, and keyboard input so
// the visual markers cannot regress into decorative or unreliable controls.

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
