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
  {
    section: "editorial-events",
    expectedPath: "/event/ticketground-day",
    expectedHeading: "클린티켓으로 여는 여름 공연 큐레이션",
  },
  {
    section: "genre-recommendations",
    expectedPath: "/contents/genre",
    expectedHeading: "장르별 공연",
  },
  {
    section: "shortcuts",
    expectedPath: "/contents/shortcuts",
    expectedHeading: "바로가기",
  },
];

const viewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

test("home section more links route to their matching pages instead of search", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const viewport of viewports) {
    for (const item of sectionMoreLinks) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
      try {
        await page.goto(baseUrl, { waitUntil: "networkidle" });

        const moreLink = page.locator(`[data-section="${item.section}"]`).getByRole("link", { name: "더보기", exact: true });
        await moreLink.waitFor({ timeout: 5000 });
        assert.equal(await moreLink.getAttribute("href"), item.expectedPath, `${viewport.name} ${item.section} href`);

        await moreLink.click();
        await page.waitForURL(new RegExp(`${item.expectedPath}$`));
        assert.equal(new URL(page.url()).pathname, item.expectedPath, `${viewport.name} ${item.section} landed path`);

        const heading = page.getByRole("heading", { name: item.expectedHeading, exact: true });
        await heading.waitFor({ timeout: 5000 });
        assert.ok(await heading.isVisible(), `${viewport.name} ${item.expectedHeading} heading should be visible`);
      } finally {
        await page.close();
      }
    }
  }
});

test("floating inquiry shortcut does not cover desktop home more links", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const inquiryShortcut = page.locator('a[aria-label="1:1 문의"]');
  await inquiryShortcut.waitFor({ timeout: 5000 });
  const shortcutBox = await inquiryShortcut.boundingBox();
  assert.ok(shortcutBox, "floating inquiry shortcut is visible on desktop");

  for (const item of sectionMoreLinks) {
    const moreLink = page.locator(`[data-section="${item.section}"]`).getByRole("link", { name: "더보기", exact: true });
    await moreLink.evaluate((node) => node.scrollIntoView({ block: "center", inline: "nearest" }));
    const moreLinkBox = await moreLink.boundingBox();
    assert.ok(moreLinkBox, `${item.section} more link is measurable`);
    assert.equal(overlaps(shortcutBox, moreLinkBox), false, `${item.section} more link is not covered by floating inquiry shortcut`);
  }
});

function overlaps(first, second) {
  return first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y;
}
