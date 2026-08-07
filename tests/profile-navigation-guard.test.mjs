import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

const sessionStorageKey = "ticketground:session-user-id";
const signedOutStorageKey = "ticketground:demo-auth-state";
const sessionChangedEvent = "ticketground:session-user-changed";
const staleResponseConsumedKey = "ticketground:test:stale-response-consumed";

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

const credentialStorageKey = "ticketground:session-credential";

// Mirrors what rememberSessionUser() actually writes to localStorage after
// a real provider login - unlike newPageWithSession() (userId only, used
// throughout this file to simulate the *legacy demo* session shape), this
// is what a genuine Google/Kakao/Naver login leaves behind.
async function newPageWithCredentialedSession(browser, { userId, credential }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ key, value, credKey, credValue }) => {
    window.localStorage.setItem(key, value);
    window.localStorage.setItem(credKey, credValue);
    window.localStorage.removeItem("ticketground:demo-auth-state");
  }, { key: sessionStorageKey, value: userId, credKey: credentialStorageKey, credValue: credential });
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

test("session API failures keep the stored session and fail closed with a recovery link", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const { context, page } = await newPageWithSession(browser, "user_fan_a");
  t.after(() => context.close());
  await page.route("**/api/users/user_fan_a/session", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: {
          code: "SESSION_UNAVAILABLE",
          message: "일시적으로 세션을 확인할 수 없습니다.",
        },
      }),
    });
  });

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });

  const alert = page.locator("p[role='alert']");
  await alert.waitFor({ timeout: 5000 });
  assert.equal(await alert.textContent(), "프로필 상태를 확인할 수 없습니다. 다시 로그인해 주세요.");
  const recoveryLink = page.getByRole("link", { name: "로그인으로 이동" });
  assert.equal(await recoveryLink.getAttribute("href"), "/login");
  assert.equal(await page.locator("[data-section='spec-hero']").count(), 0);
  assert.equal(
    await page.evaluate((key) => window.localStorage.getItem(key), sessionStorageKey),
    "user_fan_a",
  );
  assert.equal(await page.evaluate((key) => window.localStorage.getItem(key), signedOutStorageKey), null);
});

test("a late missing-user response cannot clear a newer completed session", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const { context, page } = await newPageWithSession(browser, "user_fan_a");
  t.after(() => context.close());

  await page.addInitScript(({ responsePath, consumedKey }) => {
    const originalJson = window.Response.prototype.json;
    window.Response.prototype.json = async function responseJson(...args) {
      const payload = await originalJson.apply(this, args);
      if (new URL(this.url).pathname === responsePath) {
        window.setTimeout(() => window.sessionStorage.setItem(consumedKey, "1"), 0);
      }
      return payload;
    };
  }, {
    responsePath: "/api/users/user_fan_a/session",
    consumedKey: staleResponseConsumedKey,
  });

  let markFirstRequestSeen;
  const firstRequestSeen = new Promise((resolve) => {
    markFirstRequestSeen = resolve;
  });
  let releaseFirstResponse;
  const firstResponseReleased = new Promise((resolve) => {
    releaseFirstResponse = resolve;
  });
  let markFirstResponseHandled;
  const firstResponseHandled = new Promise((resolve) => {
    markFirstResponseHandled = resolve;
  });
  await page.route("**/api/users/*/session", async (route) => {
    const userId = new URL(route.request().url()).pathname.split("/").at(-2);
    if (userId !== "user_fan_a") {
      await route.continue();
      return;
    }
    markFirstRequestSeen();
    await firstResponseReleased;
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "사용자를 찾을 수 없습니다.",
        },
      }),
    });
    markFirstResponseHandled();
  });

  const navigation = page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await firstRequestSeen;
  await page.evaluate(({ key, userId, eventName }) => {
    window.localStorage.setItem(key, userId);
    window.dispatchEvent(new Event(eventName));
  }, { key: sessionStorageKey, userId: "user_fan_b", eventName: sessionChangedEvent });

  await page.locator("[data-section='spec-hero']").waitFor({ timeout: 5000 });
  releaseFirstResponse();
  await navigation;
  await firstResponseHandled;
  await page.waitForFunction(
    (consumedKey) => window.sessionStorage.getItem(consumedKey) === "1",
    staleResponseConsumedKey,
  );

  assert.equal(new URL(page.url()).pathname, "/");
  assert.equal(
    await page.evaluate((key) => window.localStorage.getItem(key), sessionStorageKey),
    "user_fan_b",
  );
  assert.equal(await page.evaluate((key) => window.localStorage.getItem(key), signedOutStorageKey), null);
  assert.equal(await page.locator("[data-section='spec-hero']").isVisible(), true);
});

test("a real logged-in session reaches home even when the legacy demo session API is disabled", async (t) => {
  // TIG_DEMO_PROFILE_API defaults to "1" in startServer() specifically so
  // the rest of this file's tests (which simulate sessions the legacy way,
  // userId-only, no credential) keep working. Forcing it off here
  // reproduces the actual dev.ticketground.co.kr environment, where a real
  // provider login was landing on "프로필 상태를 확인할 수 없습니다"
  // because getSession()/updateProfile() only ever called that demo-gated
  // route, which 404s outside dev/QA flags.
  configureGoogleEnv(t, true);
  const server = await startServer(t, { env: { TIG_DEMO_PROFILE_API: "0" } });
  const { baseUrl } = server;
  const login = await api(baseUrl, "/api/auth/google", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  assert.equal(login.data.profileConfirmed, false);
  assert.ok(login.data.credential, "a real login issues a Bearer credential");

  // Complete the profile the same way login-panel.tsx does post-fix: PATCH
  // /api/me/profile, session-authenticated, not the demo-gated POST route.
  // (api()'s test helper only ever sends GET/POST, so this needs a raw fetch.)
  const profileSaveResponse = await fetch(`${baseUrl}/api/me/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${login.data.credential}` },
    body: JSON.stringify({ name: "테스트닉네임" }),
  });
  const profileSave = await profileSaveResponse.json();
  assert.equal(profileSaveResponse.status, 200, JSON.stringify(profileSave));
  assert.equal(profileSave.data.profileConfirmed, true);

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const { context, page } = await newPageWithCredentialedSession(browser, {
    userId: login.data.id,
    credential: login.data.credential,
  });
  t.after(() => context.close());

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.locator("[data-section='spec-hero']").waitFor({ timeout: 5000 });
  assert.equal(new URL(page.url()).pathname, "/");
  assert.equal(
    await page.locator("p[role='alert']").count(),
    0,
    "home must not show the 프로필 상태를 확인할 수 없습니다 error for a genuinely logged-in, complete profile",
  );
});
