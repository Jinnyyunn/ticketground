import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("closed issue regressions stay fixed in the rendered frontend", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  // assertHomeDesktopResaleMenu/assertHomeMobileIssueFixes intentionally
  // removed: "/" on this branch is the seller portal, not the consumer
  // homepage those checks depended on (resale menu, genre section, etc.).
  await assertOpenCalendarMobileSpacing(browser, baseUrl);
  await assertMypageOfficialResaleAction(browser, baseUrl);
  await assertQueueProgression(browser, baseUrl);
  await assertBookingTimerExpiry(browser, baseUrl);
});

async function resolveBaseUrl(t) {
  if (process.env.TICKETGROUND_TEST_BASE_URL) return process.env.TICKETGROUND_TEST_BASE_URL;
  return (await startServer(t)).baseUrl;
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

async function assertMypageOfficialResaleAction(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  try {
    await page.goto(`${baseUrl}/mypage`, { waitUntil: "networkidle" });

    const main = page.locator("main#content");
    const resaleLinks = main.getByRole("link", { name: /공식 재판매/ });
    await resaleLinks.first().waitFor({ timeout: 5000 });
    assert.ok(await resaleLinks.count() >= 2);
    assert.equal(await main.getByRole("link", { name: "양도", exact: true }).count(), 0);
    assert.equal(await main.locator('a[href^="/transfer"]').count(), 0);
  } finally {
    await page.close();
  }
}

async function assertQueueProgression(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  try {
    let navigationCount = 0;
    const documentRequests = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigationCount += 1;
    });
    page.on("request", (request) => {
      if (request.resourceType() === "document") documentRequests.push(request.url());
    });

    await page.goto(`${baseUrl}/queue/les-miserables?testMode=fast`, { waitUntil: "networkidle" });
    navigationCount = 0;
    const initialDocumentCount = documentRequests.length;

    const firstAhead = await numericText(page.locator("[data-queue-ahead]"));
    await page.waitForTimeout(900);
    const secondAhead = await numericText(page.locator("[data-queue-ahead]"));
    assert.ok(secondAhead < firstAhead, `queue did not decrease: ${firstAhead} -> ${secondAhead}`);

    await page.waitForURL(/\/booking\/les-miserables/, { timeout: 9000 });
    assert.ok(navigationCount <= 2, `unexpected full navigations: ${navigationCount}`);
    const bookingDocumentRequests = documentRequests.slice(initialDocumentCount).filter((url) => url.includes("/booking/les-miserables"));
    assert.equal(bookingDocumentRequests.length, 0, `booking transition used document request: ${bookingDocumentRequests.join(" | ")}`);
    assert.notEqual((await page.locator("[data-booking-timer]").textContent())?.trim(), "00:00");
    assert.equal(await page.locator("[data-booking-expired]").count(), 0);
    assert.equal(await page.getByRole("button", { name: "좌석 선택으로 이동" }).isDisabled(), false);
  } finally {
    await page.close();
  }
}

async function assertBookingTimerExpiry(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  try {
    const documentRequests = [];
    page.on("request", (request) => {
      if (request.resourceType() === "document") documentRequests.push(request.url());
    });

    await page.goto(`${baseUrl}/booking/les-miserables?date=2026.05.13&time=19%3A30&timer=1`, { waitUntil: "networkidle" });
    const initialDocumentCount = documentRequests.length;

    await page.locator("[data-booking-expired]").waitFor({ timeout: 4000 });
    assert.equal((await page.locator("[data-booking-timer]").textContent())?.trim(), "00:00");
    assert.equal(new URL(page.url()).pathname, "/booking/les-miserables");
    assert.equal(documentRequests.length, initialDocumentCount, `timer expiry triggered document request: ${documentRequests.join(" | ")}`);
    assert.equal(await page.getByRole("button", { name: "좌석 선택으로 이동" }).isDisabled(), true);
    assert.match((await page.getByRole("link", { name: "다시 예매하기" }).getAttribute("href")) ?? "", /\/queue\/les-miserables/);
  } finally {
    await page.close();
  }
}

async function numericText(locator) {
  const text = await locator.textContent();
  return Number(String(text ?? "").replace(/[^\d]/g, ""));
}
