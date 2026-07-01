import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("desktop header places ticket open calendar to the right of resale", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${baseUrl}/watchlist`, { waitUntil: "networkidle" });

    const visibleQuickLinks = await page.locator("header a[href='/resale'], header a[href='/open']").evaluateAll((anchors) =>
      anchors
        .filter((anchor) => {
          const rect = anchor.getBoundingClientRect();
          const style = window.getComputedStyle(anchor);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        })
        .map((anchor) => ({
          href: anchor.getAttribute("href"),
          text: anchor.textContent?.trim() ?? "",
          x: anchor.getBoundingClientRect().x,
        })),
    );

    const resale = visibleQuickLinks.find((link) => link.href === "/resale");
    const openCalendar = visibleQuickLinks.find((link) => link.href === "/open");

    assert.ok(resale, `visible resale link missing: ${JSON.stringify(visibleQuickLinks)}`);
    assert.ok(openCalendar, `visible ticket open calendar link missing: ${JSON.stringify(visibleQuickLinks)}`);
    assert.equal(resale.text, "티켓 재판매");
    assert.equal(openCalendar.text, "티켓오픈 캘린더");
    assert.ok(resale.x < openCalendar.x, `expected resale before calendar: ${JSON.stringify(visibleQuickLinks)}`);
  } finally {
    await page.close();
  }
});

async function resolveBaseUrl(t) {
  if (process.env.TICKETGROUND_TEST_BASE_URL) return process.env.TICKETGROUND_TEST_BASE_URL;
  return (await startServer(t)).baseUrl;
}
