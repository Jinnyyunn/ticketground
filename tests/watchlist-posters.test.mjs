import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const expectedPosters = [
  { title: "레미제라블", slug: "les-miserables", poster: "/images/real-posters/les-miserables-40.jpg" },
  { title: "IU 2026 WORLD TOUR", slug: "iu-world-tour", poster: "/images/real-posters/iu-world-tour.jpg" },
  { title: "뮤지컬 드라큘라", slug: "dracula", poster: "/images/posters/L0000142_p.gif" },
];

test("watchlist cards reuse home and catalog poster images", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${baseUrl}/watchlist`, { waitUntil: "networkidle" });

    for (const item of expectedPosters) {
      const card = page.locator("article").filter({ hasText: item.title }).first();
      await card.waitFor({ timeout: 5000 });

      const image = card.locator(`img[alt="${item.title} 포스터"]`);
      await image.waitFor({ timeout: 5000 });
      const imagePath = new URL((await image.getAttribute("src")) ?? "", baseUrl).pathname;
      assert.equal(imagePath, item.poster);

      const imageLink = card.getByRole("link", { name: `${item.title} 상세보기`, exact: true }).first();
      assert.equal(await imageLink.getAttribute("href"), `/goods/${item.slug}`);
    }
  } finally {
    await page.close();
  }
});
