import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("help search stays on help page and filters support content only", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  await assertHelpSearchResults(browser, baseUrl);
  await assertHelpSearchEmptyState(browser, baseUrl);
  await assertMobileHelpSearchLayout(browser, baseUrl);
});

async function resolveBaseUrl(t) {
  if (process.env.TICKETGROUND_TEST_BASE_URL) return process.env.TICKETGROUND_TEST_BASE_URL;
  return (await startServer(t)).baseUrl;
}

async function assertHelpSearchResults(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${baseUrl}/help`, { waitUntil: "networkidle" });
    await page.getByLabel("고객센터 검색어").fill("취소");
    await page.getByRole("button", { name: "검색", exact: true }).click();

    assert.equal(new URL(page.url()).pathname, "/help");
    assert.equal(new URL(page.url()).search, "");
    assert.match(await resultCount(page), /총 2개/);
    assert.equal(await page.locator('[data-help-search-result="category"]').count(), 1);
    assert.equal(await page.locator('[data-help-search-result="faq"]').count(), 1);
    assert.ok(await page.locator("[data-help-search-results]").getByText("취소 수수료는 어디에서 확인하나요?").isVisible());
  } finally {
    await page.close();
  }
}

async function assertHelpSearchEmptyState(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${baseUrl}/help`, { waitUntil: "networkidle" });
    await page.getByLabel("고객센터 검색어").fill("레미제라블");
    await page.getByRole("button", { name: "검색", exact: true }).click();

    assert.equal(new URL(page.url()).pathname, "/help");
    assert.match(await emptyCopy(page), /"레미제라블"에 대한 고객센터 결과가 없습니다\./);
    const showSearchLink = page.getByRole("link", { name: "공연 검색에서 찾아보기", exact: true });
    assert.match(await showSearchLink.getAttribute("href"), /\/contents\/search\?q=/);
  } finally {
    await page.close();
  }
}

async function assertMobileHelpSearchLayout(browser, baseUrl) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });
  try {
    await page.goto(`${baseUrl}/help`, { waitUntil: "networkidle" });
    const submitBox = await page.locator("[data-help-search-submit]").boundingBox();
    assert.ok(submitBox && submitBox.height >= 44, `help search button too short: ${submitBox?.height}`);

    await page.getByLabel("고객센터 검색어").fill("입장");
    await page.getByRole("button", { name: "검색", exact: true }).tap();
    assert.equal(new URL(page.url()).pathname, "/help");
    assert.match(await resultCount(page), /총 5개/);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `mobile help search overflows horizontally by ${overflow}px`);
  } finally {
    await page.close();
  }
}

async function resultCount(page) {
  const locator = page.locator("[data-help-search-count]");
  await locator.waitFor({ timeout: 5000 });
  return String(await locator.textContent()).trim();
}

async function emptyCopy(page) {
  const locator = page.locator("[data-help-search-empty] p").first();
  await locator.waitFor({ timeout: 5000 });
  return String(await locator.textContent()).trim();
}
