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
          data: { id: callbackUserId, name: "카카오 테스트 사용자", status: "ACTIVE", trustScore: 88 },
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
    const kakaoLink = page.getByRole("link", { name: "카카오톡 계정으로 로그인하기", exact: true });
    const naverLink = page.getByRole("link", { name: "네이버 계정으로 로그인하기", exact: true });
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
  configureSocialEnv(t, true);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    for (const providerName of ["카카오톡", "네이버"]) {
      await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => window.localStorage.clear());
      await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });

      const button = page.getByRole("button", { name: `${providerName} 계정으로 로그인하기`, exact: true });
      await button.waitFor({ timeout: 5000 });
      assert.equal(await button.getAttribute("data-social-ready"), "mock");
      await button.click();

      await page.getByLabel("닉네임").waitFor({ timeout: 5000 });
      assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")), "user_fan_a");
    }
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
              button.textContent = "Google 계정으로 로그인하기";
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

    await page.getByRole("button", { name: "Google 계정으로 로그인하기", exact: true }).click();
    await page.getByLabel("닉네임").waitFor({ timeout: 5000 });
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

  await page.goto(`${baseUrl}/login?socialProvider=kakao`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("닉네임").waitFor({ timeout: 5000 });
  assert.equal(new URL(page.url()).pathname, "/login");
  assert.equal(new URL(page.url()).search, "");
  assert.equal(await page.getByLabel("닉네임").inputValue(), "카카오 테스트 사용자");
  assert.equal(await page.getByText("세션 상태", { exact: true }).count(), 0);
  const storedUserId = await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id"));
  assert.match(String(storedUserId), /^provider_user_/);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForURL(`${baseUrl}/`, { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")), storedUserId);
});
