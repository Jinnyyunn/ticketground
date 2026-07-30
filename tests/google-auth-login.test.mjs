import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

function useProviderMode(t) {
  const previousForceProvider = process.env.TIG_AUTH_FORCE_PROVIDER;
  process.env.TIG_AUTH_FORCE_PROVIDER = "1";
  t.after(() => {
    if (previousForceProvider === undefined) {
      delete process.env.TIG_AUTH_FORCE_PROVIDER;
    } else {
      process.env.TIG_AUTH_FORCE_PROVIDER = previousForceProvider;
    }
  });
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

test("Google returning user keeps a manually saved nickname across later Google logins", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);

  const firstSession = await api(server.baseUrl, "/api/auth/google", {
    credential: GOOGLE_AUTH_TEST_CREDENTIAL
  });
  assert.equal(firstSession.data.name, "Google 테스트 사용자");
  assert.equal(firstSession.data.profileConfirmed, false);

  const updatedProfile = await api(server.baseUrl, `/api/users/${firstSession.data.id}/profile`, {
    name: "내가 정한 닉네임"
  });
  assert.equal(updatedProfile.data.name, "내가 정한 닉네임");
  assert.equal(updatedProfile.data.profileConfirmed, true);

  const secondSession = await api(server.baseUrl, "/api/auth/google", {
    credential: GOOGLE_AUTH_TEST_CREDENTIAL
  });
  assert.equal(secondSession.data.id, firstSession.data.id);
  assert.equal(secondSession.data.name, "내가 정한 닉네임");
  assert.equal(secondSession.data.profileConfirmed, true);
});

test("Google button prefers the real Identity Services flow over QA mock when a client id is configured, even on a private preview host", async (t) => {
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
              button.setAttribute("aria-label", "Google로 계속하기");
              button.textContent = "Sign in with Google";
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
    assert.equal(await page.locator("[data-google-ready='mock']").count(), 0);
    assert.equal(await page.getByRole("button", { name: "Google로 계속하기", exact: true }).isVisible(), true);
  } finally {
    await page.close();
  }
});

test("login page renders Google Identity Services wiring as a social-only button surface", async (t) => {
  configureGoogleEnv(t, false);
  useProviderMode(t);
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
              button.setAttribute("aria-label", "Google로 계속하기");
              button.textContent = "Sign in with Google";
              button.style.height = "48px";
              button.style.width = "100%";
              button.style.border = "1px solid rgb(218, 220, 224)";
              button.style.background = "rgb(232, 240, 254)";
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
    const googleGroup = page.getByRole("group", { name: "Google로 계속하기", exact: true });
    const googleButton = googleGroup.getByRole("button", {
      name: "Google로 계속하기",
      exact: true,
    });
    assert.ok(await googleButton.isVisible(), "the real GIS control stays keyboard and screen-reader accessible");
    assert.equal(await page.getByRole("button", { name: "Sign in with Google", exact: true }).count(), 0);
    assert.ok(await googleArea.locator("svg").first().isVisible());
    assert.equal(await page.getByText("이메일과 프로필 확인 범위만 요청합니다.").count(), 0);
    assert.equal(await page.getByText("Google 버튼 로드 중").count(), 0);
    const kakaoButton = page.getByRole("link", { name: "카카오톡으로 계속하기", exact: true });
    const googleBox = await googleGroup.boundingBox();
    const kakaoBox = await kakaoButton.boundingBox();
    assert.ok(googleBox, "Google login control has a rendered box");
    assert.ok(kakaoBox, "Kakao login button has a rendered box");
    const googleElement = await googleGroup.evaluate((element) => ({
      tagName: element.tagName,
      role: element.getAttribute("role"),
      backgroundColor: window.getComputedStyle(element).backgroundColor,
      borderTopWidth: window.getComputedStyle(element).borderTopWidth,
    }));
    assert.deepEqual(googleElement, {
      tagName: "DIV",
      role: "group",
      backgroundColor: "rgb(255, 255, 255)",
      borderTopWidth: "1px",
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
  useProviderMode(t);
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
    await page.getByRole("button", { name: "Google로 계속하기", exact: true }).click();
    await page.getByText("Google 로그인은 승인된 도메인에서만 사용할 수 있습니다.").waitFor({ timeout: 5000 });

    assert.equal(requestedGoogleScript, false);
  } finally {
    await page.close();
  }
});

test("login page does not assume localhost is Google-authorized without an explicit origin allowlist", async (t) => {
  configureGoogleEnv(t, false);
  useProviderMode(t);
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
    await page.getByRole("button", { name: "Google로 계속하기", exact: true }).click();
    await page.getByText("Google 로그인은 승인된 도메인에서만 사용할 수 있습니다.").waitFor({ timeout: 5000 });

    assert.equal(requestedGoogleScript, false);
  } finally {
    await page.close();
  }
});

test("login page initializes Google Identity Services only once in a browser session", async (t) => {
  configureGoogleEnv(t, false);
  useProviderMode(t);
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
              button.textContent = "Google로 계속하기";
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

test("deterministic iframe contract preserves failed credentials and exposes the successful Google provider in the parent document", async (t) => {
  configureGoogleEnv(t, true);
  useProviderMode(t);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.addInitScript(() => {
    window.localStorage.setItem("ticketground:last-login-provider", "naver");
    window.__ticketgroundGoogleCredential = "";
    window.google = {
      accounts: {
        id: {
          initialize: (options) => {
            window.__ticketgroundGoogleCallback = options.callback;
          },
          renderButton: (element) => {
            element.replaceChildren();
            const iframe = document.createElement("iframe");
            iframe.title = "Deterministic Google control fixture (not live GIS)";
            iframe.srcdoc = `
              <!doctype html>
              <html lang="ko">
                <body>
                  <button type="button" aria-label="Google로 계속하기">Google로 계속하기</button>
                  <script>
                    document.querySelector("button").addEventListener("click", () => {
                      parent.postMessage({ type: "ticketground-google-fixture-click" }, "*");
                    });
                  </` + `script>
                </body>
              </html>
            `;
            window.addEventListener("message", (event) => {
              if (event.source !== iframe.contentWindow || event.data?.type !== "ticketground-google-fixture-click") return;
              const credential = window.__ticketgroundGoogleCredential;
              window.__ticketgroundGoogleCallback?.(credential ? { credential } : {});
            });
            element.appendChild(iframe);
          }
        }
      }
    };
  });

  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  const initialParentStatus = page.locator("#last-login-provider-naver");
  await initialParentStatus.waitFor({ state: "attached", timeout: 5000 });
  assert.equal(await initialParentStatus.getAttribute("role"), "status");
  assert.equal(await initialParentStatus.getAttribute("aria-live"), "polite");
  assert.equal(await initialParentStatus.getAttribute("aria-atomic"), "true");
  assert.equal(await initialParentStatus.textContent(), "최근 로그인한 수단: 네이버");

  const googleGroup = page.getByRole("group", { name: "Google로 계속하기", exact: true });
  await googleGroup.waitFor({ timeout: 5000 });
  const googleFrame = googleGroup.frameLocator('iframe[title="Deterministic Google control fixture (not live GIS)"]');
  const googleButton = googleFrame.getByRole("button", {
    name: "Google로 계속하기",
    exact: true,
  });
  await googleButton.waitFor({ timeout: 5000 });
  const restingGoogleShadow = await googleGroup.evaluate((group) => window.getComputedStyle(group).boxShadow);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  let keyboardReachedGoogle = false;
  for (let step = 0; step < 10; step += 1) {
    await page.keyboard.press("Tab");
    keyboardReachedGoogle = await googleButton.evaluate((button) => document.activeElement === button);
    if (keyboardReachedGoogle) break;
  }
  assert.equal(keyboardReachedGoogle, true, "Tab reaches the real Google login control");
  await page.locator("[data-google-focused='true']").waitFor({ timeout: 5000 });
  const parentFocusState = await googleGroup.evaluate((group) => {
    const iframe = group.querySelector("iframe");
    return {
      activeTag: document.activeElement?.tagName ?? null,
      iframeMatchesFocus: iframe?.matches(":focus") ?? false,
      recordedFocus: group.getAttribute("data-google-focused"),
    };
  });
  assert.notEqual(
    await googleGroup.evaluate((group) => window.getComputedStyle(group).boxShadow),
    restingGoogleShadow,
    `the visible Google surface shows a focus ring when the real GIS control receives focus: ${JSON.stringify(parentFocusState)}`,
  );

  await googleButton.click();
  await page.getByText("Google 인증 정보를 받지 못했습니다.").waitFor({ timeout: 5000 });
  assert.equal(
    await page.evaluate(() => window.localStorage.getItem("ticketground:last-login-provider")),
    "naver",
  );

  await page.evaluate(() => {
    window.__ticketgroundGoogleCredential = "ticketground-google-test-credential";
  });
  await googleButton.click();
  await page.getByLabel("닉네임").waitFor({ timeout: 5000 });
  assert.equal(
    await page.evaluate(() => window.localStorage.getItem("ticketground:last-login-provider")),
    "google",
  );

  const descriptionId = await googleGroup.getAttribute("aria-describedby");
  assert.ok(descriptionId, "Google parent group references its parent-document status");
  const indicator = page.locator(`#${descriptionId}`);
  assert.equal(await indicator.getAttribute("role"), "status");
  assert.equal(await indicator.getAttribute("aria-live"), "polite");
  assert.equal(await indicator.getAttribute("aria-atomic"), "true");
  assert.equal(await indicator.textContent(), "최근 로그인한 수단: Google");

  const visibleChip = page.getByText("최근 로그인", { exact: true });
  assert.equal(await visibleChip.isVisible(), true);
  assert.equal(await visibleChip.getAttribute("aria-hidden"), "true");
});
