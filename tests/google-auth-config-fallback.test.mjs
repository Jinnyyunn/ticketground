import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const GOOGLE_ENV_KEYS = [
  "NODE_ENV",
  "TIG_GOOGLE_AUTH_TEST_MODE",
  "TIG_GOOGLE_QA_MOCK_ENABLED",
  "TIG_GOOGLE_CLIENT_ID",
  "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
  "NEXT_PUBLIC_GOOGLE_QA_MOCK_ENABLED",
  "NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS",
];

function replaceGoogleEnv(t, nextValues) {
  const previousValues = new Map(GOOGLE_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of GOOGLE_ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(nextValues)) process.env[key] = value;
  t.after(() => {
    for (const key of GOOGLE_ENV_KEYS) {
      const previousValue = previousValues.get(key);
      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    }
  });
}

async function googleLogoFills(locator) {
  return locator.locator("svg path").evaluateAll((paths) => paths.map((path) => path.getAttribute("fill")));
}

async function forceDarkTheme(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("ticketground:theme", "dark");
    document.documentElement.classList.add("dark");
    document.documentElement.dataset.theme = "dark";
  });
}

async function buttonBackgroundColor(locator) {
  return locator.evaluate((button) => window.getComputedStyle(button).backgroundColor);
}

test("login page keeps empty Google config disabled in production without QA mock mode", async (t) => {
  replaceGoogleEnv(t, { NODE_ENV: "production" });
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    await forceDarkTheme(page);
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    const googleButton = page.getByRole("button", { name: "Google 계정으로 로그인하기", exact: true });
    await googleButton.waitFor({ timeout: 5000 });

    assert.equal(await googleButton.isEnabled(), false);
    assert.equal(await buttonBackgroundColor(googleButton), "rgb(255, 255, 255)");
    assert.equal(await page.locator("[data-google-client-id='']").count(), 1);
    assert.deepEqual(await googleLogoFills(googleButton), ["#4285F4", "#34A853", "#FBBC05", "#EA4335"]);
    assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")), null);
  } finally {
    await page.close();
  }
});

test("login page uses a clickable Google QA mock fallback when public Google config is empty", async (t) => {
  replaceGoogleEnv(t, { TIG_GOOGLE_QA_MOCK_ENABLED: "1" });
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    await forceDarkTheme(page);
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    const googleButton = page.getByRole("button", { name: "Google 계정으로 로그인하기", exact: true });
    await googleButton.waitFor({ timeout: 5000 });

    assert.equal(await googleButton.isEnabled(), true);
    assert.equal(await buttonBackgroundColor(googleButton), "rgb(255, 255, 255)");
    assert.deepEqual(await googleLogoFills(googleButton), ["#4285F4", "#34A853", "#FBBC05", "#EA4335"]);
    await googleButton.click();
    await page.getByLabel("닉네임").waitFor({ timeout: 5000 });
    assert.equal(await page.getByLabel("닉네임").inputValue(), "민서");
    assert.equal(await page.getByText("세션 상태", { exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")), "user_fan_a");
  } finally {
    await page.close();
  }
});
