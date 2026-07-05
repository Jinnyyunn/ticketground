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

test("desktop explicit dark preference survives later system color scheme changes", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const utilityBar = page.locator("header > div").first();
    await utilityBar.getByRole("switch", { name: "다크 모드 켜기", exact: true }).click();
    await page.waitForFunction((key) => window.localStorage.getItem(key) === "dark", themeStorageKey);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");

    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForFunction(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
    await settleAnimationFrame(page);
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(() => !window.matchMedia("(prefers-color-scheme: dark)").matches);
    await settleAnimationFrame(page);

    assert.equal(await page.evaluate((key) => window.localStorage.getItem(key), themeStorageKey), "dark");
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), true);
    assert.equal(await utilityBar.getByRole("switch", { name: "라이트 모드 켜기", exact: true }).getAttribute("aria-checked"), "true");
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

test("mobile signed-in drawer keeps auth action contrast in dark mode", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: "dark", isMobile: true });
  await context.addInitScript((key) => {
    window.localStorage.setItem("ticketground:session-user-id", "user_fan_a");
    window.localStorage.setItem(key, "dark");
    window.localStorage.removeItem("ticketground:demo-auth-state");
  }, themeStorageKey);
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "전체 메뉴 열기", exact: true }).click();

    const logoutButton = page.getByRole("navigation", { name: "모바일 유틸리티" }).getByRole("button", { name: "로그아웃", exact: true });
    await logoutButton.waitFor({ timeout: 5000 });
    const styles = await logoutButton.evaluate((element) => {
      const computedStyle = window.getComputedStyle(element);
      return {
        backgroundColor: computedStyle.backgroundColor,
        color: computedStyle.color,
      };
    });

    assert.ok(getContrastRatio(styles.color, styles.backgroundColor) >= 4.5);
  } finally {
    await context.close();
  }
});

test("mobile signed-out drawer keeps login action contrast in dark mode", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: "dark", isMobile: true });
  await context.addInitScript((key) => {
    window.localStorage.removeItem("ticketground:session-user-id");
    window.localStorage.setItem("ticketground:demo-auth-state", "signed-out");
    window.localStorage.setItem(key, "dark");
  }, themeStorageKey);
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "전체 메뉴 열기", exact: true }).click();

    const loginLink = page.getByRole("navigation", { name: "모바일 유틸리티" }).getByRole("link", { name: "로그인", exact: true });
    await loginLink.waitFor({ timeout: 5000 });
    const styles = await loginLink.evaluate((element) => {
      const computedStyle = window.getComputedStyle(element);
      return {
        backgroundColor: computedStyle.backgroundColor,
        color: computedStyle.color,
      };
    });

    assert.ok(getContrastRatio(styles.color, styles.backgroundColor) >= 4.5);
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

async function settleAnimationFrame(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function getContrastRatio(foregroundColor, backgroundColor) {
  const foregroundLuminance = getRelativeLuminance(parseRgbColor(foregroundColor));
  const backgroundLuminance = getRelativeLuminance(parseRgbColor(backgroundColor));
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function getRelativeLuminance(rgb) {
  const [red, green, blue] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function parseRgbColor(color) {
  const channels = color.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
  assert.equal(channels?.length, 3);
  return channels;
}
