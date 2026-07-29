import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getImageProps } from "next/image.js";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const featuredPosterMarker = "iu-world-tour";
const sessionStorageKey = "ticketground:session-user-id";
const expectedFeaturedPolicy = getImageProps({
  alt: "",
  fetchPriority: "high",
  fill: true,
  loading: "eager",
  sizes: "(min-width: 768px) 56vw, 100vw",
  src: "/images/real-posters/iu-world-tour.jpg",
  unoptimized: false,
}).props;

function resourceKey({ imageSrcSet, imageSizes }) {
  return `${imageSrcSet}\n${imageSizes}`;
}

async function responsiveFeaturedHints(page) {
  return await page.locator('link[rel="preload"][as="image"]').evaluateAll((links, marker) =>
    links
      .filter((link) => (link.getAttribute("imagesrcset") ?? "").includes(marker))
      .map((link) => ({
        href: link.getAttribute("href"),
        imageSizes: link.getAttribute("imagesizes") ?? "",
        imageSrcSet: link.getAttribute("imagesrcset") ?? "",
      })),
  featuredPosterMarker);
}

test("profile guard keeps one responsive featured preload without exposing guarded home DOM", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  t.after(() => context.close());
  const page = await context.newPage();

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });

  const hints = await responsiveFeaturedHints(page);
  assert.equal(hints.length, 1);
  assert.ok(hints[0].imageSrcSet.includes(featuredPosterMarker));
  assert.ok(hints[0].imageSizes);
  assert.ok(hints[0].href === null || hints[0].href === "");
  assert.equal(await page.locator(`body img[src*="${featuredPosterMarker}"]`).count(), 0);
  assert.equal(await page.locator('body [data-section="spec-hero"]').count(), 0);
});

for (const viewer of [
  { label: "anonymous", userId: null },
  { label: "completed", userId: "user_fan_a" },
]) {
  test(`hydrated ${viewer.label} home reuses the exact featured preload resource`, async (t) => {
    const { baseUrl } = await startServer(t);
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    t.after(() => browser.close());
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    t.after(() => context.close());
    if (viewer.userId) {
      await context.addInitScript(({ key, value }) => {
        window.localStorage.setItem(key, value);
      }, { key: sessionStorageKey, value: viewer.userId });
    }
    const page = await context.newPage();

    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
    const hero = page.locator(`[data-section="spec-hero"] img[src*="${featuredPosterMarker}"]`).first();
    await hero.waitFor({ timeout: 5000 });

    const hints = await responsiveFeaturedHints(page);
    assert.equal(hints.length, 1);
    const heroPolicy = await hero.evaluate((image) => ({
      fetchPriority: image.getAttribute("fetchpriority"),
      loading: image.getAttribute("loading"),
      sizes: image.getAttribute("sizes") ?? "",
      src: image.getAttribute("src") ?? "",
      srcSet: image.getAttribute("srcset") ?? "",
    }));
    assert.equal(heroPolicy.loading, "eager");
    assert.equal(heroPolicy.fetchPriority, "high");
    assert.equal(heroPolicy.srcSet, hints[0].imageSrcSet);
    assert.equal(heroPolicy.sizes, hints[0].imageSizes);
    assert.equal(heroPolicy.src, expectedFeaturedPolicy.src);
    assert.equal(heroPolicy.srcSet, expectedFeaturedPolicy.srcSet);
    assert.equal(heroPolicy.sizes, expectedFeaturedPolicy.sizes);
    assert.equal(
      resourceKey({ imageSrcSet: heroPolicy.srcSet, imageSizes: heroPolicy.sizes }),
      resourceKey(hints[0]),
    );
    assert.ok(heroPolicy.src.includes(featuredPosterMarker));
  });
}

test("featured preload is a public poster hint without auth or personal data", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ javaScriptEnabled: false });
  t.after(() => context.close());
  const page = await context.newPage();

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });

  const [hint] = await responsiveFeaturedHints(page);
  assert.ok(hint);
  const decodedHint = decodeURIComponent(`${hint.imageSrcSet} ${hint.imageSizes} ${hint.href ?? ""}`);
  assert.doesNotMatch(decodedHint, /(token|session|cookie|credential|email|phone|user[_-]?id)/i);
  assert.match(decodedHint, /iu-world-tour/);
});

test("featured hero and preload consume the same typed image policy", async () => {
  const [cardSource, preloadSource, policySource, pageSource] = await Promise.all([
    readFile(new URL("../src/components/home/home-cards.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/home/home-featured-image-preload.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/home/home-featured-image-policy.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(policySource, /satisfies ImageProps/);
  assert.match(cardSource, /<Image\s+\{\.\.\.homeFeaturedImagePolicy\}/);
  assert.match(preloadSource, /getImageProps\(homeFeaturedImagePolicy\)/);
  assert.match(preloadSource, /ReactDOM\.preload\(props\.src/);
  assert.match(preloadSource, /return null/);
  assert.match(pageSource, /<HomeFeaturedImagePreload \/>[\s\S]*<ProfileCompletionGuard>/);
  assert.doesNotMatch(pageSource, /<ProfileCompletionGuard>[\s\S]*<HomeFeaturedImagePreload \/>/);
});
