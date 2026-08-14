import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

// Regression for 사용자 페이지 UI 전면 개선 계획서.md §3-4: the IU 2026 World
// Tour hero image used object-top on a tall portrait photo, so on the wide/
// short hero container it cropped down to forehead/hairline only with no
// face visible. object-position should keep the eyes in frame instead of
// pinning to the raw top edge of the source image.
test("home hero image keeps the subject's eyes in frame instead of cropping to hairline only", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    const heroImage = page.locator('a[href="/goods/iu-world-tour"] img').first();
    await heroImage.waitFor({ timeout: 5000 });

    const objectPosition = await heroImage.evaluate((img) => getComputedStyle(img).objectPosition);
    assert.notEqual(objectPosition, "50% 0%", "hero image must not pin to the raw top edge (object-top)");

    const verticalPercent = Number(objectPosition.split(" ")[1]?.replace("%", ""));
    assert.ok(
      Number.isFinite(verticalPercent) && verticalPercent > 0 && verticalPercent < 50,
      `expected a moderate top-weighted anchor to keep the face in frame, got "${objectPosition}"`,
    );
  } finally {
    await page.close();
  }
});
