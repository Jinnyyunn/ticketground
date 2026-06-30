import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("closed issue regressions stay fixed in the rendered frontend", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  await assertHomeDesktopResaleMenu(browser, baseUrl);
  await assertHomeMobileIssueFixes(browser, baseUrl);
  await assertOpenCalendarMobileSpacing(browser, baseUrl);
  await assertMypageTransferAction(browser, baseUrl);
  await assertQueueProgression(browser, baseUrl);
});

async function resolveBaseUrl(t) {
  if (process.env.TICKETGROUND_TEST_BASE_URL) return process.env.TICKETGROUND_TEST_BASE_URL;
  return (await startServer(t)).baseUrl;
}

async function assertHomeDesktopResaleMenu(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 }, deviceScaleFactor: 1 });
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const resaleMenu = page.getByRole("link", { name: "티켓 재판매", exact: true });
    await resaleMenu.waitFor({ timeout: 5000 });
    assert.equal(await resaleMenu.count(), 1);
    assert.match(await resaleMenu.first().getAttribute("href"), /\/resale$/);
  } finally {
    await page.close();
  }
}

async function assertHomeMobileIssueFixes(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const resaleSection = page.locator('[data-section="official-resale"]');
    await resaleSection.waitFor({ timeout: 5000 });
    const resaleLink = resaleSection.getByRole("link", { name: "공식 재판매" });
    await resaleLink.waitFor({ timeout: 5000 });
    assert.match(await resaleLink.getAttribute("href"), /\/resale/);

    const genreSubtitle = page.locator('[data-section="genre-recommendations"] [data-section-subtitle]');
    await genreSubtitle.waitFor({ timeout: 5000 });
    assert.equal((await genreSubtitle.textContent())?.trim(), "콘서트·뮤지컬·연극·클래식을 비교하세요.");
    const genreBox = await genreSubtitle.boundingBox();
    assert.ok(genreBox && genreBox.height <= 42, `genre subtitle wraps too tall: ${genreBox?.height}`);

    const ticketOpenBox = await page.locator('[data-card="ticket-open"]').first().boundingBox();
    assert.ok(ticketOpenBox && ticketOpenBox.height <= 190, `ticket-open card too tall: ${ticketOpenBox?.height}`);
  } finally {
    await page.close();
  }
}

async function assertOpenCalendarMobileSpacing(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  try {
    await page.goto(`${baseUrl}/open`, { waitUntil: "networkidle" });

    const imminentCard = page.locator('[data-open-imminent-card]').first();
    await imminentCard.waitFor({ timeout: 5000 });
    const box = await imminentCard.boundingBox();
    assert.ok(box && box.height <= 62, `open imminent card too tall: ${box?.height}`);
  } finally {
    await page.close();
  }
}

async function assertMypageTransferAction(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  try {
    await page.goto(`${baseUrl}/mypage`, { waitUntil: "networkidle" });

    const main = page.locator("main#content");
    assert.equal(await main.getByRole("link", { name: "공식 재판매", exact: true }).count(), 0);
    assert.equal(await main.getByRole("link", { name: "재판매", exact: true }).count(), 0);
    assert.ok(await main.getByRole("link", { name: "양도", exact: true }).count() >= 1);
  } finally {
    await page.close();
  }
}

async function assertQueueProgression(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  try {
    let navigationCount = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigationCount += 1;
    });

    await page.goto(`${baseUrl}/queue/les-miserables?testMode=fast`, { waitUntil: "networkidle" });
    navigationCount = 0;

    const firstAhead = await numericText(page.locator("[data-queue-ahead]"));
    await page.waitForTimeout(900);
    const secondAhead = await numericText(page.locator("[data-queue-ahead]"));
    assert.ok(secondAhead < firstAhead, `queue did not decrease: ${firstAhead} -> ${secondAhead}`);

    await page.waitForURL(/\/booking\/les-miserables/, { timeout: 9000 });
    assert.ok(navigationCount <= 2, `unexpected full navigations: ${navigationCount}`);
  } finally {
    await page.close();
  }
}

async function numericText(locator) {
  const text = await locator.textContent();
  return Number(String(text ?? "").replace(/[^\d]/g, ""));
}
