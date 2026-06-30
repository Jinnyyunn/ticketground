import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);

function optionValue(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args.at(index + 1);
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

const baseUrl = optionValue("--base-url", "http://127.0.0.1:4500");
const evidenceDir = optionValue("--evidence-dir", ".omo/evidence/open-issues-visual-qa");
const reportPath = optionValue("--report", path.join(evidenceDir, "report.json"));

const report = {
  startedAt: new Date().toISOString(),
  baseUrl,
  checks: [],
  screenshots: [],
};

await mkdir(evidenceDir, { recursive: true });

async function screenshot(page, name) {
  const file = path.join(evidenceDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(file);
  return file;
}

async function record(name, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn();
    report.checks.push({ name, status: "PASS", durationMs: Date.now() - startedAt, details });
  } catch (error) {
    report.checks.push({
      name,
      status: "FAIL",
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const browser = await chromium.launch({ channel: "chrome", headless: true });

try {
  await record("home desktop exposes ticket resale header menu", async () => {
    const page = await browser.newPage({ viewport: { width: 1293, height: 1043 }, deviceScaleFactor: 1 });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await expectNoConsoleError(page);

    const resaleMenu = page.getByRole("link", { name: "티켓 재판매", exact: true });
    await resaleMenu.waitFor({ timeout: 5000 });
    await expectVisible(resaleMenu);
    const resaleMenuCount = await resaleMenu.count();
    await screenshot(page, "home-desktop-resale-menu");
    await page.close();
    return { resaleMenuCount };
  });

  await record("home mobile official resale, genre text, and compact ticket open cards", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await expectNoConsoleError(page);

    const resaleSection = page.locator('[data-section="official-resale"]');
    await resaleSection.waitFor({ timeout: 5000 });
    await assertVisibleLink(resaleSection, "공식 재판매", /\/resale/);

    const genreSubtitle = page.locator('[data-section="genre-recommendations"] [data-section-subtitle]');
    await assertText(genreSubtitle, "콘서트·뮤지컬·연극·클래식을 비교하세요.");
    const genreBox = await genreSubtitle.boundingBox();
    assert.ok(genreBox && genreBox.height <= 42, `genre subtitle wraps too tall: ${genreBox?.height}`);

    const ticketOpenCard = page.locator('[data-card="ticket-open"]').first();
    const ticketOpenBox = await ticketOpenCard.boundingBox();
    assert.ok(ticketOpenBox && ticketOpenBox.height <= 190, `ticket-open card too tall on mobile: ${ticketOpenBox?.height}`);
    await screenshot(page, "home-mobile");
    await page.close();
    return { genreSubtitleHeight: genreBox?.height, ticketOpenCardHeight: ticketOpenBox?.height };
  });

  await record("open calendar mobile cards stay compact", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
    await page.goto(`${baseUrl}/open`, { waitUntil: "networkidle" });
    await expectNoConsoleError(page);

    const imminentCard = page.locator('[data-open-imminent-card]').first();
    await imminentCard.waitFor({ timeout: 5000 });
    const box = await imminentCard.boundingBox();
    assert.ok(box && box.height <= 62, `open imminent card too tall on mobile: ${box?.height}`);
    await screenshot(page, "open-mobile");
    await page.close();
    return { cardHeight: box?.height };
  });

  await record("mypage unifies resale and transfer actions", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
    await page.goto(`${baseUrl}/mypage`, { waitUntil: "networkidle" });
    await expectNoConsoleError(page);

    const main = page.locator("main#content");
    await assertHidden(main.getByRole("link", { name: "공식 재판매", exact: true }));
    await assertHidden(main.getByRole("link", { name: "재판매", exact: true }));
    const transferLinks = await main.getByRole("link", { name: "양도", exact: true }).count();
    assert.ok(transferLinks >= 1, "ticket cards should expose at least one unified transfer link");
    await screenshot(page, "mypage-mobile");
    await page.close();
    return { transferLinks };
  });

  await record("queue decreases and reaches booking without full page reload", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
    let navigationCount = 0;
    const documentRequests = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) navigationCount += 1;
    });
    page.on("request", (request) => {
      if (request.resourceType() === "document") documentRequests.push(request.url());
    });
    await page.goto(`${baseUrl}/queue/les-miserables?testMode=fast`, { waitUntil: "networkidle" });
    await expectNoConsoleError(page);
    navigationCount = 0;
    const initialDocumentCount = documentRequests.length;

    const firstAhead = await numericText(page.locator("[data-queue-ahead]"));
    await page.waitForTimeout(900);
    const secondAhead = await numericText(page.locator("[data-queue-ahead]"));
    assert.ok(secondAhead < firstAhead, `queue did not decrease: ${firstAhead} -> ${secondAhead}`);
    await page.waitForURL(/\/booking\/les-miserables/, { timeout: 9000 });
    assert.ok(navigationCount <= 2, `unexpected full navigations while queue progressed: ${navigationCount}`);
    const bookingDocumentRequests = documentRequests.slice(initialDocumentCount).filter((url) => url.includes("/booking/les-miserables"));
    assert.equal(bookingDocumentRequests.length, 0, `booking transition used document request: ${bookingDocumentRequests.join(" | ")}`);
    await screenshot(page, "queue-mobile-complete");
    await page.close();
    return { firstAhead, secondAhead, navigationCount, documentRequests, bookingDocumentRequests };
  });

  await record("booking timer expiry shows expired state without reload", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
    const documentRequests = [];
    page.on("request", (request) => {
      if (request.resourceType() === "document") documentRequests.push(request.url());
    });
    await page.goto(`${baseUrl}/booking/les-miserables?date=2026.05.13&time=19%3A30&timer=1`, { waitUntil: "networkidle" });
    await expectNoConsoleError(page);
    const initialDocumentCount = documentRequests.length;

    const expiredState = page.locator("[data-booking-expired]");
    await expiredState.waitFor({ timeout: 4000 });
    const timerText = (await page.locator("[data-booking-timer]").textContent())?.trim();
    const retryHref = await page.getByRole("link", { name: "다시 예매하기" }).getAttribute("href");
    const chooseSeatsDisabled = await page.getByRole("button", { name: "좌석 선택으로 이동" }).isDisabled();
    assert.equal(timerText, "00:00");
    assert.equal(documentRequests.length, initialDocumentCount, `timer expiry triggered document request: ${documentRequests.join(" | ")}`);
    assert.equal(chooseSeatsDisabled, true);
    assert.match(retryHref ?? "", /\/queue\/les-miserables/);
    const overflowX = await pageOverflowX(page);
    assert.equal(overflowX, 0, `timer expiry page has horizontal overflow: ${overflowX}`);
    const expiredVisible = await expiredState.isVisible();
    await screenshot(page, "booking-timer-expired");
    await page.close();
    return { timerText, expiredVisible, retryHref, chooseSeatsDisabled, documentRequests, overflowX };
  });
} finally {
  await browser.close();
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

const failures = report.checks.filter((check) => check.status !== "PASS");
if (failures.length > 0) {
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(report, null, 2));
}

async function numericText(locator) {
  const text = await locator.textContent();
  return Number(String(text ?? "").replace(/[^\d]/g, ""));
}

async function pageOverflowX(page) {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
}

async function assertVisibleLink(scope, name, hrefPattern) {
  const link = scope.getByRole("link", { name });
  await link.waitFor({ timeout: 5000 });
  await expectVisible(link);
  const href = await link.getAttribute("href");
  assert.match(href ?? "", hrefPattern);
}

async function assertText(locator, expected) {
  await locator.waitFor({ timeout: 5000 });
  const text = (await locator.textContent())?.trim();
  assert.equal(text, expected);
}

async function assertHidden(locator) {
  assert.equal(await locator.count(), 0);
}

async function expectVisible(locator) {
  assert.equal(await locator.isVisible(), true);
}

async function expectNoConsoleError(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.waitForTimeout(50);
  assert.deepEqual(errors, []);
}
