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

test("floating inquiry shortcut sits at the desktop bottom right", async (t) => {
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
  assert.ok(shortcutBox.x > 1000, `floating inquiry shortcut should sit on the right side, got x=${shortcutBox.x}`);
  assert.ok(shortcutBox.y > 760, `floating inquiry shortcut should sit near the bottom, got y=${shortcutBox.y}`);
});

test("home more links and editorial cards use requested brand color surfaces", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());

  await page.goto(baseUrl, { waitUntil: "networkidle" });

  const moreLinks = await page.getByRole("link", { name: "더보기", exact: true }).evaluateAll((links) =>
    links.map((link) => window.getComputedStyle(link).color),
  );
  assert.ok(moreLinks.length >= 5, "home renders section more links");
  assert.ok(moreLinks.every((color) => color === "rgb(26, 26, 29)"), `more links should be black: ${moreLinks.join(", ")}`);

  const editorialCards = page.locator('[data-section="editorial-events"] [data-card="editorial-event"]');
  await editorialCards.first().waitFor({ timeout: 5000 });

  assert.equal(await editorialCards.first().locator("[data-card-accent]").count(), 0, "dark editorial card should not render a top accent border");
  assert.equal(await editorialCards.locator("span.absolute.bottom-5.right-5").count(), 0, "editorial cards should not render inner decorative squares");
  const smallIndexBadges = await editorialCards.evaluateAll((cards) =>
    cards.flatMap((card) =>
      Array.from(card.querySelectorAll("span")).filter((node) => {
        const text = node.textContent?.trim();
        return /^0[1-3]$/.test(text ?? "") && node.classList.contains("h-8") && node.classList.contains("min-w-10");
      }),
    ).length,
  );
  assert.equal(smallIndexBadges, 0, "editorial cards should not render small boxed index badges");

  const redCardColor = await editorialCards.nth(1).evaluate((node) => window.getComputedStyle(node).backgroundColor);
  assert.match(redCardColor, /(rgb\(255, 45, 63\)|oklab\(0\.67[^)]*0\.2[^)]*0\.12)/, `second editorial card should use red background: ${redCardColor}`);

  const yellowCardColor = await editorialCards.nth(2).evaluate((node) => window.getComputedStyle(node).backgroundColor);
  assert.match(yellowCardColor, /(rgb\(255, 233, 46\)|oklab\(0\.91[^)]*-0\.03[^)]*0\.17)/, `third editorial card should use yellow background: ${yellowCardColor}`);
});

test("ticket-open cards keep their selector and render compact poster thumbnails", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  t.after(() => page.close());

  await page.goto(baseUrl, { waitUntil: "networkidle" });

  const ticketOpenCards = page.locator('[data-section="ticket-open"] [data-card="ticket-open"]');
  await ticketOpenCards.first().waitFor({ timeout: 5000 });
  assert.equal(await ticketOpenCards.count(), 4, "ticket-open selector should still identify all cards");

  const thumbnailCount = await ticketOpenCards.locator('[data-ticket-open-thumbnail] img').count();
  assert.equal(thumbnailCount, 4, "each ticket-open card should render one poster thumbnail");
  const thumbnailSources = await ticketOpenCards.locator('[data-ticket-open-thumbnail] img').evaluateAll((images) =>
    images.map((image) => image.currentSrc || image.getAttribute("src") || ""),
  );
  assert.ok(new Set(thumbnailSources).size >= 4, `ticket-open thumbnails should map to each card poster: ${thumbnailSources.join(", ")}`);

  const thumbnailBox = await ticketOpenCards.first().locator("[data-ticket-open-thumbnail]").boundingBox();
  assert.ok(thumbnailBox, "ticket-open thumbnail should be visible");
  assert.ok(thumbnailBox.width >= 56 && thumbnailBox.width <= 64, `thumbnail width should be compact, got ${thumbnailBox.width}`);
});
