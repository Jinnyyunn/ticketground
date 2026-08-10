import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const themeStorageKey = "ticketground:theme";

// Issue: the monthly calendar grid was hardcoded to bg-ink (the semantic
// text/foreground token, which flips near-black in light mode and
// near-white in dark mode) instead of a surface/card token that tracks the
// actual page background. Light mode rendered a near-black grid that looked
// like dark mode was stuck on; dark mode rendered a near-white grid that
// looked inverted.
test("monthly calendar grid tracks the active theme instead of staying fixed dark", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const results = {};
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
    await context.addInitScript((storageKey, themeName) => {
      window.localStorage.setItem(storageKey, themeName);
    }, themeStorageKey, theme);
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/open`, { waitUntil: "networkidle" });
      const grid = page.locator("[data-open-calendar-scroll]");
      await grid.waitFor({ timeout: 5000 });
      results[theme] = await grid.evaluate((element) => window.getComputedStyle(element).backgroundColor);
    } finally {
      await context.close();
    }
  }

  assert.notEqual(results.light, results.dark, "calendar background should differ between light and dark themes");
  assert.equal(results.light, "rgb(255, 255, 255)", "light mode calendar grid should use the light card background, not a dark one");
  assert.notEqual(results.dark, "rgb(255, 255, 255)", "dark mode calendar grid should not stay pinned to a light/white background");
});

test("genre legend assigns every genre chip a distinct color", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/open`, { waitUntil: "networkidle" });
  const chips = page.locator("[data-open-genre-chip]");
  await chips.first().waitFor({ timeout: 5000 });
  const colors = await chips.evaluateAll((elements) => elements.map((element) => window.getComputedStyle(element).backgroundColor));

  assert.equal(new Set(colors).size, colors.length, `expected every genre chip to have a distinct color, got: ${colors.join(", ")}`);
});

async function resolveBaseUrl(t) {
  if (process.env.TICKETGROUND_TEST_BASE_URL) return process.env.TICKETGROUND_TEST_BASE_URL;
  return (await startServer(t)).baseUrl;
}
