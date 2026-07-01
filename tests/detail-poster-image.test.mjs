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

    const layoutState = await detailPoster.evaluate((image) => {
      if (!(image instanceof HTMLImageElement)) {
        throw new Error("detail poster is not an image element");
      }
      const card = image.closest("article");
      if (!card) {
        throw new Error("detail poster card was not found");
      }
      const imageBox = image.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      const darkOverlayCount = Array.from(card.querySelectorAll("div")).filter((element) => {
        const style = getComputedStyle(element);
        return style.position === "absolute" && style.inset === "0px" && style.backgroundImage.includes("gradient");
      }).length;
      return {
        aspectDelta: Math.abs(imageBox.width / imageBox.height - image.naturalWidth / image.naturalHeight),
        cardHeight: cardBox.height,
        darkOverlayCount,
        imageHeight: imageBox.height,
        imagePosition: getComputedStyle(image).position,
      };
    });
    assert.equal(layoutState.imagePosition, "static", `${item.slug} detail poster card height is driven by the poster image`);
    assert.ok(layoutState.cardHeight - layoutState.imageHeight <= 8, `${item.slug} detail poster card has no large empty area below the image: ${JSON.stringify(layoutState)}`);
    assert.ok(layoutState.aspectDelta <= 0.02, `${item.slug} detail poster keeps the natural image aspect ratio: ${JSON.stringify(layoutState)}`);
    assert.equal(layoutState.darkOverlayCount, 0, `${item.slug} detail poster card does not add a full-height dark gradient overlay`);
  }

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  try {
    await mobilePage.goto(`${baseUrl}/goods/les-miserables`, { waitUntil: "networkidle" });

    const poster = mobilePage.locator("[data-detail-poster]");
    await poster.waitFor({ timeout: 5000 });
    const box = await poster.evaluate((image) => {
      if (!(image instanceof HTMLImageElement)) {
        throw new Error("detail poster is not an image element");
      }
      const imageBox = image.getBoundingClientRect();
      const articleBox = image.closest("article")?.getBoundingClientRect();
      return {
        imageHeight: imageBox.height,
        articleWidth: articleBox?.width ?? 0,
        articleHeight: articleBox?.height ?? 0,
      };
    });

    const expectedHeight = box.articleWidth * (4 / 3);
    assert.ok(Math.abs(box.articleHeight - expectedHeight) <= 4, `mobile poster article ratio drifted: ${JSON.stringify(box)}`);
    assert.ok(Math.abs(box.imageHeight - box.articleHeight) <= 2, `mobile poster image does not fill article height: ${JSON.stringify(box)}`);
  } finally {
    await mobilePage.close();
  }
});
