import test from "node:test";
import assert from "node:assert/strict";
import {
  configureSocialEnv,
  cookieHeaderFromSetCookie,
  createDirectSocialBackend,
  PROVIDERS,
  redirected,
} from "./social-auth-test-helpers.mjs";
import { adminApi, api, startServer } from "./backend-test-utils.mjs";

test("social OAuth start redirects missing provider config back to login with a safe error", async (t) => {
  configureSocialEnv(t, false);
  const { baseUrl } = await startServer(t);

  const response = await fetch(`${baseUrl}/api/auth/kakao/start`, { redirect: "manual" });
  const location = await redirected(response);
  assert.equal(new URL(location, baseUrl).pathname, "/login");
  assert.equal(new URL(location, baseUrl).searchParams.get("socialError"), "kakao_not_configured");
});

test("Naver OAuth start only requires client id and defers secret validation to callback", async (t) => {
  configureSocialEnv(t, false);
  process.env.TIG_NAVER_CLIENT_ID = PROVIDERS.naver.clientId;
  const { baseUrl } = await startServer(t);

  const response = await fetch(`${baseUrl}/api/auth/naver/start`, { redirect: "manual" });
  const authorizeUrl = new URL(await redirected(response));
  assert.equal(authorizeUrl.origin, "https://nid.naver.com");
  assert.equal(authorizeUrl.searchParams.get("client_id"), PROVIDERS.naver.clientId);
  assert.equal(authorizeUrl.searchParams.get("redirect_uri"), `${baseUrl}/api/auth/naver/callback`);
  assert.ok(response.headers.get("set-cookie")?.includes("tig_oauth_state_naver="));
});

test("Kakao OAuth callback requires client secret by default", async (t) => {
  configureSocialEnv(t, false);
  process.env.TIG_SOCIAL_AUTH_TEST_MODE = "1";
  process.env.TIG_KAKAO_REST_API_KEY = PROVIDERS.kakao.clientId;
  const { baseUrl } = await startServer(t);

  const start = await fetch(`${baseUrl}/api/auth/kakao/start`, { redirect: "manual" });
  const authorizeUrl = new URL(await redirected(start));
  const state = authorizeUrl.searchParams.get("state");
  assert.ok(state, "Kakao state is present");

  const callback = await fetch(`${baseUrl}/api/auth/kakao/callback?code=${PROVIDERS.kakao.code}&state=${encodeURIComponent(state)}`, {
    headers: { cookie: cookieHeaderFromSetCookie(start.headers.get("set-cookie")) },
    redirect: "manual",
  });
  const callbackLocation = new URL(await redirected(callback), baseUrl);
  assert.equal(callbackLocation.pathname, "/login");
  assert.equal(callbackLocation.searchParams.get("socialError"), "kakao_not_configured");
  assert.equal(callbackLocation.searchParams.get("socialProvider"), null);
  assert.equal(callback.headers.get("set-cookie")?.includes("tig_social_session_kakao="), false);
});

test("Kakao OAuth callback can omit client secret only when the Kakao console feature is explicitly disabled", async (t) => {
  configureSocialEnv(t, false);
  process.env.TIG_SOCIAL_AUTH_TEST_MODE = "1";
  process.env.TIG_KAKAO_REST_API_KEY = PROVIDERS.kakao.clientId;
  process.env.TIG_KAKAO_CLIENT_SECRET_REQUIRED = "0";
  const { baseUrl } = await startServer(t);

  const start = await fetch(`${baseUrl}/api/auth/kakao/start`, { redirect: "manual" });
  const authorizeUrl = new URL(await redirected(start));
  const state = authorizeUrl.searchParams.get("state");
  assert.ok(state, "Kakao state is present");

  const callback = await fetch(`${baseUrl}/api/auth/kakao/callback?code=${PROVIDERS.kakao.code}&state=${encodeURIComponent(state)}`, {
    headers: { cookie: cookieHeaderFromSetCookie(start.headers.get("set-cookie")) },
    redirect: "manual",
  });
  const callbackLocation = new URL(await redirected(callback), baseUrl);
  assert.equal(callbackLocation.pathname, "/login");
  assert.equal(callbackLocation.searchParams.get("socialProvider"), "kakao");
  assert.equal(callbackLocation.searchParams.get("socialError"), null);
  assert.ok(callback.headers.get("set-cookie")?.includes("tig_social_session_kakao="));
});

test("Naver and Kakao OAuth callbacks hand off sessions through HttpOnly bridge cookies", async (t) => {
  configureSocialEnv(t, true);
  const server = await startServer(t);
  const { baseUrl } = server;

  for (const provider of ["kakao", "naver"]) {
    const start = await fetch(`${baseUrl}/api/auth/${provider}/start`, { redirect: "manual" });
    const authorizeUrl = new URL(await redirected(start));
    assert.equal(authorizeUrl.searchParams.get("client_id"), PROVIDERS[provider].clientId);
    const state = authorizeUrl.searchParams.get("state");
    assert.ok(state, `${provider} state is present`);
    const stateCookie = start.headers.get("set-cookie");
    assert.ok(stateCookie?.includes(`tig_oauth_state_${provider}=`), `${provider} state cookie is set`);

    const callback = await fetch(`${baseUrl}/api/auth/${provider}/callback?code=${PROVIDERS[provider].code}&state=${encodeURIComponent(state)}`, {
      headers: { cookie: cookieHeaderFromSetCookie(stateCookie) },
      redirect: "manual",
    });
    const callbackLocation = new URL(await redirected(callback), baseUrl);
    assert.equal(callbackLocation.pathname, "/login");
    assert.equal(callbackLocation.searchParams.get("socialProvider"), provider);
    assert.equal(callbackLocation.searchParams.get("socialUserId"), null);
    const bridgeCookie = callback.headers.get("set-cookie");
    assert.ok(bridgeCookie?.includes(`tig_social_session_${provider}=`), `${provider} bridge cookie is set`);

    const sessionResponse = await fetch(`${baseUrl}/api/auth/${provider}/session`, {
      headers: { cookie: cookieHeaderFromSetCookie(bridgeCookie) },
    });
    assert.equal(sessionResponse.status, 200);
    assert.ok(sessionResponse.headers.get("set-cookie")?.includes(`tig_social_session_${provider}=;`), `${provider} bridge cookie is cleared`);
    const session = await sessionResponse.json();
    assert.equal(session.data.name, PROVIDERS[provider].userName);
    assert.equal(session.data.status, "ACTIVE");
  }

  const missingBridge = await api(baseUrl, "/api/auth/naver/session", undefined, 401);
  assert.equal(missingBridge.error.code, "SOCIAL_SESSION_INVALID");

  const ledger = await adminApi(server, "/api/ledger");
  assert.ok(ledger.data.some((entry) => entry.action === "SOCIAL_USER_REGISTERED" && entry.payload.provider === "kakao"));
  assert.ok(ledger.data.some((entry) => entry.action === "SOCIAL_SESSION_CREATED" && entry.payload.provider === "naver"));
});

test("social OAuth bridge cookies are marked Secure behind HTTPS proxies", async (t) => {
  configureSocialEnv(t, true);
  const { baseUrl } = await startServer(t);

  const start = await fetch(`${baseUrl}/api/auth/naver/start`, {
    headers: { "x-forwarded-proto": "https" },
    redirect: "manual",
  });
  const authorizeUrl = new URL(await redirected(start));
  const state = authorizeUrl.searchParams.get("state");
  assert.ok(state, "state is present");
  const stateCookie = start.headers.get("set-cookie");
  assert.ok(stateCookie?.includes("Secure"), "state cookie is Secure");

  const callback = await fetch(`${baseUrl}/api/auth/naver/callback?code=${PROVIDERS.naver.code}&state=${encodeURIComponent(state)}`, {
    headers: {
      cookie: cookieHeaderFromSetCookie(stateCookie),
      "x-forwarded-proto": "https",
    },
    redirect: "manual",
  });
  const bridgeCookie = callback.headers.get("set-cookie");
  assert.ok(bridgeCookie?.includes("tig_social_session_naver="), "bridge cookie is set");
  assert.ok(bridgeCookie?.includes("Secure"), "bridge cookie is Secure");
});

test("existing social login users keep their saved nickname on later provider callbacks", async (t) => {
  configureSocialEnv(t, true);
  const { baseUrl } = await startServer(t);

  async function completeKakaoCallback() {
    const start = await fetch(`${baseUrl}/api/auth/kakao/start`, { redirect: "manual" });
    const authorizeUrl = new URL(await redirected(start));
    const state = authorizeUrl.searchParams.get("state");
    assert.ok(state, "state is present");
    const callback = await fetch(`${baseUrl}/api/auth/kakao/callback?code=${PROVIDERS.kakao.code}&state=${encodeURIComponent(state)}`, {
      headers: { cookie: cookieHeaderFromSetCookie(start.headers.get("set-cookie")) },
      redirect: "manual",
    });
    const sessionResponse = await fetch(`${baseUrl}/api/auth/kakao/session`, {
      headers: { cookie: cookieHeaderFromSetCookie(callback.headers.get("set-cookie")) },
    });
    assert.equal(sessionResponse.status, 200);
    const session = await sessionResponse.json();
    return session.data;
  }

  const firstSession = await completeKakaoCallback();
  assert.equal(firstSession.name, PROVIDERS.kakao.userName);

  const updatedProfile = await api(baseUrl, `/api/users/${firstSession.id}/profile`, {
    name: "내가 정한 닉네임",
  });
  assert.equal(updatedProfile.data.name, "내가 정한 닉네임");

  const secondSession = await completeKakaoCallback();
  assert.equal(secondSession.id, firstSession.id);
  assert.equal(secondSession.name, "내가 정한 닉네임");
});

test("OAuth callbacks reject state mismatch without issuing a social bridge cookie", async (t) => {
  configureSocialEnv(t, true);
  const { baseUrl } = await startServer(t);

  const start = await fetch(`${baseUrl}/api/auth/naver/start`, { redirect: "manual" });
  const callback = await fetch(`${baseUrl}/api/auth/naver/callback?code=${PROVIDERS.naver.code}&state=wrong-state`, {
    headers: { cookie: cookieHeaderFromSetCookie(start.headers.get("set-cookie")) },
    redirect: "manual",
  });
  const callbackLocation = new URL(await redirected(callback), baseUrl);
  assert.equal(callbackLocation.searchParams.get("socialError"), "naver_state_invalid");
  assert.equal(callbackLocation.searchParams.get("socialProvider"), null);
  assert.equal(callback.headers.get("set-cookie")?.includes("tig_social_session_naver="), false);
});

test("OAuth endpoints reject malformed cookie encoding without a server error", async (t) => {
  configureSocialEnv(t, true);
  const { baseUrl } = await startServer(t);

  const callback = await fetch(`${baseUrl}/api/auth/naver/callback?code=${PROVIDERS.naver.code}&state=malformed-cookie-state`, {
    headers: { cookie: "tig_oauth_state_naver=%E0%A4%A" },
    redirect: "manual",
  });
  const callbackLocation = new URL(await redirected(callback), baseUrl);
  assert.equal(callbackLocation.pathname, "/login");
  assert.equal(callbackLocation.searchParams.get("socialError"), "naver_state_invalid");
  assert.equal(callback.headers.get("set-cookie")?.includes("tig_social_session_naver="), false);

  const session = await fetch(`${baseUrl}/api/auth/naver/session`, {
    headers: { cookie: "tig_social_session_naver=%E0%A4%A" },
  });
  assert.equal(session.status, 401);
  const body = await session.json();
  assert.equal(body.error.code, "SOCIAL_SESSION_INVALID");
});

test("production mode never accepts deterministic social test codes as provider credentials", async (t) => {
  configureSocialEnv(t, true);
  process.env.NODE_ENV = "production";
  const { backend, db } = createDirectSocialBackend();
  const start = backend.socialAuthStart({ headers: { host: "127.0.0.1:1" } }, "naver");
  const authorizeUrl = new URL(start.redirect);
  const state = authorizeUrl.searchParams.get("state");
  assert.ok(state, "state is present");

  const previousFetch = globalThis.fetch;
  let tokenExchangeCalled = false;
  globalThis.fetch = async () => {
    tokenExchangeCalled = true;
    return {
      ok: false,
      async json() {
        return { error: "network disabled in unit test" };
      },
    };
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
  });

  const callback = await backend.socialAuthCallback(
    db,
    {
      headers: {
        host: "127.0.0.1:1",
        cookie: cookieHeaderFromSetCookie(start.headers["Set-Cookie"]),
      },
    },
    "naver",
    new URLSearchParams({ code: PROVIDERS.naver.code, state }),
  );
  const callbackLocation = new URL(callback.redirect, "http://ticketground.local");
  assert.equal(callbackLocation.searchParams.get("socialError"), "naver_callback_failed");
  assert.equal(tokenExchangeCalled, true);
  assert.equal(db.users.length, 0);
});
