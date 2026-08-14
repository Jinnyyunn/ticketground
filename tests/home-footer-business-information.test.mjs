import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("homepage footer exposes the approved Ticketground business contact details", async (t) => {
  // Given
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true });
  t.after(() => page.close());

  // When
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const footer = page.locator("footer");
  await footer.scrollIntoViewIfNeeded();

  // Then
  await footer.getByRole("heading", { name: "티켓그라운드 사업자 정보" }).waitFor({ timeout: 5000 });
  await footer.getByText("주소 : 경기도 고양시 주교동 독곶이길 117", { exact: true }).waitFor();
  await footer.getByText("대표 : 윤진영", { exact: true }).waitFor();
  assert.equal(await footer.getByText("대표이사 : 윤진영", { exact: true }).count(), 0);
  await footer.getByText("사업자등록번호 : 527-44-01245", { exact: true }).waitFor();
  const email = footer.getByRole("link", { name: "이메일 : tigmaster@ticketground.co.kr" });
  assert.equal(await email.getAttribute("href"), "mailto:tigmaster@ticketground.co.kr");
});

test("mobile footer copyright remains readable beside the fixed back-to-top button", async (t) => {
  // Given
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true });
  t.after(() => page.close());

  // When
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("footer").scrollIntoViewIfNeeded();
  const scrollTopButton = page.getByRole("button", { name: "맨 위로 이동" });
  await scrollTopButton.waitFor();

  // Then
  const copyrightRects = await page.locator("footer").getByText(/^© Ticketground Inc\./).evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return Array.from(range.getClientRects(), (rect) => ({
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      top: rect.top,
    }));
  });
  const buttonBox = await scrollTopButton.boundingBox();
  assert.ok(buttonBox);
  assert.ok(
    copyrightRects.every((rect) =>
      rect.right <= buttonBox.x ||
      rect.left >= buttonBox.x + buttonBox.width ||
      rect.bottom <= buttonBox.y ||
      rect.top >= buttonBox.y + buttonBox.height),
    `the fixed back-to-top button must not cover any copyright text: ${JSON.stringify({ buttonBox, copyrightRects })}`,
  );
});

test("shared Korean footer routes expose the approved business information block", async (t) => {
  // Given
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true });
  t.after(() => page.close());

  // When
  await page.goto(`${baseUrl}/company`, { waitUntil: "networkidle" });
  const footer = page.locator("footer");

  // Then
  await footer.getByRole("heading", { name: "티켓그라운드 사업자 정보" }).waitFor();
  const email = footer.getByRole("link", { name: "이메일 : tigmaster@ticketground.co.kr" });
  assert.equal(await email.getAttribute("href"), "mailto:tigmaster@ticketground.co.kr");
});

test("localized homepages do not mix Korean business labels into translated footers", async (t) => {
  // Given
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true });
  t.after(() => page.close());

  for (const locale of ["en", "ja", "zh-CN"]) {
    // When
    await page.goto(`${baseUrl}/${locale}`, { waitUntil: "networkidle" });

    // Then
    assert.equal(await page.getByRole("heading", { name: "티켓그라운드 사업자 정보" }).count(), 0);
  }
});
