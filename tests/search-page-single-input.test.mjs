import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("search page keeps one clear query form while preserving header chrome", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${baseUrl}/contents/search?q=${encodeURIComponent("레미제라블")}`, { timeout: 120_000, waitUntil: "domcontentloaded" });

    const banner = page.getByRole("banner");
    await banner.getByRole("link", { name: "Ticketground", exact: true }).waitFor({ timeout: 5000 });
    await page.getByRole("navigation", { name: "카테고리" }).waitFor({ timeout: 5000 });

    const headerSearchSurfaces = await page.locator("header").evaluate((header) =>
      Array.from(header.querySelectorAll("a[href='/contents/search']")).filter((link) => link.textContent?.includes("공연명")).length,
    );
    assert.equal(headerSearchSurfaces, 0);

    const searchForms = await page.locator("form[action='/contents/search']").count();
    assert.equal(searchForms, 1);

    await page.getByRole("textbox").fill("IU");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await page.waitForURL(/q=IU/);
    await page.getByRole("heading", { name: "IU 검색 결과", exact: true }).waitFor({ timeout: 5000 });
  } finally {
    await page.close();
  }
});
