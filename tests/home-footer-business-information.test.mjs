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
  await footer.getByText("대표이사 : 윤진영", { exact: true }).waitFor();
  await footer.getByText("사업자등록번호 : 527-44-01245", { exact: true }).waitFor();
  const email = footer.getByRole("link", { name: "이메일 : tigmaster@ticketground.co.kr" });
  assert.equal(await email.getAttribute("href"), "mailto:tigmaster@ticketground.co.kr");
});

test("shared footer routes do not expose the homepage business information block", async (t) => {
  // Given
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true });
  t.after(() => page.close());

  // When
  await page.goto(`${baseUrl}/contents/search`, { waitUntil: "networkidle" });

  // Then
  assert.equal(await page.getByRole("heading", { name: "티켓그라운드 사업자 정보" }).count(), 0);
});
