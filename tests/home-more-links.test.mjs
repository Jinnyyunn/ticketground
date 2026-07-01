import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const sectionMoreLinks = [
  {
    section: "realtime-top10",
    expectedPath: "/contents/ranking",
    expectedHeading: "실시간 예매 랭킹 TOP 10",
  },
  {
    section: "ticket-open",
    expectedPath: "/open",
    expectedHeading: "2026년 7월 월별 캘린더",
  },
  {
    section: "official-resale",
    expectedPath: "/resale",
    expectedHeading: "공식 재판매",
  },
];

test("home section more links route to their matching pages instead of search", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const item of sectionMoreLinks) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });

      const moreLink = page.locator(`[data-section="${item.section}"]`).getByRole("link", { name: "더보기", exact: true });
      await moreLink.waitFor({ timeout: 5000 });
      assert.equal(await moreLink.getAttribute("href"), item.expectedPath);

      await moreLink.click();
      await page.waitForURL(new RegExp(`${item.expectedPath}$`));
      assert.equal(new URL(page.url()).pathname, item.expectedPath);

      const heading = page.getByRole("heading", { name: item.expectedHeading, exact: true });
      await heading.waitFor({ timeout: 5000 });
      assert.ok(await heading.isVisible(), `${item.expectedHeading} heading should be visible`);
    } finally {
      await page.close();
    }
  }
});
