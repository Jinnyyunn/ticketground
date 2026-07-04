import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("home and watchlist pages render smooth-scroll and above-fold image policies", async (t) => {
  const server = await startServer(t);
  const browser = await chromium.launch();
  t.after(async () => {
    await browser.close();
  });

  const page = await browser.newPage();

  await page.goto(`${server.baseUrl}/`, { waitUntil: "networkidle" });

  const homeImagePolicy = await page.evaluate(() => {
    const preloadLinks = [...document.querySelectorAll('link[rel="preload"][as="image"]')];
    const featuredImage = [...document.images].find((image) => image.currentSrc.includes("iu-world-tour"));
    const featuredPreload = preloadLinks.find((link) => {
      const sourceSet = link.getAttribute("imagesrcset") ?? "";
      const href = link.getAttribute("href") ?? "";
      return `${sourceSet} ${href}`.includes("iu-world-tour");
    });

    return {
      featuredHasManualFetchPriority: featuredImage?.getAttribute("fetchpriority") ?? null,
      featuredHasManualLoading: featuredImage?.getAttribute("loading") ?? null,
      featuredImageExists: Boolean(featuredImage),
      featuredPreloadExists: Boolean(featuredPreload),
      scrollBehavior: document.documentElement.dataset.scrollBehavior ?? null,
    };
  });

  assert.deepEqual(homeImagePolicy, {
    featuredHasManualFetchPriority: null,
    featuredHasManualLoading: null,
    featuredImageExists: true,
    featuredPreloadExists: true,
    scrollBehavior: "smooth",
  });

  await page.goto(`${server.baseUrl}/watchlist`, { waitUntil: "networkidle" });

  const watchlistImagePolicy = await page.evaluate(() =>
    [...document.images].slice(0, 3).map((image) => ({
      alt: image.alt,
      currentSrc: image.currentSrc,
      fetchPriority: image.getAttribute("fetchpriority"),
      loading: image.getAttribute("loading"),
    })),
  );

  assert.equal(watchlistImagePolicy.length, 3);
  for (const image of watchlistImagePolicy) {
    assert.match(image.alt, /포스터$/);
    assert.ok(image.currentSrc, `${image.alt} should resolve an image source`);
    assert.equal(image.loading, "eager", `${image.alt} should load eagerly above the fold`);
    assert.equal(image.fetchPriority, "high", `${image.alt} should keep high fetch priority`);
  }
});
