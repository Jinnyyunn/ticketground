import test from "node:test";
import assert from "node:assert/strict";
import { adminApi, api, startServer, verifyIdentity } from "./backend-test-utils.mjs";

async function onSaleTicket(baseUrl, eventId = "event_kpop_001") {
  const state = await api(baseUrl, "/api/state");
  const ticket = state.data.tickets.find((item) => item.eventId === eventId && item.status === "ON_SALE");
  assert.ok(ticket, "seeded on-sale ticket exists");
  return ticket;
}

test("retrying a ticket purchase with the same idempotency key returns the original purchase instead of buying again", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const ticket = await onSaleTicket(server.baseUrl);
  const idempotencyKey = "retry-key-same-ticket";
  const payload = { userId: "user_fan_a", ticketId: ticket.id, paymentMethod: "CREDIT_CARD" };

  const first = await api(server.baseUrl, "/api/tickets/buy", payload, 200, { "X-Idempotency-Key": idempotencyKey });
  const retry = await api(server.baseUrl, "/api/tickets/buy", payload, 200, { "X-Idempotency-Key": idempotencyKey });

  assert.deepEqual(retry.data, first.data, "the retried response is byte-for-byte the original purchase result");

  const finance = await adminApi(server, `/api/admin/workspaces/finance?eventId=${ticket.eventId}&limit=100`);
  const transactionsForTicket = finance.data.transactions.filter((item) => item.ticketId === ticket.id);
  assert.equal(transactionsForTicket.length, 1, "only one payment transaction was ever recorded for the ticket");
});

test("reusing an idempotency key for a different ticket is rejected instead of silently buying both", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const state = await api(server.baseUrl, "/api/state");
  const onSale = state.data.tickets.filter((item) => item.eventId === "event_kpop_001" && item.status === "ON_SALE");
  assert.ok(onSale.length >= 2, "at least two seeded on-sale tickets exist");
  const [ticketA, ticketB] = onSale;
  const idempotencyKey = "retry-key-conflict";

  await api(server.baseUrl, "/api/tickets/buy", {
    userId: "user_fan_a",
    ticketId: ticketA.id,
    paymentMethod: "CREDIT_CARD"
  }, 200, { "X-Idempotency-Key": idempotencyKey });

  const conflict = await api(server.baseUrl, "/api/tickets/buy", {
    userId: "user_fan_a",
    ticketId: ticketB.id,
    paymentMethod: "CREDIT_CARD"
  }, 409, { "X-Idempotency-Key": idempotencyKey });
  assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  const finance = await adminApi(server, `/api/admin/workspaces/finance?eventId=event_kpop_001&limit=100`);
  assert.equal(finance.data.transactions.some((item) => item.ticketId === ticketB.id), false, "the conflicting second ticket was never purchased");
});

test("ticket purchase without an idempotency key keeps working exactly as before", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const ticket = await onSaleTicket(server.baseUrl);

  const purchased = await api(server.baseUrl, "/api/tickets/buy", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD"
  });
  assert.equal(purchased.data.ticket.id, ticket.id);

  const repeat = await api(server.baseUrl, "/api/tickets/buy", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD"
  }, 409);
  assert.equal(repeat.error.code, "TICKET_NOT_AVAILABLE", "without a key, a second attempt is rejected as unavailable, not silently deduplicated");
});
