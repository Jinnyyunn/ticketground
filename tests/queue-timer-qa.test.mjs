import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("queue transition and booking timer expiry preserve client-side state", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  await assertFastQueueClientTransition(browser, baseUrl);
  await assertNormalQueueProgressesInPlace(browser, baseUrl);
  await assertBookingTimerExpiresInPlace(browser, baseUrl);
});

async function assertFastQueueClientTransition(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const documentRequests = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") documentRequests.push(request.url());
  });

  try {
    await page.goto(`${baseUrl}/queue/les-miserables?date=2026.05.13&time=19%3A30&testMode=fast`, { waitUntil: "networkidle" });
    const initialDocumentCount = documentRequests.length;
    const firstAhead = await numericText(page.locator("[data-queue-ahead]"));
    await page.waitForTimeout(900);
    const secondAhead = await numericText(page.locator("[data-queue-ahead]"));

    assert.ok(secondAhead < firstAhead, `fast queue did not decrease: ${firstAhead} -> ${secondAhead}`);
    await page.waitForURL(/\/booking\/les-miserables/, { timeout: 9000 });
    const bookingDocumentRequests = documentRequests.slice(initialDocumentCount).filter((url) => url.includes("/booking/les-miserables"));
    assert.equal(bookingDocumentRequests.length, 0, `fast queue used a document request for booking: ${bookingDocumentRequests.join(" | ")}`);
    assert.notEqual((await page.locator("[data-booking-timer]").textContent())?.trim(), "00:00");
    assert.equal(await page.locator("[data-booking-expired]").count(), 0);
    assert.equal(await page.getByRole("button", { name: "좌석 선택으로 이동" }).isDisabled(), false);
  } finally {
    await page.close();
  }
}

async function assertNormalQueueProgressesInPlace(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const documentRequests = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") documentRequests.push(request.url());
  });

  try {
    await page.goto(`${baseUrl}/queue/les-miserables?date=2026.05.13&time=19%3A30`, { waitUntil: "networkidle" });
    const initialDocumentCount = documentRequests.length;
    const firstAhead = await numericText(page.locator("[data-queue-ahead]"));
    await page.waitForTimeout(1200);
    const secondAhead = await numericText(page.locator("[data-queue-ahead]"));

    assert.ok(secondAhead < firstAhead, `normal queue did not decrease: ${firstAhead} -> ${secondAhead}`);
    assert.equal(documentRequests.length, initialDocumentCount, `normal queue triggered a document request: ${documentRequests.join(" | ")}`);
    assert.equal(new URL(page.url()).pathname, "/queue/les-miserables");
  } finally {
    await page.close();
  }
}

async function assertBookingTimerExpiresInPlace(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const documentRequests = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document") documentRequests.push(request.url());
  });

  try {
    await page.goto(`${baseUrl}/booking/les-miserables?date=2026.05.13&time=19%3A30&timer=1`, { waitUntil: "networkidle" });
    const initialDocumentCount = documentRequests.length;

    await page.locator("[data-booking-expired]").waitFor({ timeout: 4000 });
    assert.equal((await page.locator("[data-booking-timer]").textContent())?.trim(), "00:00");
    assert.equal(documentRequests.length, initialDocumentCount, `timer expiry triggered a document request: ${documentRequests.join(" | ")}`);
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
