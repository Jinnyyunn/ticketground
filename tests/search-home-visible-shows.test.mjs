import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const homeVisibleSearchCases = [
  { query: "IU", slug: "iu-world-tour", title: /IU 2026 WORLD TOUR/ },
  { query: "하데스타운", slug: "hadestown", title: /하데스타운/ },
  { query: "조성진", slug: "cho-seong-jin", title: /조성진 피아노 리사이틀/ },
];

test("home-visible shows are searchable and link to detail pages", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const item of homeVisibleSearchCases) {
    const page = await browser.newPage({ viewport: { width: 1293, height: 1043 } });
    t.after(() => page.close());

    await page.goto(`${baseUrl}/contents/search?q=${encodeURIComponent(item.query)}`, { waitUntil: "networkidle" });

    const countText = String(await page.locator("[data-search-result-count]").textContent()).trim();
    assert.match(countText, /총 [1-9]\d*개 전체 결과/, `${item.query} should return at least one result`);
    assert.ok(await page.getByRole("heading", { name: item.title }).count(), `${item.query} result should include the home-visible title`);

    const detailLink = page.locator(`a[href="/goods/${item.slug}"]`).first();
    const resultCardsForSlug = await page.locator(`[data-search-results] article:has(a[href="/goods/${item.slug}"])`).count();
    assert.equal(resultCardsForSlug, 1, `${item.query} should render one search result for ${item.slug}`);
    await detailLink.waitFor({ timeout: 5000 });
    await detailLink.click();
    await page.waitForURL(new RegExp(`/goods/${item.slug}$`));
    assert.ok(await page.getByRole("heading", { name: item.title }).count(), `${item.query} detail page should render the title`);
  }
});
