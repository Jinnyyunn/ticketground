import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

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

test("login page renders Google Identity Services wiring as a social-only button surface", async (t) => {
  configureGoogleEnv(t, false);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    await page.addInitScript(() => {
      window.google = {
        accounts: {
          id: {
            initialize: () => {},
            renderButton: (element) => {
              element.replaceChildren();
              const button = document.createElement("button");
              button.type = "button";
              button.textContent = "Google 계정으로 로그인하기";
              button.style.height = "48px";
              button.style.width = "100%";
              button.style.border = "1px solid rgb(218, 220, 224)";
              button.style.borderRadius = "8px";
              button.style.background = "white";
              element.appendChild(button);
            }
          }
        }
      };
    });
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });

    const googleArea = page.locator("[data-google-client-id]").first();
    await googleArea.waitFor({ timeout: 5000 });
    await page.locator("[data-google-ready='true']").waitFor({ timeout: 5000 });
    assert.equal(await googleArea.getAttribute("data-google-scope"), "openid email profile");
    assert.ok(await googleArea.getByText("Google 계정으로 로그인하기").first().isVisible());
    assert.equal(await googleArea.locator("svg").count(), 0);
    assert.equal(await page.getByText("이메일과 프로필 확인 범위만 요청합니다.").count(), 0);
    assert.equal(await page.getByText("Google 버튼 로드 중").count(), 0);
    const kakaoButton = page.getByRole("link", { name: "카카오톡 계정으로 로그인하기", exact: true });
    const googleBox = await googleArea.boundingBox();
    const kakaoBox = await kakaoButton.boundingBox();
    assert.ok(googleBox, "Google login control has a rendered box");
    assert.ok(kakaoBox, "Kakao login button has a rendered box");
    const googleElement = await googleArea.evaluate((element) => ({
      tagName: element.tagName,
      borderTopWidth: window.getComputedStyle(element).borderTopWidth,
    }));
    assert.deepEqual(googleElement, {
      tagName: "DIV",
      borderTopWidth: "0px",
    });
    assert.ok(
      Math.abs(googleBox.height - kakaoBox.height) <= 8,
      `Google control height ${googleBox.height} should be comparable to Kakao button height ${kakaoBox.height}`,
    );
    assert.ok(
      Math.abs(googleBox.width - kakaoBox.width) <= 8,
      `Google control width ${googleBox.width} should match Kakao button width ${kakaoBox.width}`,
    );

    assert.equal(await page.getByPlaceholder("qa@ticketground.kr").count(), 0);
    assert.equal(await page.getByPlaceholder("mock password").count(), 0);
    assert.equal(await page.getByRole("button", { name: "mock 로그인 확인" }).count(), 0);
  } finally {
    await page.close();
  }
});

test("login page does not request Google Identity Services from unsupported preview origins", async (t) => {
  configureGoogleEnv(t, false);
  const previousAllowedOrigins = process.env.TIG_ALLOWED_DEV_ORIGINS;
  process.env.TIG_ALLOWED_DEV_ORIGINS = "unsupported.ticketground.test";
  t.after(() => {
    if (previousAllowedOrigins === undefined) {
      delete process.env.TIG_ALLOWED_DEV_ORIGINS;
    } else {
      process.env.TIG_ALLOWED_DEV_ORIGINS = previousAllowedOrigins;
    }
  });

  const { baseUrl } = await startServer(t);
  const port = new URL(baseUrl).port;
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--host-resolver-rules=MAP unsupported.ticketground.test 127.0.0.1"],
  });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    let requestedGoogleScript = false;
    await page.route("https://accounts.google.com/gsi/client", async (route) => {
      requestedGoogleScript = true;
      await route.abort();
    });

    await page.goto(`http://unsupported.ticketground.test:${port}/login`, { waitUntil: "domcontentloaded" });
    const googleArea = page.locator("[data-google-client-id]").first();
    await googleArea.waitFor({ timeout: 5000 });
    await page.locator("[data-google-origin-supported='false']").waitFor({ timeout: 5000 });
    assert.equal(await googleArea.locator("svg path[fill='#4285F4']").count(), 1);
    await page.getByRole("button", { name: "Google 계정으로 로그인하기", exact: true }).click();
    await page.getByText("Google 로그인은 승인된 도메인에서만 사용할 수 있습니다.").waitFor({ timeout: 5000 });

    assert.equal(requestedGoogleScript, false);
  } finally {
    await page.close();
  }
});

test("login page does not assume localhost is Google-authorized without an explicit origin allowlist", async (t) => {
  configureGoogleEnv(t, false);
  const previousPublicAllowedOrigins = process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS;
  delete process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS;
  t.after(() => {
    if (previousPublicAllowedOrigins === undefined) {
      delete process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS;
    } else {
      process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS = previousPublicAllowedOrigins;
    }
  });

  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    let requestedGoogleScript = false;
    await page.route("https://accounts.google.com/gsi/client", async (route) => {
      requestedGoogleScript = true;
      await route.abort();
    });

    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-google-origin-supported='false']").waitFor({ timeout: 5000 });
    assert.equal(await page.locator("[data-google-origin-supported='false'] svg path[fill='#4285F4']").count(), 1);
    await page.getByRole("button", { name: "Google 계정으로 로그인하기", exact: true }).click();
    await page.getByText("Google 로그인은 승인된 도메인에서만 사용할 수 있습니다.").waitFor({ timeout: 5000 });

    assert.equal(requestedGoogleScript, false);
  } finally {
    await page.close();
  }
});

test("login page initializes Google Identity Services only once in a browser session", async (t) => {
  configureGoogleEnv(t, false);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.addInitScript(() => {
      window.__ticketgroundGoogleCalls = { initialize: 0, renderButton: 0, credential: 0 };
      window.google = {
        accounts: {
          id: {
            initialize: (options) => {
              window.__ticketgroundGoogleCalls.initialize += 1;
              window.__ticketgroundGoogleCallback = options.callback;
            },
            renderButton: (element) => {
              window.__ticketgroundGoogleCalls.renderButton += 1;
              element.replaceChildren();
              const button = document.createElement("button");
              button.type = "button";
              button.textContent = "Google 계정으로 로그인하기";
              button.addEventListener("click", () => {
                window.__ticketgroundGoogleCalls.credential += 1;
                window.__ticketgroundGoogleCallback?.({ credential: "ticketground-google-test-credential" });
              });
              element.appendChild(button);
            }
          }
        }
      };
    });

    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-google-ready='true']").waitFor({ timeout: 5000 });
    await page.waitForFunction(() => window.__ticketgroundGoogleCalls.renderButton > 0);
    await page.locator('a[href="/"]').first().click();
    await page.waitForURL(`${baseUrl}/`, { timeout: 5000 });
    await page.locator('a[href="/login"]').first().click();
    await page.waitForURL(`${baseUrl}/login`, { timeout: 5000 });
    await page.locator("[data-google-ready='true']").waitFor({ timeout: 5000 });

    const calls = await page.evaluate(() => window.__ticketgroundGoogleCalls);
    assert.equal(calls.initialize, 1);
    assert.ok(calls.renderButton >= 2, `Google button should render after returning to login, got ${calls.renderButton}`);
    assert.equal(calls.credential, 0);
  } finally {
    await page.close();
  }
});
