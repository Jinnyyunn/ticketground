import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("search filter tabs update active state, results, empty copy, and mobile touch area", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  await assertDesktopTabFiltering(browser, baseUrl);
  await assertArtistTabFiltering(browser, baseUrl);
  await assertMobileTouchArea(browser, baseUrl);
});

async function resolveBaseUrl(t) {
  if (process.env.TICKETGROUND_TEST_BASE_URL) return process.env.TICKETGROUND_TEST_BASE_URL;
  return (await startServer(t)).baseUrl;
}

async function assertDesktopTabFiltering(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${baseUrl}/contents/search?q=${encodeURIComponent("레미제라블")}`, { waitUntil: "networkidle" });

    const allTab = page.getByRole("tab", { name: "전체", exact: true });
    await allTab.waitFor({ timeout: 5000 });
    assert.equal(await allTab.getAttribute("aria-selected"), "true");
    assert.match(await resultCount(page), /총 1개 전체 결과/);

    const showTab = page.getByRole("tab", { name: "공연", exact: true });
    await showTab.click();
    assert.equal(await showTab.getAttribute("aria-selected"), "true");
    assert.match(await resultCount(page), /총 1개 공연 결과/);
    assert.ok(await page.getByRole("heading", { name: /레미제라블 40주년/ }).count() >= 1);

    const artistTab = page.getByRole("tab", { name: "아티스트", exact: true });
    await artistTab.click();
    assert.equal(await artistTab.getAttribute("aria-selected"), "true");
    assert.match(await emptyCopy(page), /"레미제라블"에 대한 아티스트 결과가 없습니다\./);

    const venueTab = page.getByRole("tab", { name: "장소", exact: true });
    await venueTab.click();
    assert.equal(await venueTab.getAttribute("aria-selected"), "true");
    assert.match(await emptyCopy(page), /"레미제라블"에 대한 장소 결과가 없습니다\./);

    const collectionTab = page.getByRole("tab", { name: "기획전", exact: true });
    await collectionTab.click();
    assert.equal(await collectionTab.getAttribute("aria-selected"), "true");
    assert.match(await emptyCopy(page), /"레미제라블"에 대한 기획전 결과가 없습니다\./);
  } finally {
    await page.close();
  }
}

async function assertArtistTabFiltering(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${baseUrl}/contents/search?q=${encodeURIComponent("민우혁")}`, { waitUntil: "networkidle" });

    assert.match(await resultCount(page), /총 0개 전체 결과/);
    const artistTab = page.getByRole("tab", { name: "아티스트", exact: true });
    await artistTab.click();
    await waitForSelected(page, "아티스트");
    assert.equal(await artistTab.getAttribute("aria-selected"), "true");
    assert.match(await resultCount(page), /총 1개 아티스트 결과/);
    assert.ok(await page.getByRole("heading", { name: /레미제라블 40주년/ }).count() >= 1);
  } finally {
    await page.close();
  }
}

async function assertMobileTouchArea(browser, baseUrl) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });
  try {
    await page.goto(`${baseUrl}/contents/search?q=${encodeURIComponent("블루스퀘어")}`, { waitUntil: "networkidle" });

    const tabHeights = await page.locator("[data-search-tab]").evaluateAll((tabs) => tabs.map((tab) => tab.getBoundingClientRect().height));
    assert.ok(tabHeights.length === 5);
    assert.ok(tabHeights.every((height) => height >= 44), `tab touch targets too short: ${tabHeights.join(", ")}`);

    const venueTab = page.getByRole("tab", { name: "장소", exact: true });
    await venueTab.tap();
    await waitForSelected(page, "장소");
    assert.equal(await venueTab.getAttribute("aria-selected"), "true");
    assert.match(await resultCount(page), /총 2개 장소 결과/);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `mobile search page overflows horizontally by ${overflow}px`);
  } finally {
    await page.close();
  }
}

async function resultCount(page) {
  const locator = page.locator("[data-search-result-count]");
  await locator.waitFor({ timeout: 5000 });
  return String(await locator.textContent()).trim();
}

async function emptyCopy(page) {
  const locator = page.locator("[data-search-empty] h2");
  await locator.waitFor({ timeout: 5000 });
  return String(await locator.textContent()).trim();
}

async function waitForSelected(page, tab) {
  await page.waitForFunction(
    (tabName) => document.querySelector(`[data-search-tab="${tabName}"]`)?.getAttribute("aria-selected") === "true",
    tab,
  );
}
