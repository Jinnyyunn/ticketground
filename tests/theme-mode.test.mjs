import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const themeStorageKey = "ticketground:theme";

test("desktop theme switch preserves signed-out header behavior", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const utilityBar = page.locator("header > div").first();
    await utilityBar.getByRole("link", { name: "고객센터", exact: true }).waitFor({ timeout: 5000 });
    await utilityBar.getByRole("link", { name: "로그인", exact: true }).waitFor({ timeout: 5000 });
    await utilityBar.getByRole("link", { name: "회원가입", exact: true }).waitFor({ timeout: 5000 });

    const themeSwitch = utilityBar.getByRole("switch", { name: "다크 모드 켜기", exact: true });
    await themeSwitch.waitFor({ timeout: 5000 });
    assert.equal(await themeSwitch.getAttribute("aria-checked"), "false");
    assert.equal(await utilityBar.getByRole("link", { name: "MY", exact: true }).count(), 0);
    assert.equal(await page.locator("header").locator('a[href="/mypage"]').count(), 0);
  } finally {
    await context.close();
  }
});

test("desktop theme switch persists explicit dark mode after reload", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" });
  await context.addInitScript(() => {
    window.localStorage.setItem("ticketground:session-user-id", "user_fan_a");
    window.localStorage.removeItem("ticketground:demo-auth-state");
  });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const utilityBar = page.locator("header > div").first();
    await utilityBar.getByRole("link", { name: "MY", exact: true }).waitFor({ timeout: 5000 });
    await utilityBar.getByRole("button", { name: "로그아웃", exact: true }).waitFor({ timeout: 5000 });

    const themeSwitch = utilityBar.getByRole("switch", { name: "다크 모드 켜기", exact: true });
    await themeSwitch.click();
    await page.waitForFunction((key) => window.localStorage.getItem(key) === "dark", themeStorageKey);
    assert.equal(await page.evaluate((key) => window.localStorage.getItem(key), themeStorageKey), "dark");
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), true);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");

    await page.reload({ waitUntil: "networkidle" });
    const persistedSwitch = utilityBar.getByRole("switch", { name: "라이트 모드 켜기", exact: true });
    await persistedSwitch.waitFor({ timeout: 5000 });
    assert.equal(await persistedSwitch.getAttribute("aria-checked"), "true");
    assert.equal(await page.evaluate((key) => window.localStorage.getItem(key), themeStorageKey), "dark");
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), true);
  } finally {
    await context.close();
  }
});

test("mobile drawer exposes theme switch without signed-in account links", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: "light", isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "전체 메뉴 열기", exact: true }).click();

    const mobileUtilityNav = page.getByRole("navigation", { name: "모바일 유틸리티" });
    await mobileUtilityNav.getByRole("link", { name: "로그인", exact: true }).waitFor({ timeout: 5000 });
    const themeSwitch = mobileUtilityNav.getByRole("switch", { name: "다크 모드 켜기", exact: true });
    await themeSwitch.waitFor({ timeout: 5000 });
    assert.equal(await mobileUtilityNav.getByRole("link", { name: "MY", exact: true }).count(), 0);
    assert.equal(await mobileUtilityNav.locator('a[href="/mypage"]').count(), 0);
  } finally {
    await context.close();
  }
});

test("system theme follows color scheme changes without storing a preference", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    assert.equal(await page.evaluate((key) => window.localStorage.getItem(key), themeStorageKey), null);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), false);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light");

    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
    await page.locator("header > div").first().getByRole("switch", { name: "라이트 모드 켜기", exact: true }).waitFor({ timeout: 5000 });
    assert.equal(await page.evaluate((key) => window.localStorage.getItem(key), themeStorageKey), null);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");

    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(() => !document.documentElement.classList.contains("dark"));
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light");
  } finally {
    await context.close();
  }
});

async function resolveBaseUrl(t) {
  if (process.env.TICKETGROUND_TEST_BASE_URL) return process.env.TICKETGROUND_TEST_BASE_URL;
  return (await startServer(t)).baseUrl;
}
