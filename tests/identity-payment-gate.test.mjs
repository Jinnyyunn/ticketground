import test from "node:test";
import assert from "node:assert/strict";
import { api, startServer } from "./backend-test-utils.mjs";

test("primary ticket purchase requires PortOne Danal identity verification and blocks duplicate verified phone numbers", async (t) => {
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

  // Given: the same user starts and confirms PortOne Danal phone verification.
  const started = await api(baseUrl, "/api/identity/portone-danal/start", {
    userId: "user_fan_a",
    phone: "010-1234-5678",
  });
  assert.equal(started.data.provider, "portone-danal");
  assert.equal(started.data.status, "PENDING");
  assert.equal(started.data.phoneMasked, "010-****-5678");
  assert.equal(started.data.portOneConfigured, false);
  assert.equal(started.data.mockAvailable, true);

  const verified = await api(baseUrl, "/api/identity/portone-danal/confirm", {
    userId: "user_fan_a",
    phone: "010-1234-5678",
    identityVerificationId: started.data.identityVerificationId,
  });
  assert.equal(verified.data.verified, true);
  assert.equal(verified.data.provider, "portone-danal");
  assert.equal(verified.data.phoneMasked, "010-****-5678");

  // When: another account tries to verify the same phone.
  const duplicate = await api(baseUrl, "/api/identity/portone-danal/start", {
    userId: "user_fan_b",
    phone: "010-1234-5678",
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
