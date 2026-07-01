import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const posterCases = [
  { slug: "les-miserables", query: "레미제라블" },
  { slug: "dracula", query: "드라큘라" },
  { slug: "palette-festival", query: "Palette Festival" },
  { slug: "banksy", query: "뱅크시" },
];

test("goods detail pages preserve the poster image from show list cards", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const item of posterCases) {
    const page = await browser.newPage({ viewport: { width: 1293, height: 1043 } });
    t.after(() => page.close());

    await page.goto(`${baseUrl}/contents/search?q=${encodeURIComponent(item.query)}`, { waitUntil: "networkidle" });
    const card = page.locator(`a[href="/goods/${item.slug}"]`).first();
    await card.waitFor({ timeout: 5000 });
    const listPosterSrc = await card.locator("img").first().getAttribute("src");
    assert.ok(listPosterSrc, `${item.slug} list card has a poster image`);

    await card.click();
    await page.waitForURL(new RegExp(`/goods/${item.slug}$`));

    const detailPoster = page.locator("[data-detail-poster]");
    await detailPoster.waitFor({ timeout: 5000 });
    const detailPosterSrc = await detailPoster.getAttribute("src");
    assert.equal(detailPosterSrc, listPosterSrc, `${item.slug} detail poster uses the list poster`);

    const imageState = await detailPoster.evaluate((image) => {
      if (!(image instanceof HTMLImageElement)) {
        throw new Error("detail poster is not an image element");
      }
      const box = image.getBoundingClientRect();
      return {
        alt: image.alt,
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        width: box.width,
        height: box.height,
      };
    });
    assert.ok(imageState.alt.length > 0, `${item.slug} detail poster has accessible alt text`);
    assert.ok(imageState.complete, `${item.slug} detail poster finished loading`);
    assert.ok(imageState.naturalWidth > 0 && imageState.naturalHeight > 0, `${item.slug} detail poster loaded real image pixels`);
    assert.ok(imageState.width >= 280 && imageState.height >= 400, `${item.slug} detail poster fills the hero area`);
  }
});
