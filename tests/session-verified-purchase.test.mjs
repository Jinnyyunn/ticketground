import assert from "node:assert/strict";
import test from "node:test";

import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";
import { configureSocialEnv, cookieHeaderFromSetCookie, PROVIDERS, redirected } from "./social-auth-test-helpers.mjs";

async function verifyIdentityFor(baseUrl, userId, phone) {
  const started = await api(baseUrl, "/api/identity/nice/start", { userId });
  await api(baseUrl, "/api/identity/nice/mock-complete", {
    userId,
    phone,
    identityVerificationId: started.data.identityVerificationId
  });
}

test("Google web login issues a session credential that later purchase calls can use", async (t) => {
  configureGoogleEnv(t, true);
  const { baseUrl } = await startServer(t);

  const login = await api(baseUrl, "/api/auth/google", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  assert.equal(login.data.id, "google_user_test");
  assert.equal(typeof login.data.credential, "string");
  assert.ok(login.data.credential.length >= 43);
  assert.match(login.data.credentialExpiresAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("a logged-in session cannot be spoofed by sending a different userId in the request body", async (t) => {
  configureGoogleEnv(t, true);
  const { baseUrl } = await startServer(t);

  const login = await api(baseUrl, "/api/auth/google", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  const credential = login.data.credential;
  await verifyIdentityFor(baseUrl, "google_user_test", "010-1234-5678");

  const state = await api(baseUrl, "/api/state");
  const ticket = state.data.tickets.find((item) => item.eventId === "event_kpop_001" && item.status === "ON_SALE");
  assert.ok(ticket, "seeded kpop ticket exists");

  // 요청 본문에는 다른 사람(user_fan_a)의 id를 넣어 사칭을 시도한다.
  const purchase = await api(
    baseUrl,
    "/api/tickets/buy",
    { userId: "user_fan_a", ticketId: ticket.id, paymentMethod: "CREDIT_CARD" },
    200,
    { Authorization: `Bearer ${credential}` }
  );

  // 실제로는 세션의 진짜 주인(google_user_test)에게 배정되어야 한다.
  assert.equal(purchase.data.ticket.status, "OWNED");
  const buyerTickets = await api(baseUrl, "/api/users/google_user_test/tickets");
  assert.ok(buyerTickets.data.some((item) => item.id === ticket.id), "the session owner actually received the ticket");
  const spoofedTargetTickets = await api(baseUrl, "/api/users/user_fan_a/tickets");
  assert.ok(
    !spoofedTargetTickets.data.some((item) => item.id === ticket.id),
    "the spoofed body.userId must not receive the ticket"
  );
});

test("invalid or expired bearer credentials are rejected instead of silently falling back to anonymous", async (t) => {
  configureGoogleEnv(t, true);
  const { baseUrl } = await startServer(t);
  const state = await api(baseUrl, "/api/state");
  const ticket = state.data.tickets.find((item) => item.eventId === "event_kpop_001" && item.status === "ON_SALE");

  const rejected = await api(
    baseUrl,
    "/api/tickets/buy",
    { userId: "user_fan_a", ticketId: ticket.id, paymentMethod: "CREDIT_CARD" },
    401,
    { Authorization: "Bearer not-a-real-credential" }
  );
  assert.equal(rejected.error.code, "NATIVE_SESSION_INVALID");

  const unchangedState = await api(baseUrl, "/api/state");
  const unchangedTicket = unchangedState.data.tickets.find((item) => item.id === ticket.id);
  assert.equal(unchangedTicket.status, "ON_SALE");
});

test("anonymous requests without a bearer credential keep working against the caller-supplied userId", async (t) => {
  configureGoogleEnv(t, true);
  const { baseUrl } = await startServer(t);
  await verifyIdentityFor(baseUrl, "user_fan_a", "010-9000-0001");

  const state = await api(baseUrl, "/api/state");
  const ticket = state.data.tickets.find((item) => item.eventId === "event_kpop_001" && item.status === "ON_SALE");

  const purchase = await api(baseUrl, "/api/tickets/buy", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD"
  });
  assert.equal(purchase.data.ticket.status, "OWNED");
});

test("Kakao web login session also issues a credential that identity verification honors", async (t) => {
  configureSocialEnv(t, true);
  const { baseUrl } = await startServer(t);

  const start = await fetch(`${baseUrl}/api/auth/kakao/start`, { redirect: "manual" });
  const authorizeUrl = new URL(await redirected(start));
  const state = authorizeUrl.searchParams.get("state");
  const callback = await fetch(`${baseUrl}/api/auth/kakao/callback?code=${PROVIDERS.kakao.code}&state=${encodeURIComponent(state)}`, {
    headers: { cookie: cookieHeaderFromSetCookie(start.headers.get("set-cookie")) },
    redirect: "manual"
  });
  const sessionResponse = await fetch(`${baseUrl}/api/auth/kakao/session`, {
    headers: { cookie: cookieHeaderFromSetCookie(callback.headers.get("set-cookie")) }
  });
  assert.equal(sessionResponse.status, 200);
  const session = (await sessionResponse.json()).data;
  assert.equal(typeof session.credential, "string");
  assert.ok(session.credential.length >= 43);

  // 요청 본문에는 다른 사람(someone-else)의 id를 넣어 사칭을 시도한다.
  const started = await api(
    baseUrl,
    "/api/identity/nice/start",
    { userId: "someone-else" },
    200,
    { Authorization: `Bearer ${session.credential}` }
  );
  assert.equal(started.data.provider, "nice-standard");

  const confirmed = await api(
    baseUrl,
    "/api/identity/nice/mock-complete",
    { userId: "someone-else", phone: "010-5555-6666", identityVerificationId: started.data.identityVerificationId },
    200,
    { Authorization: `Bearer ${session.credential}` }
  );
  assert.equal(confirmed.data.verified, true);

  // 실제로는 세션의 진짜 주인(카카오 사용자)에게 귀속되어야 하고, 사칭 대상에게는 아무 일도 없어야 한다.
  // 본인인증 상태 조회 자체도 세션 소유자만 가능하다 (다른 사람의 인증 상태를 훔쳐볼 수 없음).
  const identity = await api(baseUrl, `/api/users/${session.id}/identity`, undefined, 200, {
    Authorization: `Bearer ${session.credential}`
  });
  assert.equal(identity.data.verified, true);
  assert.equal(identity.data.phoneMasked, "010-****-6666");

  const spoofedTargetIdentity = await api(baseUrl, "/api/users/someone-else/identity", undefined, 403, {
    Authorization: `Bearer ${session.credential}`
  });
  assert.equal(spoofedTargetIdentity.error.code, "NOT_OWNER");
});
