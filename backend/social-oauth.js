import crypto from "node:crypto";
import {
  TEST_CODES,
  loginRedirect,
  oauthRedirect,
  providerConfig
} from "./social-oauth-config.js";
import {
  clearSocialSessionCookie,
  createSocialSessionToken,
  socialSessionCookie,
  socialSessionCookieName,
  verifySocialSessionToken
} from "./social-oauth-session.js";
import { issueNativeAuthHandoff } from "./native-auth-handoff.js";

const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const SOCIAL_FETCH_TIMEOUT_MS = 8000;

function base64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signState(body, hmac) {
  return hmac(`social-oauth-state:${body}`);
}

function stateCookieName(provider) {
  return `tig_oauth_state_${provider}`;
}

function isSecureRequest(req) {
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  return proto === "https" || req.socket?.encrypted === true;
}

function stateCookie(provider, state, secure = false) {
  return `${stateCookieName(provider)}=${encodeURIComponent(state)}; HttpOnly; SameSite=Lax; Path=/api/auth/${provider}; Max-Age=600${secure ? "; Secure" : ""}`;
}

function clearStateCookie(provider, secure = false) {
  return `${stateCookieName(provider)}=; HttpOnly; SameSite=Lax; Path=/api/auth/${provider}; Max-Age=0${secure ? "; Secure" : ""}`;
}

function cookieValue(req, name) {
  const rawCookie = req.headers.cookie || "";
  const parts = rawCookie.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = parts.find((part) => part.startsWith(prefix));
  if (!match) return "";
  try {
    return decodeURIComponent(match.slice(prefix.length));
  } catch {
    return "";
  }
}

function setCookieHeaders(...cookies) {
  return { "Set-Cookie": cookies.filter(Boolean) };
}

function timingEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createState(provider, client, hmac, currentTimeMs) {
  const body = base64Url(JSON.stringify({
    provider,
    client,
    nonce: crypto.randomBytes(16).toString("hex"),
    issuedAt: currentTimeMs()
  }));
  return `${body}.${signState(body, hmac)}`;
}

function verifyState(provider, state, cookieState, hmac, currentTimeMs) {
  if (!state || !cookieState || !timingEqual(state, cookieState)) return null;
  const [body, signature] = state.split(".");
  if (!body || !signature || !timingEqual(signature, signState(body, hmac))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.provider !== provider || currentTimeMs() - Number(payload.issuedAt) > STATE_MAX_AGE_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

function nativeHandoffRedirect(provider, code, headers) {
  const url = new URL("ticketground://auth/social/callback");
  url.searchParams.set("provider", provider);
  url.searchParams.set("code", code);
  return oauthRedirect(url.toString(), headers);
}

function nativeFailureRedirect(provider, error, headers) {
  const url = new URL("ticketground://auth/social/callback");
  url.searchParams.set("provider", provider);
  url.searchParams.set("error", error);
  return oauthRedirect(url.toString(), headers);
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function exchangeToken(provider, code, state, config) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code
  });
  if (provider === "naver") params.set("state", state);
  if (provider === "kakao") params.set("redirect_uri", config.redirectUri);
  if (config.clientSecret) params.set("client_secret", config.clientSecret);

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: params,
    signal: AbortSignal.timeout(SOCIAL_FETCH_TIMEOUT_MS)
  });
  const payload = await readJsonResponse(response);
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : "";
  if (!response.ok || !accessToken) throw new Error(`${provider} token exchange failed`);
  return accessToken;
}

async function fetchProfile(config, accessToken) {
  const response = await fetch(config.profileUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(SOCIAL_FETCH_TIMEOUT_MS)
  });
  const payload = await readJsonResponse(response);
  if (!response.ok) throw new Error("social profile fetch failed");
  return payload;
}

function socialAuthTestModeEnabled() {
  return process.env.TIG_SOCIAL_AUTH_TEST_MODE === "1" && (process.env.NODE_ENV !== "production" || process.env.TIG_SOCIAL_AUTH_TEST_MODE_ACTIVE === "1");
}

function testProfile(provider, code) {
  if (!socialAuthTestModeEnabled() || code !== TEST_CODES[provider]) return null;
  if (provider === "kakao") return { subject: "kakao-test", name: "카카오 테스트 사용자" };
  if (provider === "naver") return { subject: "naver-test", name: "네이버 테스트 사용자" };
  return null;
}

function normalizeProfile(provider, payload) {
  if (provider === "kakao") {
    const id = payload.id === undefined ? "" : String(payload.id);
    const profile = payload.kakao_account?.profile || {};
    return {
      subject: id,
      name: String(profile.nickname || payload.properties?.nickname || "카카오 사용자").trim()
    };
  }
  const response = payload.response || {};
  return {
    subject: String(response.id || "").trim(),
    name: String(response.name || response.nickname || "네이버 사용자").trim()
  };
}

async function socialProfile(provider, code, state, config) {
  const fake = testProfile(provider, code);
  if (fake) return fake;
  const accessToken = await exchangeToken(provider, code, state, config);
  return normalizeProfile(provider, await fetchProfile(config, accessToken));
}

export function createSocialOAuthBackend({ appendLedger, currentTimeMs, hmac, httpError, now, publicSessionUserWithCredential, stableId }) {
  function upsertSocialUser(db, provider, profile) {
    const subject = String(profile.subject || "").trim();
    if (!subject) throw new Error(`${provider} profile subject missing`);
    const name = String(profile.name || `${provider} 사용자`).trim();
    const id = stableId("provider_user", `${provider}:${subject}`);
    const existingUser = db.users.find((user) => user.id === id);
    if (existingUser) {
      appendLedger(db, id, "SOCIAL_USER_SEEN", {
        provider,
        providerName: name,
        updatedAt: now()
      });
      // Backfill accounts stuck from before the provider's own nickname was
      // trusted as confirmed - they already proved this is a real account
      // by logging in again just now.
      if (!existingUser.profileConfirmedAt) existingUser.profileConfirmedAt = now();
      return existingUser;
    }

    const user = {
      id,
      name,
      balance: 0,
      status: "ACTIVE",
      trustScore: 88,
      sanctions: [],
      // Kakao/Naver already authenticated this identity and supplied a
      // real nickname (normalizeProfile()) - Ticketground has no separate
      // identity of its own to confirm, so there is nothing left to ask
      // the user to re-enter for a provider-verified login.
      profileConfirmedAt: now()
    };
    db.users.push(user);
    appendLedger(db, id, "SOCIAL_USER_REGISTERED", {
      provider,
      subjectHash: stableId("provider_subject", `${provider}:${subject}`),
      registeredAt: now()
    });
    return user;
  }

  function socialAuthStart(req, provider) {
    const config = providerConfig(provider, req, "start");
    if (!config) return loginRedirect({ socialError: `${provider}_not_configured` });
    const requestUrl = new URL(req.url || "/", `http://${req.headers.host}`);
    const client = requestUrl.searchParams.get("client") === "ios" ? "ios" : "web";
    const state = createState(provider, client, hmac, currentTimeMs);
    const secureCookie = isSecureRequest(req);
    const url = new URL(config.authorizeUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("state", state);
    return oauthRedirect(url.toString(), { "Set-Cookie": stateCookie(provider, state, secureCookie) });
  }

  function socialAuthPreflight(req, provider) {
    return {
      provider,
      ready: providerConfig(provider, req, "callback") !== null
    };
  }

  async function socialAuthCallback(db, req, provider, params) {
    const secureCookie = isSecureRequest(req);
    const clearCookie = setCookieHeaders(clearStateCookie(provider, secureCookie));
    const code = params.get("code") || "";
    const state = params.get("state") || "";
    const cookieState = cookieValue(req, stateCookieName(provider));
    const statePayload = verifyState(provider, state, cookieState, hmac, currentTimeMs);
    const trustedStatePayload = statePayload
      || verifyState(provider, cookieState, cookieState, hmac, currentTimeMs);
    const failureRedirect = (error) => {
      if (trustedStatePayload?.client === "ios") {
        return nativeFailureRedirect(provider, error, clearCookie);
      }
      return loginRedirect({ socialError: `${provider}_${error}` }, clearCookie);
    };
    const config = providerConfig(provider, req, "callback");
    if (!config) return failureRedirect("not_configured");
    if (params.get("error")) {
      return failureRedirect(statePayload ? "denied" : "state_invalid");
    }
    if (!code || !statePayload) {
      return failureRedirect("state_invalid");
    }

    try {
      const user = upsertSocialUser(db, provider, await socialProfile(provider, code, state, config));
      appendLedger(db, user.id, "SOCIAL_SESSION_CREATED", {
        provider,
        authenticatedAt: now()
      });
      if (statePayload.client === "ios") {
        return nativeHandoffRedirect(
          provider,
          issueNativeAuthHandoff(db, provider, user.id, now),
          clearCookie,
        );
      }
      const token = createSocialSessionToken({
        currentTimeMs,
        hmac,
        provider,
        userId: user.id
      });
      return loginRedirect({
        socialProvider: provider
      }, setCookieHeaders(clearStateCookie(provider, secureCookie), socialSessionCookie(provider, token, secureCookie)));
    } catch {
      return failureRedirect("callback_failed");
    }
  }

  function socialAuthSession(db, req, provider) {
    const secureCookie = isSecureRequest(req);
    const userId = verifySocialSessionToken({
      currentTimeMs,
      hmac,
      provider,
      token: cookieValue(req, socialSessionCookieName(provider))
    });
    if (!userId) {
      throw httpError(401, "SOCIAL_SESSION_INVALID", "소셜 로그인 세션을 다시 시작해주세요.");
    }
    const user = db.users.find((item) => item.id === userId);
    if (!user) {
      throw httpError(404, "USER_NOT_FOUND", "소셜 로그인 사용자를 찾을 수 없습니다.");
    }
    return {
      responseHeaders: setCookieHeaders(clearSocialSessionCookie(provider, secureCookie)),
      responseBody: publicSessionUserWithCredential(db, user)
    };
  }

  return {
    socialAuthCallback,
    socialAuthPreflight,
    socialAuthSession,
    socialAuthStart
  };
}
