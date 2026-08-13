import test from "node:test";
import assert from "node:assert/strict";
import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

test("primary ticket purchase requires NICE identity verification and blocks duplicate verified phone numbers", async (t) => {
  // Given: an on-sale ticket and a user that has not completed identity verification.
  const { baseUrl } = await startServer(t);
  const state = await api(baseUrl, "/api/state");
  const ticket = state.data.tickets.find((item) => item.eventId === "event_kpop_001" && item.status === "ON_SALE");
  assert.ok(ticket, "seeded kpop ticket exists");

  // When: the unverified user tries to pay.
  const blockedPurchase = await api(baseUrl, "/api/tickets/buy", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD",
  }, 403);

  // Then: the backend blocks payment before ticket ownership changes.
  assert.equal(blockedPurchase.error.code, "IDENTITY_VERIFICATION_REQUIRED");
  const unchangedState = await api(baseUrl, "/api/state");
  const unchangedTicket = unchangedState.data.tickets.find((item) => item.id === ticket.id);
  assert.equal(unchangedTicket.status, "ON_SALE");

  // Given: the same user starts NICE verification and completes it (local QA mock path -
  // NODE_ENV=production blocks the real NICE round trip, so startServer() enables
  // TIG_NICE_IDENTITY_TEST_MODE and the mock-complete endpoint stands in for the real
  // browser-driven callback).
  const started = await api(baseUrl, "/api/identity/nice/start", { userId: "user_fan_a" });
  assert.equal(started.data.provider, "nice-standard");
  assert.equal(started.data.status, "PENDING");
  assert.equal(started.data.authUrl, null);
  assert.equal(started.data.niceConfigured, false);
  assert.equal(started.data.mockAvailable, true);

  const verified = await api(baseUrl, "/api/identity/nice/mock-complete", {
    userId: "user_fan_a",
    phone: "010-1234-5678",
    identityVerificationId: started.data.identityVerificationId,
  });
  assert.equal(verified.data.verified, true);
  assert.equal(verified.data.provider, "nice-standard");
  assert.equal(verified.data.phoneMasked, "010-****-5678");

  // When: another account tries to verify the same phone.
  const otherStart = await api(baseUrl, "/api/identity/nice/start", { userId: "user_fan_b" });
  const duplicate = await api(baseUrl, "/api/identity/nice/mock-complete", {
    userId: "user_fan_b",
    phone: "010-1234-5678",
    identityVerificationId: otherStart.data.identityVerificationId,
  }, 409);

  // Then: one verified phone cannot be reused by another account.
  assert.equal(duplicate.error.code, "PHONE_ALREADY_VERIFIED");

  // When: the verified user pays again.
  const purchase = await api(baseUrl, "/api/tickets/buy", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD",
  });

  // Then: payment and ticket ownership can proceed.
  assert.equal(purchase.data.ticket.status, "OWNED");
  assert.equal(purchase.data.payment.status, "PAID");
});

test("the NICE mock-complete endpoint is unavailable when mock mode is off", async (t) => {
  // Given: a server started without TIG_NICE_IDENTITY_TEST_MODE and in production mode -
  // mock verification must stay blocked in that state. mockCompleteNiceVerification()
  // checks niceMockAllowed() before touching the db, so this doesn't need a real pending
  // record (and deliberately avoids /api/identity/nice/start here - with real NICE
  // credentials configured, test mode off means start attempts the live NICE API instead
  // of returning a mock-friendly response, which is a separate concern from this gate).
  const { baseUrl } = await startServer(t, { env: { TIG_NICE_IDENTITY_TEST_MODE: "0", NODE_ENV: "production" } });

  const blocked = await api(baseUrl, "/api/identity/nice/mock-complete", {
    userId: "user_fan_a",
    phone: "010-1234-5678",
    identityVerificationId: "idv_does_not_exist",
  }, 404);
  assert.equal(blocked.error.code, "NOT_FOUND");
});

test("identity status lookup requires a session and refuses to reveal another account's verification status", async (t) => {
  configureGoogleEnv(t, true);
  const { baseUrl } = await startServer(t);

  // Given: two accounts, one of which has completed identity verification.
  const started = await api(baseUrl, "/api/identity/nice/start", { userId: "user_fan_a" });
  await api(baseUrl, "/api/identity/nice/mock-complete", {
    userId: "user_fan_a",
    phone: "010-1234-5678",
    identityVerificationId: started.data.identityVerificationId,
  });

  // When: nobody is logged in at all.
  const anonymous = await api(baseUrl, "/api/users/user_fan_a/identity", undefined, 401);
  assert.equal(anonymous.error.code, "NATIVE_SESSION_INVALID");

  // Given: a different, unrelated logged-in session (google_user_test).
  const login = await api(baseUrl, "/api/auth/google", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  const credential = login.data.credential;

  // When: that session tries to read user_fan_a's verification status by
  // guessing/knowing their userId (the actual attack #105 flagged).
  const crossAccountLookup = await api(baseUrl, "/api/users/user_fan_a/identity", undefined, 403, {
    Authorization: `Bearer ${credential}`,
  });
  assert.equal(crossAccountLookup.error.code, "NOT_OWNER");

  // Then: the same session can still read its own (unverified) status.
  const ownStatus = await api(baseUrl, "/api/users/google_user_test/identity", undefined, 200, {
    Authorization: `Bearer ${credential}`,
  });
  assert.equal(ownStatus.data.verified, false);
});
