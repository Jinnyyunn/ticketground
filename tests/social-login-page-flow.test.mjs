import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import {
  configureSocialEnv,
  cookieHeaderFromSetCookie,
  PROVIDERS,
  redirected,
} from "./social-auth-test-helpers.mjs";
import { configureGoogleEnv } from "./google-auth-test-helpers.mjs";
import { startServer } from "./backend-test-utils.mjs";

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

function cookieObjectsFromSetCookie(setCookie, domain, path) {
  return String(setCookie || "")
    .split(/,\s*(?=[^;,]+=)/)
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .map((cookie) => {
      const separator = cookie.indexOf("=");
      return {
        name: cookie.slice(0, separator),
        value: decodeURIComponent(cookie.slice(separator + 1)),
        domain,
        path,
        httpOnly: true,
        sameSite: "Lax",
      };
    });
}

async function issueSocialBridgeCookies(baseUrl, provider, code) {
  const start = await fetch(`${baseUrl}/api/auth/${provider}/start`, { redirect: "manual" });
  const authorizeUrl = new URL(await redirected(start));
  const state = authorizeUrl.searchParams.get("state");
  assert.ok(state, `${provider} state is present`);
  const callback = await fetch(`${baseUrl}/api/auth/${provider}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, {
    headers: { cookie: cookieHeaderFromSetCookie(start.headers.get("set-cookie")) },
    redirect: "manual",
  });
  const callbackLocation = new URL(await redirected(callback), baseUrl);
  assert.equal(callbackLocation.searchParams.get("socialProvider"), provider);
  return cookieObjectsFromSetCookie(
    callback.headers.get("set-cookie"),
    new URL(baseUrl).hostname,
    `/api/auth/${provider}/session`,
  );
}

test("login page completes social callback, keeps nickname confirmation visible, and aligns provider buttons with Google", async (t) => {
  configureSocialEnv(t, true);
  useProviderMode(t);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    const callbackUserId = "provider_user_test";
    await page.route("**/api/auth/kakao/session", async (route) => {
      await route.fulfill({
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          ok: true,
          data: {
            id: callbackUserId,
            name: "카카오 테스트 사용자",
            status: "ACTIVE",
            trustScore: 88,
            profileConfirmed: false,
          },
        }),
      });
    });

    await page.goto(`${baseUrl}/login?socialProvider=kakao`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("닉네임").waitFor({ timeout: 5000 });
    assert.equal(new URL(page.url()).pathname, "/login");
    assert.equal(new URL(page.url()).search, "");
    assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")), callbackUserId);
    assert.equal(await page.getByLabel("닉네임").inputValue(), "카카오 테스트 사용자");
    assert.equal(await page.getByText("세션 상태", { exact: true }).count(), 0);

    await page.goto(`${baseUrl}/login?socialError=kakao_state_invalid`, { waitUntil: "domcontentloaded" });
    await page.getByText("kakao_state_invalid 소셜 로그인 요청을 처리하지 못했습니다.").waitFor({ timeout: 5000 });
    assert.equal(await page.getByText(/민서 .*세션 연결됨/).count(), 0);

    await page.goto(`${baseUrl}/login?socialProvider=naver`, { waitUntil: "domcontentloaded" });
    await page.getByText("소셜 로그인 세션을 다시 시작해주세요.").waitFor({ timeout: 5000 });
    assert.equal(await page.getByText(/민서 .*세션 연결됨/).count(), 0);

    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    const googleArea = page.locator("[data-google-client-id]").first();
    const kakaoLink = page.getByRole("link", { name: "카카오톡으로 계속하기", exact: true });
    const naverLink = page.getByRole("link", { name: "네이버로 계속하기", exact: true });
    assert.equal(await kakaoLink.getAttribute("href"), "/api/auth/kakao/start");
    assert.equal(await naverLink.getAttribute("href"), "/api/auth/naver/start");
    assert.equal(await kakaoLink.locator("svg circle").getAttribute("fill"), "#FFDE32");
    assert.equal(await kakaoLink.locator("svg path").getAttribute("fill"), "#3A2929");
    assert.equal(await naverLink.locator("svg rect").getAttribute("fill"), "#03C75A");
    assert.equal(await naverLink.locator("svg path").getAttribute("fill"), "#fff");
    const googleBox = await googleArea.boundingBox();
    const kakaoBox = await kakaoLink.boundingBox();
    assert.ok(googleBox, "Google login control has a rendered box");
    assert.ok(kakaoBox, "Kakao login link has a rendered box");
    assert.ok(Math.abs(googleBox.height - kakaoBox.height) <= 8);
    assert.ok(Math.abs(googleBox.width - kakaoBox.width) <= 8);
  } finally {
    await page.close();
  }
});

test("local preview Kakao and Naver buttons complete QA mock sessions without external OAuth redirects", async (t) => {
  configureSocialEnv(t, false);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    for (const providerLabel of ["카카오톡으로 계속하기", "네이버로 계속하기"]) {
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => window.localStorage.clear());
      await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });

      const button = page.getByRole("button", { name: providerLabel, exact: true });
      await button.waitFor({ timeout: 5000 });
      assert.equal(await button.getAttribute("data-social-ready"), "mock");
      await Promise.all([
        page.waitForURL(`${baseUrl}/`, { timeout: 5000 }),
        button.click(),
      ]);
      assert.equal(await page.getByLabel("닉네임").count(), 0);
      assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")), "user_fan_a");
    }
  } finally {
    await page.close();
  }
});

test("configured Kakao and Naver credentials render real OAuth links instead of QA mock, even on a private preview host", async (t) => {
  configureSocialEnv(t, true);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });

    const kakaoLink = page.getByRole("link", { name: "카카오톡으로 계속하기", exact: true });
    const naverLink = page.getByRole("link", { name: "네이버로 계속하기", exact: true });
    await kakaoLink.waitFor({ timeout: 5000 });
    assert.equal(await kakaoLink.getAttribute("href"), "/api/auth/kakao/start");
    assert.equal(await kakaoLink.getAttribute("data-social-ready"), "true");
    assert.equal(await naverLink.getAttribute("href"), "/api/auth/naver/start");
    assert.equal(await naverLink.getAttribute("data-social-ready"), "true");
    assert.equal(await page.getByRole("button", { name: "카카오톡으로 계속하기", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "네이버로 계속하기", exact: true }).count(), 0);
  } finally {
    await page.close();
  }
});

test("unauthenticated login page waits for an explicit login action before showing profile controls", async (t) => {
  configureSocialEnv(t, true);
  configureGoogleEnv(t, true);
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
            initialize: (options) => {
              window.__ticketgroundGoogleCallback = options.callback;
            },
            renderButton: (element) => {
              element.replaceChildren();
              const button = document.createElement("button");
              button.type = "button";
              button.textContent = "Google로 계속하기";
              button.addEventListener("click", () => {
                window.__ticketgroundGoogleCallback?.({ credential: "ticketground-google-test-credential" });
              });
              element.appendChild(button);
            }
          }
        }
      };
    });
    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "간편 로그인으로 계정을 시작해 주세요" }).waitFor({ timeout: 5000 });
    await page.getByText("별도 이메일 회원가입 없이 간편 로그인 완료 시 티켓그라운드 계정이 생성됩니다.").waitFor({ timeout: 5000 });

    assert.equal(await page.getByText("Google 인증 또는 데모 계정").count(), 0);
    assert.equal(await page.getByText("회원 기능 미리보기", { exact: true }).count(), 0);
    assert.equal(await page.getByText("공식 재판매 풀", { exact: true }).count(), 0);
    assert.equal(await page.getByText("세션 상태", { exact: true }).count(), 0);
    assert.equal(await page.getByText("로그인 또는 회원가입을 진행해 주세요", { exact: true }).count(), 0);

    assert.equal(await page.getByLabel("닉네임").count(), 0);
    assert.equal(await page.getByRole("button", { name: "프로필 저장", exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")), null);

    assert.equal(await page.getByPlaceholder("qa@ticketground.kr").count(), 0);
    assert.equal(await page.getByRole("button", { name: "mock 로그인 확인" }).count(), 0);

    await page.getByRole("button", { name: "Google로 계속하기", exact: true }).click();
    // Google already verified this identity and supplied a real name, so
    // there is nothing left to confirm - login goes straight to home
    // instead of showing a nickname form.
    await page.waitForURL(`${baseUrl}/`, { timeout: 5000 });
    assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")), "google_user_test");
  } finally {
    await page.close();
  }
});

test("successful social callback clears the one-time provider query before refresh", async (t) => {
  configureSocialEnv(t, true);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  t.after(() => context.close());
  await context.addCookies(await issueSocialBridgeCookies(baseUrl, "kakao", PROVIDERS.kakao.code));
  const page = await context.newPage();

  // Kakao already verified this identity and supplied a real nickname, so
  // there is nothing left to confirm - the callback clears its one-time
  // query param and goes straight home instead of staying on /login.
  await page.goto(`${baseUrl}/login?socialProvider=kakao`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(`${baseUrl}/`, { timeout: 5000 });
  const storedUserId = await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id"));
  assert.match(String(storedUserId), /^provider_user_/);

  // Already authenticated: a later visit to the login page redirects straight home.
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(`${baseUrl}/`, { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")), storedUserId);
});

test("successful Kakao and Naver callbacks persist the last-login provider before navigating home", async (t) => {
  configureSocialEnv(t, true);
  useProviderMode(t);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const provider of ["kakao", "naver"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await context.addCookies(await issueSocialBridgeCookies(baseUrl, provider, PROVIDERS[provider].code));
    const page = await context.newPage();

    // The provider already verified this identity and supplied a real
    // nickname, so login goes straight to home instead of staying on
    // /login - rememberLastLoginProvider() runs synchronously before that
    // navigation (src/components/ticketing/login-panel.tsx), so the
    // localStorage write is guaranteed to have landed either way.
    await page.goto(`${baseUrl}/login?socialProvider=${provider}`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(`${baseUrl}/`, { timeout: 5000 });
    assert.equal(
      await page.evaluate(() => window.localStorage.getItem("ticketground:last-login-provider")),
      provider,
    );

    await context.close();
  }
});

test("a returning anonymous visitor sees an accessible reminder of their last login method", async (t) => {
  // The last-login indicator's whole purpose is helping someone who logged
  // out (or never finished a session) pick the right button again - so it
  // only ever needs to render for an anonymous visitor, which is exactly
  // what's seeded here instead of driving a live OAuth callback for it.
  configureSocialEnv(t, true);
  useProviderMode(t);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const [provider, providerName, providerLabel] of [
    ["kakao", "카카오톡", "카카오톡으로 계속하기"],
    ["naver", "네이버", "네이버로 계속하기"],
  ]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await context.addInitScript((value) => {
      window.localStorage.setItem("ticketground:last-login-provider", value);
    }, provider);
    const page = await context.newPage();

    await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
    const providerControl = page.getByRole("link", {
      name: providerLabel,
      exact: true,
    });
    await providerControl.waitFor({ timeout: 5000 });
    const descriptionId = await providerControl.getAttribute("aria-describedby");
    assert.ok(descriptionId, `${providerName} control references its last-login indicator`);
    const indicator = page.locator(`#${descriptionId}`);
    assert.equal(await indicator.getAttribute("role"), "status");
    assert.equal(await indicator.getAttribute("aria-live"), "polite");
    assert.equal(await indicator.getAttribute("aria-atomic"), "true");
    assert.equal(await indicator.textContent(), `최근 로그인한 수단: ${providerName}`);
    const visibleChip = page.getByText("최근 로그인", { exact: true });
    assert.equal(await visibleChip.isVisible(), true);
    assert.equal(await visibleChip.getAttribute("aria-hidden"), "true");

    await context.close();
  }
});

test("failed or invalid social callbacks preserve the last successful provider and corrupt storage is ignored", async (t) => {
  configureSocialEnv(t, true);
  configureGoogleEnv(t, true);
  useProviderMode(t);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem("ticketground:last-login-provider", "google");
  });

  await page.goto(`${baseUrl}/login?socialError=kakao_access_denied`, { waitUntil: "domcontentloaded" });
  await page.getByText("kakao_access_denied 소셜 로그인 요청을 처리하지 못했습니다.").waitFor({ timeout: 5000 });
  assert.equal(
    await page.evaluate(() => window.localStorage.getItem("ticketground:last-login-provider")),
    "google",
  );

  await page.goto(`${baseUrl}/login?socialProvider=naver`, { waitUntil: "domcontentloaded" });
  await page.getByText("소셜 로그인 세션을 다시 시작해주세요.").waitFor({ timeout: 5000 });
  assert.equal(
    await page.evaluate(() => window.localStorage.getItem("ticketground:last-login-provider")),
    "google",
  );

  await page.evaluate(() => {
    window.localStorage.setItem("ticketground:last-login-provider", "{broken");
  });
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "간편 로그인으로 계정을 시작해 주세요" }).waitFor({ timeout: 5000 });
  assert.equal(await page.getByText("최근 로그인", { exact: true }).count(), 0);
});
