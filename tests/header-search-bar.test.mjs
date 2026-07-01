import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("desktop header search accepts text directly and submits to search results", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

    const header = page.getByRole("banner");
    const hiddenFocusableSearchControls = await header.locator("form[role='search']").evaluateAll((forms) =>
      forms.flatMap((form) => {
        const style = window.getComputedStyle(form);
        const parentStyle = form.parentElement ? window.getComputedStyle(form.parentElement) : null;
        const hidden = style.opacity === "0" || parentStyle?.opacity === "0";
        if (!hidden) return [];
        return Array.from(form.querySelectorAll("input, button")).filter((control) => control.getAttribute("tabindex") !== "-1");
      }).length,
    );
    assert.equal(hiddenFocusableSearchControls, 0);

    const searchInput = header.getByRole("searchbox", { name: "공연명, 아티스트, 공연장 검색" }).first();
    await searchInput.fill("IU");
    await searchInput.press("Enter");

    await page.waitForURL(/\/contents\/search\?q=IU/);
    await page.getByRole("heading", { name: "IU 검색 결과", exact: true }).waitFor({ timeout: 5000 });

    const headerSearchLinks = await header.locator("a[href='/contents/search']").count();
    assert.equal(headerSearchLinks, 0);
  } finally {
    await page.close();
  }
});

async function resolveBaseUrl(t) {
  if (process.env.TICKETGROUND_TEST_BASE_URL) return process.env.TICKETGROUND_TEST_BASE_URL;
  return (await startServer(t)).baseUrl;
}
