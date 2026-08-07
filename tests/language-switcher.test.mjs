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
