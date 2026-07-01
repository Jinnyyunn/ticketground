import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const viewports = [
  { id: "mobile-390", width: 390, height: 844, isMobile: true },
  { id: "mobile-430", width: 430, height: 932, isMobile: true },
  { id: "tablet-768", width: 768, height: 1024, isMobile: false },
  { id: "desktop-1293", width: 1293, height: 1043, isMobile: false },
];

test("open calendar fits mobile width without losing desktop density", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const viewport of viewports) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.isMobile ? 2 : 1,
      isMobile: viewport.isMobile,
    });
    t.after(() => page.close());

    await page.goto(`${baseUrl}/open`, { waitUntil: "networkidle" });
    const scroll = page.locator("[data-open-calendar-scroll]");
    const grid = page.locator("[data-open-calendar-grid]");
    await scroll.scrollIntoViewIfNeeded();

    const metrics = await page.evaluate(() => {
      const scrollEl = document.querySelector("[data-open-calendar-scroll]");
      const gridEl = document.querySelector("[data-open-calendar-grid]");
      if (!(scrollEl instanceof HTMLElement) || !(gridEl instanceof HTMLElement)) {
        throw new Error("calendar elements not found");
      }
      return {
        viewportWidth: window.innerWidth,
        bodyScrollWidth: document.body.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        scrollClientWidth: scrollEl.clientWidth,
        scrollScrollWidth: scrollEl.scrollWidth,
        gridWidth: gridEl.getBoundingClientRect().width,
      };
    });

    assert.ok(metrics.bodyScrollWidth <= metrics.viewportWidth + 1, `${viewport.id} body has no horizontal overflow`);
    assert.ok(metrics.documentScrollWidth <= metrics.viewportWidth + 1, `${viewport.id} document has no horizontal overflow`);
    if (viewport.width < 768) {
      assert.ok(metrics.scrollScrollWidth <= metrics.scrollClientWidth + 1, `${viewport.id} calendar has no inner horizontal scroll`);
      assert.ok(metrics.gridWidth <= metrics.scrollClientWidth + 1, `${viewport.id} grid fits calendar container`);
    } else {
      assert.ok(metrics.gridWidth >= 720, `${viewport.id} preserves desktop/tablet calendar density`);
    }

    const cells = await grid.locator("> div").evaluateAll((items) =>
      items.slice(7).map((item) => {
        const box = item.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    );
    assert.equal(cells.length, 31, `${viewport.id} renders all day cells`);
    assert.ok(cells.every((cell) => cell.width >= 43), `${viewport.id} keeps day cells touchable`);
    assert.ok(cells.every((cell) => cell.height >= 74), `${viewport.id} keeps day cells tall enough`);

    const badges = await grid.locator("a[data-allow-wrap='true']").evaluateAll((items) =>
      items.map((item) => {
        const box = item.getBoundingClientRect();
        const parent = item.parentElement?.getBoundingClientRect();
        return {
          insideParent:
            Boolean(parent) &&
            box.left >= parent.left - 1 &&
            box.right <= parent.right + 1 &&
            box.top >= parent.top - 1 &&
            box.bottom <= parent.bottom + 1,
        };
      }),
    );
    assert.ok(badges.length > 0, `${viewport.id} renders calendar show badges`);
    assert.ok(badges.every((badge) => badge.insideParent), `${viewport.id} badges stay inside their day cells`);
  }
});

test("open calendar show badges navigate to details", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/open`, { waitUntil: "networkidle" });
  await page.locator("[data-open-calendar-scroll]").scrollIntoViewIfNeeded();
  await page.locator("[data-open-calendar-grid] a[data-allow-wrap='true']").first().click();
  await page.waitForURL((url) => url.pathname.startsWith("/goods/"));
  assert.ok(new URL(page.url()).pathname.startsWith("/goods/"));
});
