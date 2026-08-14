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

  function nativeSession(db, req) {
    const session = matchingSession(db, bearerCredential(req));
    return { user: publicSessionUser(findUser(db, session.userId)) };
  }

  function nativeSessionPrincipal(db, req) {
    const session = matchingSession(db, bearerCredential(req));
    findUser(db, session.userId);
    return { userId: session.userId };
  }

  function nativeLogout(db, req) {
    const session = matchingSession(db, bearerCredential(req));
    session.revokedAt = now();
    return { revoked: true };
  }

  return { issueNativeSession, nativeLogout, nativeSession, nativeSessionPrincipal };
}
