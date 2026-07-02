import crypto from "node:crypto";

const SESSION_MAX_AGE_MS = 5 * 60 * 1000;

function base64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function timingEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function signSession(body, hmac) {
  return hmac(`social-oauth-session:${body}`);
}

export function socialSessionCookieName(provider) {
  return `tig_social_session_${provider}`;
}

export function socialSessionCookie(provider, token, secure = false) {
  return `${socialSessionCookieName(provider)}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/api/auth/${provider}/session; Max-Age=300${secure ? "; Secure" : ""}`;
}

export function clearSocialSessionCookie(provider, secure = false) {
  return `${socialSessionCookieName(provider)}=; HttpOnly; SameSite=Lax; Path=/api/auth/${provider}/session; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function createSocialSessionToken({ currentTimeMs, hmac, provider, userId }) {
  const body = base64Url(JSON.stringify({
    provider,
    userId,
    issuedAt: currentTimeMs()
  }));
  return `${body}.${signSession(body, hmac)}`;
}

export function verifySocialSessionToken({ currentTimeMs, hmac, provider, token }) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature || !timingEqual(signature, signSession(body, hmac))) return "";
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const issuedAt = Number(payload.issuedAt);
    const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
    return payload.provider === provider && userId && currentTimeMs() - issuedAt <= SESSION_MAX_AGE_MS ? userId : "";
  } catch {
    return "";
  }
}
