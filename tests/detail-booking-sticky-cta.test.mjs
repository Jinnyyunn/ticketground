import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("mobile booking CTA reads 예매하기 and stays pinned to the bottom of the viewport while scrolling", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/goods/iu-world-tour`, { waitUntil: "networkidle" });
  const cta = page.getByTestId("detail-booking-panel").getByTestId("detail-queue-link");
  await cta.waitFor({ timeout: 5000 });
  assert.equal((await cta.textContent())?.trim(), "예매하기");

  const boxBeforeScroll = await cta.boundingBox();
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(300);
  const boxAfterScroll = await cta.boundingBox();

  assert.ok(boxBeforeScroll, "CTA should be visible before scrolling");
  assert.ok(boxAfterScroll, "CTA should still be visible after scrolling");
  assert.equal(boxBeforeScroll.y, boxAfterScroll.y, "CTA's viewport position should not change on scroll (fixed to bottom)");
  assert.ok(boxAfterScroll.y > 700, `CTA should sit near the bottom of the 844px viewport, got y=${boxAfterScroll.y}`);
});

test("desktop booking CTA stays inline in the sticky sidebar panel, not pinned to the viewport bottom", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 } });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/goods/iu-world-tour`, { waitUntil: "networkidle" });
  const cta = page.getByTestId("detail-booking-panel").getByTestId("detail-queue-link");
  await cta.waitFor({ timeout: 5000 });
  const position = await cta.evaluate((el) => getComputedStyle(el).position);
  assert.notEqual(position, "fixed", "desktop CTA should not use the mobile fixed-bottom-bar layout");
});
