// Corporate seller dashboard session: a stateless HMAC-signed cookie token
// (same shape/verification style as backend/social-oauth-session.js's OAuth
// bridge token, but with a full dashboard-length TTL and an embedded CSRF
// value instead of a one-shot 5-minute handoff). Kept separate from the
// admin console's in-memory session Map in server.js - sellers log in on
// the public surface, not the admin-only port.
import crypto from "node:crypto";

const SESSION_COOKIE_NAME = "tig_seller_session";
const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const LOGIN_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;

function base64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function timingEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signToken(body, hmac) {
  return hmac(`seller-session:${body}`);
}

export function sellerSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export function sellerSessionCookie(token, secure = false) {
  const maxAgeSeconds = Math.floor(SESSION_MAX_AGE_MS / 1000);
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
}

export function clearSellerSessionCookie(secure = false) {
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function createSellerSessionToken({ hmac, currentTimeMs, sellerId }) {
  const csrf = crypto.randomBytes(24).toString("hex");
  const body = base64Url(JSON.stringify({ sellerId, issuedAt: currentTimeMs(), csrf }));
  return { token: `${body}.${signToken(body, hmac)}`, csrf };
}

function decodeSellerSessionToken({ hmac, currentTimeMs, token }) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature || !timingEqual(signature, signToken(body, hmac))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const sellerId = typeof payload.sellerId === "string" ? payload.sellerId.trim() : "";
    const issuedAt = Number(payload.issuedAt);
    const csrf = typeof payload.csrf === "string" ? payload.csrf : "";
    if (!sellerId || !csrf || currentTimeMs() - issuedAt > SESSION_MAX_AGE_MS) return null;
    return { sellerId, csrf };
  } catch {
    return null;
  }
}

export function cookieValue(req, name) {
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

// Full request-time verification: valid signed+unexpired token AND the
// account it names must still exist and be active (an admin deactivating a
// seller account takes effect on the very next request, same as the admin
// console's own session re-check).
export function sellerSessionFromRequest({ activeSellerAccount, currentTimeMs, db, hmac, req }) {
  const token = cookieValue(req, SESSION_COOKIE_NAME);
  if (!token) return null;
  const decoded = decodeSellerSessionToken({ hmac, currentTimeMs, token });
  if (!decoded) return null;
  const account = activeSellerAccount(db, decoded.sellerId);
  if (!account) return null;
  return { account, csrf: decoded.csrf };
}

export function requireSellerSession(session, req, httpError) {
  if (!session) throw httpError(401, "SELLER_SESSION_REQUIRED", "판매자 로그인이 필요합니다.");
  if (req.method !== "GET") {
    const csrf = req.headers["x-tig-seller-csrf"];
    if (typeof csrf !== "string" || !timingEqual(csrf, session.csrf)) {
      throw httpError(403, "CSRF_REQUIRED", "판매자 변경 요청에는 CSRF 토큰이 필요합니다.");
    }
  }
  return session;
}

const loginAttempts = new Map();

export function recordSellerLoginAttempt(ip) {
  const nowMs = Date.now();
  const existing = loginAttempts.get(ip);
  if (!existing || existing.windowExpiresAt <= nowMs) {
    loginAttempts.set(ip, { count: 1, windowExpiresAt: nowMs + LOGIN_RATE_LIMIT_WINDOW_MS });
    return { limited: false };
  }
  existing.count += 1;
  return {
    limited: existing.count > LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    retryAfterSeconds: Math.ceil((existing.windowExpiresAt - nowMs) / 1000)
  };
}
