import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { adminApi, api, startServer, verifyIdentity } from "./backend-test-utils.mjs";

async function purchaseTicketViaTosspayments(server, { idempotencyKey = "toss-admin-cancel-key" } = {}) {
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const state = await api(server.baseUrl, "/api/state");
  const ticket = state.data.tickets.find((item) => item.eventId === "event_kpop_001" && item.status === "ON_SALE");
  assert.ok(ticket, "seeded on-sale ticket exists");
  const purchase = await api(server.baseUrl, "/api/payments/tosspayments/purchase", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_admin_cancel"
  }, 200, { "X-Idempotency-Key": idempotencyKey });
  return { ticket, tossPaymentKey: purchase.data.tosspayments.tossPaymentKey };
}

test("admin can cancel a tosspayments purchase and the cancellation is recorded on the ledger", async (t) => {
  const server = await startServer(t);
  const { ticket, tossPaymentKey } = await purchaseTicketViaTosspayments(server);

  const cancel = await adminApi(server, "/api/admin/payments/tosspayments/cancel", {
    tossPaymentKey,
    cancelReason: "고객 요청 환불"
  });
  assert.equal(cancel.data.tossPaymentKey, tossPaymentKey);
  assert.equal(cancel.data.status, "CANCELED");
  assert.equal(cancel.data.mock, true);

  const audit = await adminApi(server, "/api/admin/workspaces/audit?action=TOSSPAYMENTS_ADMIN_CANCEL");
  assert.equal(audit.data.ledger.length, 1);
  assert.equal(audit.data.ledger[0].payload.tossPaymentKey, tossPaymentKey);
  assert.equal(audit.data.ledger[0].payload.ticketId, ticket.id);
  assert.equal(audit.data.ledger[0].payload.userId, "user_fan_a");
  assert.equal(audit.data.ledger[0].payload.cancelReason, "고객 요청 환불");

  // Payment-side refund only - ticket ownership/status must be untouched.
  const state = await api(server.baseUrl, "/api/state");
  const stillOwned = state.data.tickets.find((item) => item.id === ticket.id);
  assert.equal(stillOwned.status, "OWNED");
});

test("admin cancel requires a cancel reason and rejects before touching TossPayments", async (t) => {
  const server = await startServer(t);
  const { tossPaymentKey } = await purchaseTicketViaTosspayments(server);

  const rejected = await adminApi(server, "/api/admin/payments/tosspayments/cancel", {
    tossPaymentKey
  }, 400);
  assert.equal(rejected.error.code, "MISSING_FIELD");
});

test("admin cancel rejects an unknown paymentKey instead of calling TossPayments blind", async (t) => {
  const server = await startServer(t);
  await purchaseTicketViaTosspayments(server);

  const rejected = await adminApi(server, "/api/admin/payments/tosspayments/cancel", {
    tossPaymentKey: "toss_never_existed",
    cancelReason: "환불"
  }, 404);
  assert.equal(rejected.error.code, "TOSSPAYMENTS_TRANSACTION_NOT_FOUND");
});

test("admin cancel is not reachable from the public surface", async (t) => {
  const server = await startServer(t);
  const { tossPaymentKey } = await purchaseTicketViaTosspayments(server);

  const rejected = await api(server.baseUrl, "/api/admin/payments/tosspayments/cancel", {
    tossPaymentKey,
    cancelReason: "환불"
  }, 404);
  assert.equal(rejected.error.code, "NOT_FOUND");
});

test("tosspayments webhook accepts an unsigned PAYMENT_STATUS_CHANGED event for reconciliation only, without mutating any state", async (t) => {
  const server = await startServer(t);
  const { ticket, tossPaymentKey } = await purchaseTicketViaTosspayments(server);

  const response = await api(server.baseUrl, "/api/webhooks/tosspayments", {
    eventType: "PAYMENT_STATUS_CHANGED",
    data: { paymentKey: tossPaymentKey, status: "DONE" }
  });
  assert.equal(response.data.received, true);

  const audit = await adminApi(server, "/api/admin/workspaces/audit?action=TOSSPAYMENTS_WEBHOOK_RECEIVED");
  assert.equal(audit.data.ledger.length, 1);
  assert.equal(audit.data.ledger[0].payload.eventType, "PAYMENT_STATUS_CHANGED");
  assert.equal(audit.data.ledger[0].payload.tossPaymentKey, tossPaymentKey);
  assert.equal(audit.data.ledger[0].payload.signed, false, "PAYMENT_STATUS_CHANGED is never signed by TossPayments");
  assert.equal(audit.data.ledger[0].payload.matchedTicketId, ticket.id);

  // The whole point of the webhook route: it must never itself grant/alter
  // ticket ownership or payment state, signed or not.
  const state = await api(server.baseUrl, "/api/state");
  const untouched = state.data.tickets.find((item) => item.id === ticket.id);
  assert.equal(untouched.status, "OWNED");
});

test("tosspayments webhook rejects a signature that does not verify", async (t) => {
  const server = await startServer(t, { env: { TIG_TOSSPAYMENTS_WEBHOOK_SECRET: "webhook-test-secret" } });

  const response = await fetch(`${server.baseUrl}/api/webhooks/tosspayments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "tosspayments-webhook-signature": "v1:bm90LXRoZS1yaWdodC1zaWduYXR1cmU=",
      "tosspayments-webhook-transmission-time": "2026-08-07T00:00:00Z"
    },
    body: JSON.stringify({ eventType: "payout.changed", data: {} })
  });
  const json = await response.json();
  assert.equal(response.status, 401);
  assert.equal(json.error.code, "TOSSPAYMENTS_WEBHOOK_SIGNATURE_INVALID");
});

test("tosspayments webhook accepts a correctly computed signature", async (t) => {
  const webhookSecret = "webhook-test-secret";
  const server = await startServer(t, { env: { TIG_TOSSPAYMENTS_WEBHOOK_SECRET: webhookSecret } });

  const rawBody = JSON.stringify({ eventType: "payout.changed", data: { paymentKey: "toss_payout_case" } });
  const transmissionTime = "2026-08-07T00:00:00Z";
  const signature = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${rawBody}:${transmissionTime}`)
    .digest("base64");

  const response = await fetch(`${server.baseUrl}/api/webhooks/tosspayments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "tosspayments-webhook-signature": `v1:${signature}`,
      "tosspayments-webhook-transmission-time": transmissionTime
    },
    body: rawBody
  });
  const json = await response.json();
  assert.equal(response.status, 200);
  assert.equal(json.data.received, true);

  const audit = await adminApi(server, "/api/admin/workspaces/audit?action=TOSSPAYMENTS_WEBHOOK_RECEIVED");
  assert.equal(audit.data.ledger.length, 1);
  assert.equal(audit.data.ledger[0].payload.signed, true);
});
