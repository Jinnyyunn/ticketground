import crypto from "node:crypto";
import { createSocialOAuthBackend } from "../backend/social-oauth.js";

export const PROVIDERS = {
  kakao: {
    clientId: "ticketground-kakao-test-client",
    clientSecret: "ticketground-kakao-test-secret",
    code: "ticketground-kakao-test-code",
    userName: "카카오 테스트 사용자",
  },
  naver: {
    clientId: "ticketground-naver-test-client",
    clientSecret: "ticketground-naver-test-secret",
    code: "ticketground-naver-test-code",
    userName: "네이버 테스트 사용자",
  },
};

const SOCIAL_ENV_KEYS = [
  "NODE_ENV",
  "TIG_SOCIAL_AUTH_TEST_MODE",
  "TIG_KAKAO_REST_API_KEY",
  "TIG_KAKAO_CLIENT_SECRET",
  "TIG_KAKAO_CLIENT_SECRET_REQUIRED",
  "TIG_KAKAO_REDIRECT_URI",
  "TIG_NAVER_CLIENT_ID",
  "TIG_NAVER_CLIENT_SECRET",
  "TIG_NAVER_REDIRECT_URI",
];

export function configureSocialEnv(t, enabled) {
  const previousValues = new Map(SOCIAL_ENV_KEYS.map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const key of SOCIAL_ENV_KEYS) {
      const value = previousValues.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  if (!enabled) {
    for (const key of SOCIAL_ENV_KEYS) process.env[key] = "";
    return;
  }

  process.env.NODE_ENV = "test";
  process.env.TIG_SOCIAL_AUTH_TEST_MODE = "1";
  process.env.TIG_KAKAO_REST_API_KEY = PROVIDERS.kakao.clientId;
  process.env.TIG_KAKAO_CLIENT_SECRET = PROVIDERS.kakao.clientSecret;
  process.env.TIG_KAKAO_CLIENT_SECRET_REQUIRED = "1";
  process.env.TIG_KAKAO_REDIRECT_URI = "";
  process.env.TIG_NAVER_CLIENT_ID = PROVIDERS.naver.clientId;
  process.env.TIG_NAVER_CLIENT_SECRET = PROVIDERS.naver.clientSecret;
  process.env.TIG_NAVER_REDIRECT_URI = "";
}

export function cookieHeaderFromSetCookie(setCookie) {
  return String(setCookie || "")
    .split(/,\s*(?=[^;,]+=)/)
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

export function createDirectSocialBackend() {
  const db = { users: [], ledger: [] };
  const backend = createSocialOAuthBackend({
    appendLedger(database, actorId, action, payload) {
      database.ledger.push({ actorId, action, payload });
    },
    currentTimeMs: () => Date.UTC(2026, 8, 19, 8, 0, 0),
    hmac: (value) => crypto.createHmac("sha256", "social-oauth-unit-secret").update(value).digest("hex"),
    httpError(status, code, message) {
      const error = new Error(message);
      error.status = status;
      error.code = code;
      throw error;
    },
    now: () => "2026-09-19T17:00:00+09:00",
    publicSessionUser: (user) => ({
      id: user.id,
      name: user.name,
      status: user.status,
      trustScore: user.trustScore,
    }),
    stableId: (prefix, input) => `${prefix}_${crypto.createHash("sha256").update(input).digest("hex").slice(0, 12)}`,
  });
  return { backend, db };
}

export async function redirected(response) {
  if (response.status !== 302) {
    throw new Error(`Expected redirect status, got ${response.status}`);
  }
  const location = response.headers.get("location");
  if (!location) throw new Error("redirect location is missing");
  return location;
}
