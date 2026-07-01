import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("selected performance enters queue and reaches booking without repeated waiting loop", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  await assertDetailSelectionToFastBooking(browser, baseUrl);
  await assertNormalQueueEventuallyReachesBooking(browser, baseUrl);
});

async function assertDetailSelectionToFastBooking(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 }, deviceScaleFactor: 1 });
  const navigations = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });

  try {
    await page.goto(`${baseUrl}/goods/les-miserables`, { waitUntil: "networkidle" });
    const panel = page.getByTestId("detail-booking-panel");
    await panel.getByRole("button", { name: /5월 14일/ }).click();
    await panel.getByRole("button", { name: /19:30/ }).click();

    const queueHref = await panel.getByTestId("detail-queue-link").getAttribute("href");
    assert.equal(queueHref, "/queue/les-miserables?date=2026.05.14&time=19%3A30");

    await page.goto(`${baseUrl}${queueHref}&testMode=fast`, { waitUntil: "networkidle" });
    const firstAhead = await numericText(page.locator("[data-queue-ahead]"));
    await page.waitForTimeout(900);
    const secondAhead = await numericText(page.locator("[data-queue-ahead]"));
    assert.ok(secondAhead < firstAhead, `fast queue did not decrease: ${firstAhead} -> ${secondAhead}`);

    await page.waitForURL(/\/booking\/les-miserables\?date=2026\.05\.14&time=19%3A30/, { timeout: 12000 });
    assert.equal(new URL(page.url()).pathname, "/booking/les-miserables");
    assert.equal(new URL(page.url()).searchParams.get("date"), "2026.05.14");
    assert.equal(new URL(page.url()).searchParams.get("time"), "19:30");
    assert.ok(await page.getByText("2026.05.14").first().isVisible());
    assert.ok(await page.getByText("19:30").first().isVisible());

    const queueNavigations = navigations.filter((url) => url.includes("/queue/les-miserables"));
    const bookingNavigations = navigations.filter((url) => url.includes("/booking/les-miserables"));
    const uniqueQueueNavigations = [...new Set(queueNavigations)];
    const firstBookingIndex = navigations.findIndex((url) => url.includes("/booking/les-miserables"));
    assert.equal(uniqueQueueNavigations.length, 1, `queue URL changed repeatedly: ${uniqueQueueNavigations.join(" | ")}`);
    assert.ok(!navigations.slice(firstBookingIndex + 1).some((url) => url.includes("/queue/les-miserables")), `queue repeated after booking: ${navigations.join(" | ")}`);
    assert.equal(bookingNavigations.length, 1, `booking navigation count mismatch: ${bookingNavigations.join(" | ")}`);
  } finally {
    await page.close();
  }
}

async function assertNormalQueueEventuallyReachesBooking(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  try {
    await page.goto(`${baseUrl}/queue/les-miserables?date=2026.05.13&time=19%3A30`, { waitUntil: "networkidle" });
    const firstAhead = await numericText(page.locator("[data-queue-ahead]"));
    await page.waitForTimeout(1200);
    const secondAhead = await numericText(page.locator("[data-queue-ahead]"));
    assert.ok(secondAhead < firstAhead, `normal queue did not decrease: ${firstAhead} -> ${secondAhead}`);

    await page.waitForURL(/\/booking\/les-miserables\?date=2026\.05\.13&time=19%3A30/, { timeout: 38000 });
    assert.equal(new URL(page.url()).pathname, "/booking/les-miserables");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `mobile booking page overflows horizontally by ${overflow}px`);
  } finally {
    await page.close();
  }
}

async function numericText(locator) {
  const text = await locator.textContent();
  return Number(String(text ?? "").replace(/[^\d]/g, ""));
}
