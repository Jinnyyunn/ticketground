import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("keyboard-driven language switch on the home page navigates to /en and re-renders English content", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 } });
  t.after(() => page.close());

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const trigger = page.getByRole("combobox", { name: "언어 선택" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("option", { name: "English" }).waitFor({ state: "visible", timeout: 5000 });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  await page.waitForURL(`${baseUrl}/en`, { timeout: 5000 });
  await page.getByRole("heading", { name: "Real-time Booking Ranking TOP10" }).waitFor({ timeout: 5000 });
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
});

test("on an untranslated page, only Korean is selectable and the other locales are disabled", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 } });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/contents/shortcuts`, { waitUntil: "networkidle" });
  await page.getByRole("combobox", { name: "언어 선택" }).click();
  const englishOption = page.getByRole("option", { name: "English" });
  await englishOption.waitFor({ state: "visible", timeout: 5000 });
  await assert.equal(await englishOption.getAttribute("aria-disabled"), "true");
  await page.getByText("번역 준비 중").first().waitFor({ timeout: 5000 });
});

test("the popup opens above the mobile drawer's own stacking context, not hidden behind it", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  t.after(() => page.close());

  // Regression: the switcher's popup (a React portal) rendered at a lower
  // z-index than MobileNav's own Dialog.Popup, so opening it from inside
  // the drawer painted the option list behind the drawer panel - visually
  // indistinguishable from the tap doing nothing.
  await page.goto(`${baseUrl}/contents/shortcuts`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "전체 메뉴 열기", exact: true }).click();
  await page.getByRole("combobox", { name: "언어 선택" }).click();
  const listbox = page.getByRole("listbox");
  await listbox.waitFor({ state: "visible", timeout: 5000 });
  const optionTexts = await page.getByRole("option").allTextContents();
  assert.deepEqual(optionTexts, ["한국어", "English번역 준비 중", "日本語번역 준비 중", "简体中文번역 준비 중"]);

  const listboxZ = await listbox.evaluate((el) => Number(getComputedStyle(el.closest('[class*="z-"]') ?? el).zIndex) || 0);
  assert.ok(listboxZ >= 100, `expected the popup's stacking context (z=${listboxZ}) to clear the drawer's z-90 popup`);
});

test("the header logo, footer logo, and Home nav link stay on /en instead of dropping back to Korean", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 } });
  t.after(() => page.close());

  // Regression: the brand logo (header + footer) and the category nav's
  // "Home" link were hardcoded to href="/" instead of being routed through
  // localizeHref(locale, href), so clicking either one from a translated
  // /en, /ja, or /zh-CN page silently dropped the visitor back into
  // Korean - the exact thing 나라별 언어 적용 계획서.md 4.5 says internal
  // links must not do.
  await page.goto(`${baseUrl}/en`, { waitUntil: "networkidle" });

  const logoLinks = await page.getByRole("link", { name: "Ticketground" }).all();
  assert.ok(logoLinks.length >= 2, "expected both the header and footer brand logo links");
  for (const link of logoLinks) {
    assert.equal(await link.getAttribute("href"), "/en");
  }

  const homeLinks = await page.getByRole("link", { name: "Home", exact: true }).all();
  assert.ok(homeLinks.length > 0, "expected at least one Home category link");
  for (const link of homeLinks) {
    assert.equal(await link.getAttribute("href"), "/en");
  }

  await page.getByRole("link", { name: "Ticketground" }).first().click();
  await page.waitForURL(`${baseUrl}/en`, { timeout: 5000 });
  assert.equal(await page.locator("html").getAttribute("lang"), "en");
});

test("switching away from /en back to Korean returns to the unprefixed home URL", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 } });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/en`, { waitUntil: "networkidle" });
  await page.getByRole("combobox", { name: "Select language" }).click();
  await page.getByRole("option", { name: "한국어" }).click();

  await page.waitForURL(`${baseUrl}/`, { timeout: 5000 });
  await page.getByRole("heading", { name: "실시간 예매 랭킹 TOP10" }).waitFor({ timeout: 5000 });
});
