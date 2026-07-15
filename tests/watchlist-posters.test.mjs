import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const expectedPosters = [
  { title: "IU 2026 WORLD TOUR", slug: "iu-world-tour", poster: "/images/real-posters/iu-world-tour.jpg" },
  { title: "뮤지컬 드라큘라", slug: "dracula", poster: "/images/posters/L0000142_p.gif" },
  { title: "뮤지컬 베토벤", slug: "beethoven", poster: "/images/posters/P0004669_p.gif" },
];

test("watchlist cards reuse home and catalog poster images", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    // Given the watchlist page renders the same posters used by home and catalog cards.
    await page.goto(`${baseUrl}/watchlist`, { waitUntil: "networkidle" });

    for (const item of expectedPosters) {
      const card = page.locator("article").filter({ hasText: item.title }).first();
      await card.waitFor({ timeout: 5000 });

      // When each poster thumbnail is rendered inside the 예매 오픈 알림 card.
      const image = card.locator(`img[alt="${item.title} 포스터"]`);
      await image.waitFor({ timeout: 5000 });
      const imagePath = new URL((await image.getAttribute("src")) ?? "", baseUrl).pathname;
      assert.equal(imagePath, item.poster);

      // Then the thumbnail fills the card without side gutters, including 뮤지컬 드라큘라.
      const renderedImage = await image.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
          className: element.className,
          objectFit: style.objectFit,
        };
      });
      assert.equal(renderedImage.objectFit, "cover", `${item.title} watchlist poster should use object-fit: cover`);
      assert.equal(renderedImage.className.includes("object-contain"), false, `${item.title} watchlist poster should not use object-contain`);

      const imageLink = card.getByRole("link", { name: `${item.title} 상세보기`, exact: true }).first();
      assert.equal(await imageLink.getAttribute("href"), `/goods/${item.slug}`);
    }
  } finally {
    await page.close();
  }
});
