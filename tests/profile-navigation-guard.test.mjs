import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

const sessionStorageKey = "ticketground:session-user-id";
const signedOutStorageKey = "ticketground:demo-auth-state";

async function createIncompleteProfile(baseUrl) {
  const response = await api(baseUrl, "/api/auth/google", {
    credential: GOOGLE_AUTH_TEST_CREDENTIAL,
  });
  assert.equal(response.data.profileConfirmed, false);
  return response.data.id;
}

async function newPageWithSession(browser, userId) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
    window.localStorage.removeItem("ticketground:demo-auth-state");
  }, { key: sessionStorageKey, value: userId });
  return { context, page: await context.newPage() };
}

test("incomplete profiles cannot reach home by direct URL or refresh", async (t) => {
  configureGoogleEnv(t, true);
  const { baseUrl } = await startServer(t);
  const userId = await createIncompleteProfile(baseUrl);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const { context, page } = await newPageWithSession(browser, userId);
  t.after(() => context.close());

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(`${baseUrl}/login`, { timeout: 5000 });
  await page.getByLabel("닉네임").waitFor({ timeout: 5000 });

  const refreshSession = await newPageWithSession(browser, userId);
  t.after(() => refreshSession.context.close());
  await refreshSession.page.goto(`${baseUrl}/`, { waitUntil: "commit" });
  assert.equal(new URL(refreshSession.page.url()).pathname, "/");
  await refreshSession.page.reload({ waitUntil: "domcontentloaded" });
  await refreshSession.page.waitForURL(`${baseUrl}/login`, { timeout: 5000 });
  assert.equal(
    await refreshSession.page.evaluate((key) => window.localStorage.getItem(key), sessionStorageKey),
    userId,
  );
});

test("browser Back cannot restore home while the profile remains incomplete", async (t) => {
  configureGoogleEnv(t, true);
  const { baseUrl } = await startServer(t);
  const userId = await createIncompleteProfile(baseUrl);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  t.after(() => context.close());
  const page = await context.newPage();

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ key, value }) => {
    window.localStorage.setItem(key, value);
    window.localStorage.removeItem("ticketground:demo-auth-state");
  }, { key: sessionStorageKey, value: userId });
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("닉네임").waitFor({ timeout: 5000 });

  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForURL(`${baseUrl}/login`, { timeout: 5000 });
  assert.equal(await page.getByRole("heading", { name: "간편 로그인으로 계정을 시작해 주세요" }).isVisible(), true);
});

test("completed profiles can use home without repeating profile setup", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const { context, page } = await newPageWithSession(browser, "user_fan_a");
  t.after(() => context.close());

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-section='spec-hero']").waitFor({ timeout: 5000 });
  assert.equal(new URL(page.url()).pathname, "/");
  assert.equal(await page.getByLabel("닉네임").count(), 0);
});

test("stale stored sessions are cleared without blocking anonymous home access", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const { context, page } = await newPageWithSession(browser, "not-a-real-user");
  t.after(() => context.close());

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-section='spec-hero']").waitFor({ timeout: 5000 });
  await page.waitForFunction((key) => window.localStorage.getItem(key) === null, sessionStorageKey);
  assert.equal(new URL(page.url()).pathname, "/");
  assert.equal(await page.evaluate((key) => window.localStorage.getItem(key), signedOutStorageKey), "signed-out");
});
