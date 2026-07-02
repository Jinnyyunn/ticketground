import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { api, startServer } from "./backend-test-utils.mjs";

const TEST_GOOGLE_CLIENT_ID = "ticketground-test-client.apps.googleusercontent.com";
const GOOGLE_AUTH_TEST_CREDENTIAL = "ticketground-google-test-credential";

function configureGoogleEnv(t, testMode) {
  const previousTestMode = process.env.TIG_GOOGLE_AUTH_TEST_MODE;
  const previousPublicClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const previousServerClientId = process.env.TIG_GOOGLE_CLIENT_ID;
  t.after(() => {
    if (previousTestMode === undefined) {
      delete process.env.TIG_GOOGLE_AUTH_TEST_MODE;
    } else {
      process.env.TIG_GOOGLE_AUTH_TEST_MODE = previousTestMode;
    }
    if (previousPublicClientId === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = previousPublicClientId;
    }
    if (previousServerClientId === undefined) {
      delete process.env.TIG_GOOGLE_CLIENT_ID;
    } else {
      process.env.TIG_GOOGLE_CLIENT_ID = previousServerClientId;
    }
  });

  if (testMode) {
    process.env.TIG_GOOGLE_AUTH_TEST_MODE = "1";
  } else {
    delete process.env.TIG_GOOGLE_AUTH_TEST_MODE;
  }
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
  process.env.TIG_GOOGLE_CLIENT_ID = TEST_GOOGLE_CLIENT_ID;
}

test("Google auth endpoint rejects the deterministic test credential when test mode is disabled", async (t) => {
  configureGoogleEnv(t, false);
  const productionLikeServer = await startServer(t);
  const disabledByDefault = await api(productionLikeServer.baseUrl, "/api/auth/google", {
    credential: GOOGLE_AUTH_TEST_CREDENTIAL
  }, 401);
  assert.equal(disabledByDefault.error.code, "GOOGLE_AUTH_INVALID");
});

test("Google auth endpoint accepts deterministic test credential only in test mode and rejects malformed credentials", async (t) => {
  configureGoogleEnv(t, true);
  const testModeServer = await startServer(t);
  const session = await api(testModeServer.baseUrl, "/api/auth/google", {
    credential: GOOGLE_AUTH_TEST_CREDENTIAL
  });
  assert.equal(session.data.id, "google_user_test");
  assert.equal(session.data.name, "Google 테스트 사용자");
  assert.equal(session.data.status, "ACTIVE");
  assert.equal(typeof session.data.trustScore, "number");

  const refreshedSession = await api(testModeServer.baseUrl, `/api/users/${session.data.id}/session`);
  assert.equal(refreshedSession.data.id, "google_user_test");
  assert.equal(refreshedSession.data.name, "Google 테스트 사용자");

  const updatedProfile = await api(testModeServer.baseUrl, `/api/users/${session.data.id}/profile`, {
    name: "구글 사용자"
  });
  assert.equal(updatedProfile.data.name, "구글 사용자");

  const malformed = await api(testModeServer.baseUrl, "/api/auth/google", {
    credential: "malformed"
  }, 401);
  assert.equal(malformed.error.code, "GOOGLE_AUTH_INVALID");
});

test("login page renders Google Identity Services wiring without removing mock login", async (t) => {
  configureGoogleEnv(t, false);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });

    const googleArea = page.locator(`[data-google-client-id="${TEST_GOOGLE_CLIENT_ID}"]`);
    await googleArea.waitFor({ timeout: 5000 });
    assert.equal(await googleArea.getAttribute("data-google-scope"), "openid email profile");
    await page.getByText("Google로 계속하기").waitFor({ timeout: 5000 });
    const mockLoginButton = page.getByRole("button", { name: "mock 로그인 확인" });
    await mockLoginButton.waitFor({ timeout: 5000 });
    await page.getByPlaceholder("qa@ticketground.kr").fill("qa@ticketground.kr");
    await page.getByPlaceholder("mock password").fill("password");
    await mockLoginButton.click();
    await page.getByText("민서 데모 세션 연결됨").waitFor({ timeout: 5000 });
    const storedUserId = await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id"));
    assert.equal(storedUserId, "user_fan_a");
  } finally {
    await page.close();
  }
});
