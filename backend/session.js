import { createRemoteJWKSet, jwtVerify } from "jose";
import { createSocialOAuthBackend } from "./social-oauth.js";
import { publicSessionUser } from "./session-user.js";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_AUTH_TEST_CREDENTIAL = "ticketground-google-test-credential";

export function createSessionBackend({ appendLedger, currentTimeMs, findUser, hmac, httpError, issueNativeSession, now, stableId }) {
  const socialOAuth = createSocialOAuthBackend({
    appendLedger,
    currentTimeMs,
    hmac,
    httpError,
    now,
    publicSessionUser,
    stableId
  });

  function googleAuthError() {
    return httpError(401, "GOOGLE_AUTH_INVALID", "Google 인증 정보를 확인할 수 없습니다.");
  }

  function googleClientId() {
    const clientId = process.env.TIG_GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (clientId) return clientId;
    throw httpError(500, "GOOGLE_AUTH_NOT_CONFIGURED", "Google 로그인 클라이언트 ID가 설정되지 않았습니다.");
  }

  function googleSessionUser(db, claims) {
    const subject = String(claims.sub || "").trim();
    const email = String(claims.email || "").trim();
    const name = String(claims.name || email || "Google 사용자").trim();
    const emailVerified = claims.email_verified === true;
    if (!subject || !email || !emailVerified) throw googleAuthError();

    const id = claims.ticketgroundUserId || stableId("google_user", subject);
    const existingUser = db.users.find((user) => user.id === id);
    if (existingUser) {
      return existingUser;
    }

    const user = {
      id,
      name,
      balance: 0,
      status: "ACTIVE",
      trustScore: 90,
      sanctions: [],
      profileConfirmedAt: null
    };
    db.users.push(user);
    appendLedger(db, user.id, "GOOGLE_USER_REGISTERED", {
      provider: "google",
      emailHash: stableId("google_email", email),
      registeredAt: now()
    });
    return user;
  }

  async function verifyGoogleCredential(credential) {
    const token = String(credential || "").trim();
    if (!token) throw googleAuthError();
    if (process.env.TIG_GOOGLE_AUTH_TEST_MODE === "1" && token === GOOGLE_AUTH_TEST_CREDENTIAL) {
      return {
        sub: "test",
        email: "google-test@ticketground.local",
        email_verified: true,
        name: "Google 테스트 사용자",
        ticketgroundUserId: "google_user_test"
      };
    }
    const audience = googleClientId();
    try {
      const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
        audience,
        issuer: GOOGLE_ISSUERS
      });
      return payload;
    } catch {
      throw googleAuthError();
    }
  }

  function demoSession(db, userId) {
    return publicSessionUser(findUser(db, userId));
  }

  async function googleSession(db, { credential }) {
    const user = googleSessionUser(db, await verifyGoogleCredential(credential));
    appendLedger(db, user.id, "GOOGLE_SESSION_CREATED", {
      provider: "google",
      authenticatedAt: now()
    });
    return publicSessionUser(user);
  }

  async function googleNativeSession(db, { credential }) {
    const user = googleSessionUser(db, await verifyGoogleCredential(credential));
    const session = issueNativeSession(db, user.id);
    appendLedger(db, user.id, "GOOGLE_NATIVE_SESSION_CREATED", {
      provider: "google",
      authenticatedAt: now(),
      expiresAt: session.expiresAt
    });
    return { user: publicSessionUser(user), session };
  }

  function updateDemoProfile(db, { userId, name }) {
    const user = findUser(db, userId);
    const nextName = String(name || "").trim();
    if (!nextName || nextName.length > 12) {
      throw httpError(422, "INVALID_PROFILE_NAME", "닉네임은 1자 이상 12자 이하로 입력해주세요.");
    }
    const previousName = user.name;
    user.name = nextName;
    user.profileConfirmedAt = now();
    appendLedger(db, user.id, "DEMO_PROFILE_UPDATED", {
      previousNameHash: stableId("profile_name", previousName),
      nextNameHash: stableId("profile_name", nextName),
      updatedAt: now(),
      policy: "demo-session-profile-edit"
    });
    return publicSessionUser(user);
  }

  return {
    demoSession,
    googleNativeSession,
    googleSession,
    socialAuthCallback: socialOAuth.socialAuthCallback,
    socialAuthPreflight: socialOAuth.socialAuthPreflight,
    socialAuthSession: socialOAuth.socialAuthSession,
    socialAuthStart: socialOAuth.socialAuthStart,
    updateDemoProfile
  };
}
