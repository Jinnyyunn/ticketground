// Regression coverage for the multi-seat purchase bug: selecting 2 seats
// used to only ever charge for and deliver 1 ticket (booking-panel.tsx's
// checkoutHref dropped every ticketId after the first). These tests exercise
// the fix end-to-end at the API layer - the same layer both the singular
// buyPrimary()/buyPrimaryGroup() purchase routes are built on - covering the
// happy path, idempotency/replay, duplicate/oversized/cross-performance
// rejection, the amount the (real, non-mock) TossPayments confirm path must
// see, and the atomicity guarantee that a group purchase never partially
// applies.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { createTicketgroundApp } from "../backend/app.js";
import { adminApi, api, startServer as startBackendServer, verifyIdentity } from "./backend-test-utils.mjs";

function startServer(t, options = {}) {
  return startBackendServer(t, {
    ...options,
    env: {
      NODE_ENV: "test",
      TIG_TOSSPAYMENTS_TEST_MODE: "1",
      ...options.env
    }
  });
}

async function onSaleTickets(baseUrl, count = 2, eventId = "event_kpop_001") {
  const state = await api(baseUrl, "/api/state");
  const byDate = new Map();
  for (const ticket of state.data.tickets) {
    if (ticket.status !== "ON_SALE" || ticket.eventId !== eventId) continue;
    const bucket = byDate.get(ticket.performanceDateId) || [];
    bucket.push(ticket);
    byDate.set(ticket.performanceDateId, bucket);
  }
  for (const tickets of byDate.values()) {
    if (tickets.length >= count) return tickets.slice(0, count);
  }
  throw new Error("no performance date has enough ON_SALE tickets for this test");
}

test("a two-seat tosspayments purchase charges the full summed total and delivers both tickets as owned", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const [ticketA, ticketB] = await onSaleTickets(server.baseUrl, 2);
  const expectedTotal = ticketA.faceValue + ticketB.faceValue + 2 * 2000;

  const purchase = await api(server.baseUrl, "/api/payments/tosspayments/purchase", {
    userId: "user_fan_a",
    ticketIds: [ticketA.id, ticketB.id],
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_group_happy",
    orderId: `order_${ticketA.id}_${ticketB.id}`
  }, 200, { "X-Idempotency-Key": "toss-group-happy-path" });

  assert.equal(purchase.data.tickets.length, 2, "both purchased tickets are reported back");
  assert.deepEqual(
    purchase.data.tickets.map((ticket) => ticket.id).sort(),
    [ticketA.id, ticketB.id].sort()
  );
  assert.ok(purchase.data.tickets.every((ticket) => ticket.status === "OWNED"), "every ticket in the group is OWNED, not just the first");
  assert.equal(purchase.data.payment.amount, expectedTotal, "the reported total covers both seats plus both service fees");
  assert.equal(purchase.data.ticket.id, ticketA.id, "the singular `ticket` field stays back-compatible with the first purchased ticket");

  // The actual server-side ticket state (not just the response payload)
  // confirms neither seat was silently dropped, left held, or left available
  // for someone else to buy out from under this purchase.
  const state = await api(server.baseUrl, "/api/state");
  const stateA = state.data.tickets.find((item) => item.id === ticketA.id);
  const stateB = state.data.tickets.find((item) => item.id === ticketB.id);
  assert.equal(stateA.status, "OWNED");
  assert.equal(stateB.status, "OWNED");
  assert.equal(stateA.available, false);
  assert.equal(stateB.available, false);

  const owned = await api(server.baseUrl, "/api/users/user_fan_a/tickets");
  assert.ok(owned.data.some((ticket) => ticket.id === ticketA.id));
  assert.ok(owned.data.some((ticket) => ticket.id === ticketB.id));

  // Both tickets keep their own paymentTransaction (so per-seat finance
  // reporting/refunds still work), and the two amounts sum to exactly the
  // approved total - no rounding drift, no unaccounted-for seat.
  const finance = await adminApi(server, `/api/admin/workspaces/finance?eventId=${ticketA.eventId}&limit=200`);
  const transactionA = finance.data.transactions.find((item) => item.ticketId === ticketA.id);
  const transactionB = finance.data.transactions.find((item) => item.ticketId === ticketB.id);
  assert.ok(transactionA && transactionB, "both tickets recorded their own payment transaction");
  assert.equal(transactionA.amount + transactionB.amount, expectedTotal);
  assert.equal(transactionA.pgTransactionId, transactionB.pgTransactionId, "both line items share the one TossPayments charge");
});

test("a two-seat purchase through the legacy /api/tickets/buy route also delivers both tickets", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const [ticketA, ticketB] = await onSaleTickets(server.baseUrl, 2);

  const purchase = await api(server.baseUrl, "/api/tickets/buy", {
    userId: "user_fan_a",
    ticketIds: [ticketA.id, ticketB.id],
    paymentMethod: "CREDIT_CARD"
  });

  assert.equal(purchase.data.tickets.length, 2);
  assert.ok(purchase.data.tickets.every((ticket) => ticket.status === "OWNED"));

  const state = await api(server.baseUrl, "/api/state");
  assert.equal(state.data.tickets.find((item) => item.id === ticketA.id).status, "OWNED");
  assert.equal(state.data.tickets.find((item) => item.id === ticketB.id).status, "OWNED");
});

test("single-seat purchases are unaffected: the untouched singular ticketId path still works exactly as before", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const [ticket] = await onSaleTickets(server.baseUrl, 1);

  const purchase = await api(server.baseUrl, "/api/payments/tosspayments/purchase", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_single_regression"
  }, 200, { "X-Idempotency-Key": "toss-single-seat-regression" });

  assert.equal(purchase.data.ticket.id, ticket.id);
  assert.equal(purchase.data.ticket.status, "OWNED");
  assert.equal(purchase.data.tickets.length, 1, "the plural field is a 1-element array for a single-ticket purchase");
  assert.equal(purchase.data.payment.amount, ticket.faceValue + 2000);
});

test("retrying a two-seat tosspayments purchase with the same idempotency key replays instead of buying a second time", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const [ticketA, ticketB] = await onSaleTickets(server.baseUrl, 2);
  const payload = {
    userId: "user_fan_a",
    ticketIds: [ticketA.id, ticketB.id],
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_group_retry",
    orderId: `order_${ticketA.id}_${ticketB.id}`
  };

  const first = await api(server.baseUrl, "/api/payments/tosspayments/purchase", payload, 200, { "X-Idempotency-Key": "toss-group-retry-key" });
  const retry = await api(server.baseUrl, "/api/payments/tosspayments/purchase", payload, 200, { "X-Idempotency-Key": "toss-group-retry-key" });

  assert.deepEqual(
    retry.data.tickets.map((ticket) => ticket.id).sort(),
    first.data.tickets.map((ticket) => ticket.id).sort()
  );
  assert.equal(retry.data.payment.amount, first.data.payment.amount);
  assert.equal(retry.data.tosspayments.replayed, true);

  const finance = await adminApi(server, `/api/admin/workspaces/finance?eventId=${ticketA.eventId}&limit=200`);
  const transactionsForA = finance.data.transactions.filter((item) => item.ticketId === ticketA.id);
  const transactionsForB = finance.data.transactions.filter((item) => item.ticketId === ticketB.id);
  assert.equal(transactionsForA.length, 1, "the retry never created a second transaction for either ticket");
  assert.equal(transactionsForB.length, 1);
});

test("reusing a group idempotency key for a different ticket set is rejected instead of silently buying both sets", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const state = await api(server.baseUrl, "/api/state");
  const onSale = state.data.tickets.filter((item) => item.eventId === "event_kpop_001" && item.status === "ON_SALE");
  assert.ok(onSale.length >= 4, "at least four seeded on-sale tickets exist");
  const byDate = new Map();
  for (const ticket of onSale) {
    const bucket = byDate.get(ticket.performanceDateId) || [];
    bucket.push(ticket);
    byDate.set(ticket.performanceDateId, bucket);
  }
  const [tickets] = [...byDate.values()].filter((bucket) => bucket.length >= 4);
  assert.ok(tickets, "one performance date has at least four on-sale tickets");
  const [ticketA, ticketB, ticketC, ticketD] = tickets;

  await api(server.baseUrl, "/api/payments/tosspayments/purchase", {
    userId: "user_fan_a",
    ticketIds: [ticketA.id, ticketB.id],
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_group_conflict_ab",
    orderId: `order_${ticketA.id}_${ticketB.id}`
  }, 200, { "X-Idempotency-Key": "toss-group-conflict-key" });

  const conflict = await api(server.baseUrl, "/api/payments/tosspayments/purchase", {
    userId: "user_fan_a",
    ticketIds: [ticketC.id, ticketD.id],
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_group_conflict_cd",
    orderId: `order_${ticketC.id}_${ticketD.id}`
  }, 409, { "X-Idempotency-Key": "toss-group-conflict-key" });
  assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  const finalState = await api(server.baseUrl, "/api/state");
  assert.equal(finalState.data.tickets.find((item) => item.id === ticketC.id).status, "ON_SALE", "the conflicting second set was never purchased");
  assert.equal(finalState.data.tickets.find((item) => item.id === ticketD.id).status, "ON_SALE");
});

test("a duplicate ticketId within the same purchase request is rejected", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const [ticket] = await onSaleTickets(server.baseUrl, 1);

  const rejected = await api(server.baseUrl, "/api/payments/tosspayments/purchase", {
    userId: "user_fan_a",
    ticketIds: [ticket.id, ticket.id],
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_duplicate",
    orderId: `order_${ticket.id}`
  }, 422, { "X-Idempotency-Key": "toss-group-duplicate-seat" });
  assert.equal(rejected.error.code, "DUPLICATE_SEAT");

  const state = await api(server.baseUrl, "/api/state");
  assert.equal(state.data.tickets.find((item) => item.id === ticket.id).status, "ON_SALE");
});

test("a purchase request over the max group size is rejected before touching any ticket", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const state = await api(server.baseUrl, "/api/state");
  const onSale = state.data.tickets.filter((item) => item.eventId === "event_kpop_001" && item.status === "ON_SALE");
  const byDate = new Map();
  for (const ticket of onSale) {
    const bucket = byDate.get(ticket.performanceDateId) || [];
    bucket.push(ticket);
    byDate.set(ticket.performanceDateId, bucket);
  }
  const tickets = [...byDate.values()].find((bucket) => bucket.length >= 3);
  assert.ok(tickets, "one performance date has at least three on-sale tickets");

  const rejected = await api(server.baseUrl, "/api/payments/tosspayments/purchase", {
    userId: "user_fan_a",
    ticketIds: tickets.slice(0, 3).map((ticket) => ticket.id),
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_too_many",
    orderId: "order_too_many"
  }, 422, { "X-Idempotency-Key": "toss-group-too-many-seats" });
  assert.equal(rejected.error.code, "TOO_MANY_SEATS");

  const finalState = await api(server.baseUrl, "/api/state");
  for (const ticket of tickets.slice(0, 3)) {
    assert.equal(finalState.data.tickets.find((item) => item.id === ticket.id).status, "ON_SALE");
  }
});

test("tickets from two different performances cannot be purchased together", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const state = await api(server.baseUrl, "/api/state");
  const onSale = state.data.tickets.filter((item) => item.eventId === "event_kpop_001" && item.status === "ON_SALE");
  const byDate = new Map();
  for (const ticket of onSale) {
    const bucket = byDate.get(ticket.performanceDateId) || [];
    bucket.push(ticket);
    byDate.set(ticket.performanceDateId, bucket);
  }
  assert.ok(byDate.size >= 2, "at least two performance dates have on-sale tickets");
  const [ticketFromFirstDate] = byDate.values().next().value;
  const secondDateTickets = [...byDate.values()][1];
  const ticketFromSecondDate = secondDateTickets[0];

  const rejected = await api(server.baseUrl, "/api/payments/tosspayments/purchase", {
    userId: "user_fan_a",
    ticketIds: [ticketFromFirstDate.id, ticketFromSecondDate.id],
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_mismatch",
    orderId: "order_mismatch"
  }, 422, { "X-Idempotency-Key": "toss-group-performance-mismatch" });
  assert.equal(rejected.error.code, "SEAT_PERFORMANCE_MISMATCH");

  const finalState = await api(server.baseUrl, "/api/state");
  assert.equal(finalState.data.tickets.find((item) => item.id === ticketFromFirstDate.id).status, "ON_SALE");
  assert.equal(finalState.data.tickets.find((item) => item.id === ticketFromSecondDate.id).status, "ON_SALE");
});

test("if one seat in a group goes stale between the pre-check and the real commit, the WHOLE group fails and the other seat is left untouched (no partial delivery)", async (t) => {
  // Given: a group purchase for two seats is in flight (its own pre-check
  // saw both as ON_SALE), and - before its TossPayments confirm resolves -
  // one of its two seats becomes unavailable for an unrelated reason (here:
  // an operator takes it out of inventory; a competing buyer completing
  // first would hit the exact same code path). The mock confirm delay
  // widens the window deterministically instead of racing two HTTP
  // requests against each other on the clock.
  const server = await startServer(t, { env: { TIG_TOSSPAYMENTS_MOCK_CONFIRM_DELAY_MS: "150" } });
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const [contested, safe] = await onSaleTickets(server.baseUrl, 2);

  // When: the group purchase starts (its synchronous pre-check runs
  // immediately, then it awaits the delayed confirm)...
  const groupPurchase = fetch(`${server.baseUrl}/api/payments/tosspayments/purchase`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Idempotency-Key": "toss-group-goes-stale" },
    body: JSON.stringify({
      userId: "user_fan_a",
      ticketIds: [contested.id, safe.id],
      paymentMethod: "CREDIT_CARD",
      tossPaymentKey: "toss_test_key_group_stale",
      orderId: `order_${contested.id}_${safe.id}`
    })
  }).then((response) => response.json());

  // ...and, well inside the 150ms confirm delay, `contested` goes stale.
  await new Promise((resolve) => setTimeout(resolve, 40));
  await adminApi(server, "/api/admin/tickets/status", { ticketId: contested.id, status: "ADMIN_HOLD" });

  const groupResult = await groupPurchase;

  // Then: the group purchase is rejected wholesale (payment captured but
  // allocation failed) - `safe` must NOT have been silently sold to
  // user_fan_a just because it was still available; the whole order is
  // all-or-nothing.
  assert.equal(groupResult.ok, false);
  assert.equal(groupResult.error.code, "PAYMENT_CAPTURED_ALLOCATION_FAILED");
  assert.deepEqual(groupResult.error.detail.ticketIds.sort(), [contested.id, safe.id].sort());

  const state = await api(server.baseUrl, "/api/state");
  const safeState = state.data.tickets.find((item) => item.id === safe.id);
  assert.equal(safeState.status, "ON_SALE", "the seat that WAS still available was not partially sold when its sibling in the order went stale");
  assert.equal(safeState.ownerId ?? null, null);

  const audit = await adminApi(server, "/api/admin/workspaces/audit?action=TOSSPAYMENTS_PAYMENT_NEEDS_REFUND");
  assert.ok(
    audit.data.ledger.some((item) => Array.isArray(item.payload.ticketIds)
      && item.payload.ticketIds.includes(contested.id) && item.payload.ticketIds.includes(safe.id)),
    "a needs-refund ledger entry records the captured-but-unallocated group payment for ops to reconcile"
  );
});

test("tosspayments purchase rejects a group request missing orderId before any payment attempt", async (t) => {
  const server = await startServer(t);
  await verifyIdentity(server.baseUrl, "user_fan_a", "010-9000-0001");
  const [ticketA, ticketB] = await onSaleTickets(server.baseUrl, 2);

  const rejected = await api(server.baseUrl, "/api/payments/tosspayments/purchase", {
    userId: "user_fan_a",
    ticketIds: [ticketA.id, ticketB.id],
    paymentMethod: "CREDIT_CARD",
    tossPaymentKey: "toss_test_key_missing_order_id"
  }, 400, { "X-Idempotency-Key": "toss-group-missing-order-id" });
  assert.equal(rejected.error.code, "MISSING_FIELD");
});

// --- Real (non-mock) TossPayments confirm path -----------------------------
//
// The mock-mode tests above exercise buyPrimaryGroup()'s own logic, but the
// bug this file guards against was live-verified against a *configured*
// TossPayments account: the widget/server total for a 2-seat order was
// silently wrong. These tests run the app in-process (like
// tosspayments-configured-amount.test.mjs) with a mocked global fetch so we
// can prove the server-side amount check - not touched in this fix, per the
// task constraints on backend/tosspayments.js - still catches an
// under-charged group total instead of accepting it.

async function ticketgroundApp(t) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-toss-group-amount-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  return await createTicketgroundApp({
    dbPath: path.join(tempDir, "db.json"),
    mediaDir: { directory: path.join(tempDir, "uploads"), urlPrefix: "/manual-uploads" },
    runtime: {
      nowOverride: "2026-07-22T12:00:00+09:00",
      secret: "toss-group-amount-runtime-secret"
    },
    http: {
      adminDir: tempDir,
      fallbackPublic: "/index.html",
      jamsilOlympicSeatMapDir: tempDir,
      MIME: { ".json": "application/json; charset=utf-8" },
      projectDir: process.cwd(),
      publicDir: tempDir,
      seatMapDir: tempDir
    }
  });
}

function requestStream(method, url, body) {
  const request = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  request.method = method;
  request.url = url;
  request.headers = { host: "toss-group-amount.test" };
  request.socket = { remoteAddress: "127.0.0.1" };
  return request;
}

async function requestApp(app, { body, expectedStatus = 200, headers = {}, method, url }) {
  const response = { status: 0, body: "", headers: {} };
  const res = {
    writeHead(status, responseHeaders = {}) {
      response.status = status;
      response.headers = responseHeaders;
    },
    end(chunk = "") {
      response.body += chunk.toString();
    }
  };
  const req = requestStream(method, url, body);
  for (const [key, value] of Object.entries(headers)) req.headers[key.toLowerCase()] = value;
  await app.handleRequest(req, res, app.db, "public");
  const json = JSON.parse(response.body);
  assert.equal(response.status, expectedStatus, `${url} status ${response.status}: ${response.body}`);
  return json;
}

async function verifyIdentityInProcess(app, userId, phone) {
  const started = await requestApp(app, { method: "POST", url: "/api/identity/nice/start", body: { userId } });
  await requestApp(app, {
    method: "POST",
    url: "/api/identity/nice/mock-complete",
    body: { userId, phone, identityVerificationId: started.data.identityVerificationId }
  });
}

async function onSaleTicketsInProcess(app, count = 2) {
  const state = await requestApp(app, { method: "GET", url: "/api/state" });
  const byDate = new Map();
  for (const ticket of state.data.tickets) {
    if (ticket.eventId !== "event_kpop_001" || ticket.status !== "ON_SALE") continue;
    const bucket = byDate.get(ticket.performanceDateId) || [];
    bucket.push(ticket);
    byDate.set(ticket.performanceDateId, bucket);
  }
  for (const tickets of byDate.values()) {
    if (tickets.length >= count) return tickets.slice(0, count);
  }
  throw new Error("no performance date has enough ON_SALE tickets for this test");
}

function withConfiguredTossEnv(t) {
  const previous = {
    client: process.env.TIG_TOSSPAYMENTS_CLIENT_KEY,
    secret: process.env.TIG_TOSSPAYMENTS_SECRET_KEY,
    identityTestMode: process.env.TIG_NICE_IDENTITY_TEST_MODE
  };
  process.env.TIG_TOSSPAYMENTS_CLIENT_KEY = "test_gck_toss_group_amount";
  process.env.TIG_TOSSPAYMENTS_SECRET_KEY = "test_gsk_toss_group_amount";
  process.env.TIG_NICE_IDENTITY_TEST_MODE = "1";
  t.after(() => {
    if (previous.client === undefined) delete process.env.TIG_TOSSPAYMENTS_CLIENT_KEY;
    else process.env.TIG_TOSSPAYMENTS_CLIENT_KEY = previous.client;
    if (previous.secret === undefined) delete process.env.TIG_TOSSPAYMENTS_SECRET_KEY;
    else process.env.TIG_TOSSPAYMENTS_SECRET_KEY = previous.secret;
    if (previous.identityTestMode === undefined) delete process.env.TIG_NICE_IDENTITY_TEST_MODE;
    else process.env.TIG_NICE_IDENTITY_TEST_MODE = previous.identityTestMode;
  });
}

function withMockedTossConfirmFetch(t, { totalAmount, method = "카드" }) {
  const previousFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = previousFetch; });
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value === "https://api.tosspayments.com/v1/payments/confirm") {
      return Response.json({ status: "DONE", paymentKey: "toss_live_group_confirmed", approvedAt: "2026-07-22T12:00:00+09:00", totalAmount, method });
    }
    throw new Error(`unexpected TossPayments URL: ${value}`);
  };
}

test("configured tosspayments group purchase succeeds when the confirmed amount covers BOTH seats plus both service fees", async (t) => {
  withConfiguredTossEnv(t);
  const app = await ticketgroundApp(t);
  await verifyIdentityInProcess(app, "user_fan_a", "010-9000-0001");
  const [ticketA, ticketB] = await onSaleTicketsInProcess(app, 2);
  const correctTotal = ticketA.faceValue + ticketB.faceValue + 2 * 2000;
  withMockedTossConfirmFetch(t, { totalAmount: correctTotal });

  const purchase = await requestApp(app, {
    method: "POST",
    url: "/api/payments/tosspayments/purchase",
    headers: { "X-Idempotency-Key": "toss-group-configured-ok" },
    body: {
      userId: "user_fan_a",
      ticketIds: [ticketA.id, ticketB.id],
      paymentMethod: "CREDIT_CARD",
      tossPaymentKey: "toss_live_group_confirmed",
      orderId: `order_${ticketA.id}_${ticketB.id}`
    }
  });

  assert.equal(purchase.data.tickets.length, 2);
  assert.ok(purchase.data.tickets.every((ticket) => ticket.status === "OWNED"));
  assert.equal(purchase.data.payment.amount, correctTotal);
});

test("configured tosspayments group purchase is rejected when TossPayments only actually confirmed one seat's worth - this is the exact bug this fix closes", async (t) => {
  withConfiguredTossEnv(t);
  const app = await ticketgroundApp(t);
  await verifyIdentityInProcess(app, "user_fan_a", "010-9000-0001");
  const [ticketA, ticketB] = await onSaleTicketsInProcess(app, 2);

  // This is the live-verified symptom from the original report: the UI said
  // "2 seats", the customer expected both faceValues + both fees, but only
  // roughly one seat's worth was actually charged/confirmed by TossPayments.
  const undercharged = ticketA.faceValue + 2000;
  withMockedTossConfirmFetch(t, { totalAmount: undercharged });

  const rejected = await requestApp(app, {
    method: "POST",
    url: "/api/payments/tosspayments/purchase",
    expectedStatus: 409,
    headers: { "X-Idempotency-Key": "toss-group-configured-undercharged" },
    body: {
      userId: "user_fan_a",
      ticketIds: [ticketA.id, ticketB.id],
      paymentMethod: "CREDIT_CARD",
      tossPaymentKey: "toss_live_group_confirmed",
      orderId: `order_${ticketA.id}_${ticketB.id}`
    }
  });

  assert.equal(rejected.error.code, "TOSSPAYMENTS_AMOUNT_MISMATCH");
  const state = await requestApp(app, { method: "GET", url: "/api/state" });
  assert.equal(state.data.tickets.find((item) => item.id === ticketA.id).status, "ON_SALE", "no ticket was allocated for an undercharged group total");
  assert.equal(state.data.tickets.find((item) => item.id === ticketB.id).status, "ON_SALE");
});
