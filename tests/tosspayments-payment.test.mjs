import test from "node:test";
import assert from "node:assert/strict";
import { adminApi, api, startServer, verifyIdentity } from "./backend-test-utils.mjs";

async function onSaleTicket(baseUrl, eventId = "event_kpop_001") {
  const state = await api(baseUrl, "/api/state");
  const ticket = state.data.tickets.find((item) => item.eventId === eventId && item.status === "ON_SALE");
  assert.ok(ticket, "seeded on-sale ticket exists");
  return ticket;
}

test("tosspayments config is unconfigured by default and never leaks a client key", async (t) => {
  const { baseUrl } = await startServer(t);
  const config = await api(baseUrl, "/api/payments/tosspayments/config");
  assert.equal(config.data.configured, false);
  assert.equal(config.data.clientKey, "");
});

test("tosspayments purchase in mock mode completes end-to-end and records no spurious ledger entries on the happy path", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const ticket = await onSaleTicket(server.baseUrl);

  const purchase = await api(server.baseUrl, "/api/payments/tosspayments/purchase", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_happy"
  }, 200, { "X-Idempotency-Key": "toss-happy-path" });

  assert.equal(purchase.data.ticket.id, ticket.id);
  assert.equal(purchase.data.ticket.status, "OWNED");
  assert.ok(purchase.data.tosspayments.tossPaymentKey.startsWith("toss_mock_"));
  assert.equal(purchase.data.tosspayments.mock, true);
  assert.equal(purchase.data.tosspayments.method, "카드");

  const audit = await adminApi(server, "/api/admin/workspaces/audit?action=TOSSPAYMENTS_PAYMENT_NEEDS_REFUND");
  assert.equal(audit.data.ledger.length, 0, "a successful purchase never writes a needs-refund entry");
});

test("tosspayments purchase without an idempotency key returns 400 and touches nothing", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const ticket = await onSaleTicket(server.baseUrl);

  const rejected = await api(server.baseUrl, "/api/payments/tosspayments/purchase", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_no_key"
  }, 400);
  assert.equal(rejected.error.code, "IDEMPOTENCY_KEY_REQUIRED");

  const state = await api(server.baseUrl, "/api/state");
  const stillOnSale = state.data.tickets.find((item) => item.id === ticket.id);
  assert.equal(stillOnSale.status, "ON_SALE", "the ticket was never touched by the rejected request");

  const audit = await adminApi(server, "/api/admin/workspaces/audit?action=TOSSPAYMENTS_PAYMENT_NEEDS_REFUND");
  assert.equal(audit.data.ledger.length, 0, "no needs-refund entry was written for a request that never captured payment");
});

test("retrying a tosspayments purchase with the same idempotency key returns the original purchase instead of buying again", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const ticket = await onSaleTicket(server.baseUrl);
  const payload = {
    userId: "user_fan_a",
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_retry"
  };

  const first = await api(server.baseUrl, "/api/payments/tosspayments/purchase", payload, 200, { "X-Idempotency-Key": "toss-retry-key" });
  const retry = await api(server.baseUrl, "/api/payments/tosspayments/purchase", payload, 200, { "X-Idempotency-Key": "toss-retry-key" });

  assert.deepEqual(retry.data.ticket, first.data.ticket, "the retried response resolves to the same purchased ticket");
  assert.equal(retry.data.tosspayments.tossPaymentKey, first.data.tosspayments.tossPaymentKey, "the retry reports the same underlying transaction");
  assert.equal(retry.data.tosspayments.replayed, true, "the retry is explicitly marked as a replay, not a fresh confirmation");

  const finance = await adminApi(server, `/api/admin/workspaces/finance?eventId=${ticket.eventId}&limit=100`);
  const transactionsForTicket = finance.data.transactions.filter((item) => item.ticketId === ticket.id);
  assert.equal(transactionsForTicket.length, 1, "only one payment transaction was ever recorded for the ticket");
});

test("reusing a tosspayments idempotency key for a different ticket is rejected instead of silently buying both", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const state = await api(server.baseUrl, "/api/state");
  const onSale = state.data.tickets.filter((item) => item.eventId === "event_kpop_001" && item.status === "ON_SALE");
  assert.ok(onSale.length >= 2, "at least two seeded on-sale tickets exist");
  const [ticketA, ticketB] = onSale;

  await api(server.baseUrl, "/api/payments/tosspayments/purchase", {
    userId: "user_fan_a",
    ticketId: ticketA.id,
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_conflict_a"
  }, 200, { "X-Idempotency-Key": "toss-conflict-key" });

  const conflict = await api(server.baseUrl, "/api/payments/tosspayments/purchase", {
    userId: "user_fan_a",
    ticketId: ticketB.id,
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_conflict_b"
  }, 409, { "X-Idempotency-Key": "toss-conflict-key" });
  assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  const finance = await adminApi(server, `/api/admin/workspaces/finance?eventId=event_kpop_001&limit=100`);
  assert.equal(finance.data.transactions.some((item) => item.ticketId === ticketB.id), false, "the conflicting second ticket was never purchased");
});

test("tosspayments purchase records a manual-refund ledger entry when capture wins but allocation loses", async (t) => {
  // Given: two verified users race to buy the final same ticket through the TossPayments route.
  const server = await startServer(t, { env: { TIG_TOSSPAYMENTS_MOCK_CONFIRM_DELAY_MS: "50" } });
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  await verifyIdentity(server.baseUrl, "user_fan_b", "010-9000-0002");
  const ticket = await onSaleTicket(server.baseUrl);

  // When: both requests pass the pre-confirmation availability check before one allocation wins.
  const responses = await Promise.all([
    fetch(`${server.baseUrl}/api/payments/tosspayments/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Idempotency-Key": "toss-race-a" },
      body: JSON.stringify({ userId: "user_fan_a", ticketId: ticket.id, paymentMethod: "CREDIT_CARD", tossPaymentKey: "toss_test_key_race_a" })
    }),
    fetch(`${server.baseUrl}/api/payments/tosspayments/purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Idempotency-Key": "toss-race-b" },
      body: JSON.stringify({ userId: "user_fan_b", ticketId: ticket.id, paymentMethod: "CREDIT_CARD", tossPaymentKey: "toss_test_key_race_b" })
    })
  ]);
  const payloads = await Promise.all(responses.map((response) => response.json()));
  const success = payloads.find((payload) => payload.ok);
  const failed = payloads.find((payload) => !payload.ok);

  // Then: one purchase succeeds and the captured loser gets an explicit refund-needed error plus ledger trail.
  assert.ok(success);
  assert.equal(success.data.ticket.id, ticket.id);
  assert.equal(failed.error.code, "PAYMENT_CAPTURED_ALLOCATION_FAILED");
  assert.ok(failed.error.detail.tossPaymentKey);
  const audit = await adminApi(server, "/api/admin/workspaces/audit?action=TOSSPAYMENTS_PAYMENT_NEEDS_REFUND");
  assert.equal(audit.data.ledger.length, 1);
  assert.equal(audit.data.ledger[0].payload.ticketId, ticket.id);
  assert.equal(audit.data.ledger[0].payload.tossPaymentKey, failed.error.detail.tossPaymentKey);
  assert.equal(audit.data.ledger[0].payload.reason, "TICKET_NOT_AVAILABLE");
});

test("tosspayments purchase rejects malformed requests before any payment attempt", async (t) => {
  const { baseUrl } = await startServer(t);
  await verifyIdentity(baseUrl, "user_fan_a", "010-9000-0001");
  const ticket = await onSaleTicket(baseUrl);

  const missingPaymentKey = await api(baseUrl, "/api/payments/tosspayments/purchase", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD"
  }, 400, { "X-Idempotency-Key": "toss-missing-key" });
  assert.equal(missingPaymentKey.error.code, "MISSING_FIELD");
});
