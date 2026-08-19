import crypto from "node:crypto";
import { publicSessionUser } from "./session-user.js";

const NATIVE_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function createNativeSessionBackend({ currentTimeMs, findUser, hash, httpError, now, randomHex }) {
  function invalidSession() {
    return httpError(401, "NATIVE_SESSION_INVALID", "앱 로그인 세션을 확인할 수 없습니다.");
  }

  function bearerCredential(req) {
    const authorization = String(req.headers.authorization || "");
    const match = authorization.match(/^Bearer ([A-Za-z0-9_-]+)$/);
    if (!match) throw invalidSession();
    return match[1];
  }

  function matchingSession(db, credential) {
    const credentialHash = hash(credential);
    const match = (db.nativeSessions || []).find((session) => {
      const stored = Buffer.from(String(session.credentialHash || ""), "hex");
      const candidate = Buffer.from(credentialHash, "hex");
      return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
    });
    if (!match || match.revokedAt || currentTimeMs() >= Date.parse(match.expiresAt)) {
      throw invalidSession();
    }
    return match;
  }

  function issueNativeSession(db, userId) {
    const credential = randomHex(32);
    const issuedAt = now();
    const expiresAt = new Date(currentTimeMs() + NATIVE_SESSION_MAX_AGE_MS).toISOString();
    db.nativeSessions.push({
      id: `native_session_${hash(credential).slice(0, 16)}`,
      userId,
      credentialHash: hash(credential),
      issuedAt,
      expiresAt,
      revokedAt: null
    });
    return { credential, expiresAt };
  }

  function authenticateNativeSession(db, req) {
    const session = matchingSession(db, bearerCredential(req));
    return { session, user: findUser(db, session.userId) };
  }

  // Bearer 헤더가 아예 없으면 null(익명 취급), 있는데 무효/만료면 그대로 401을 던진다.
  // 세션이 없다고 조용히 넘어가는 것과 "세션이 있는데 위조됐다"를 구분해야
  // 잘못된/만료된 토큰으로 익명 취급을 우회할 수 없다.
  function optionalAuthenticateNativeSession(db, req) {
    if (!req.headers.authorization) return null;
    return authenticateNativeSession(db, req);
  }

  function nativeSession(db, req) {
    const { user } = authenticateNativeSession(db, req);
    return { user: publicSessionUser(user) };
  }

  // Derives the acting userId from the authenticated bearer session only -- never from
  // req.body/req.params. A native client naming a different userId in its request payload
  // must not be able to act as that user; only a valid, unrevoked session credential can.
  function nativeSessionPrincipal(db, req) {
    const { session } = authenticateNativeSession(db, req);
    return { userId: session.userId };
  }

  function nativeLogout(db, req) {
    const session = matchingSession(db, bearerCredential(req));
    session.revokedAt = now();
    return { revoked: true };
  }

  return {
    authenticateNativeSession,
    issueNativeSession,
    nativeLogout,
    nativeSession,
    nativeSessionPrincipal,
    optionalAuthenticateNativeSession
  };
}
