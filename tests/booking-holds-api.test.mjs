import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { api, startServer, verifyIdentity } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";
import { configureSocialEnv, cookieHeaderFromSetCookie, PROVIDERS, redirected } from "./social-auth-test-helpers.mjs";

async function googleLogin(server) {
  const login = await api(server.baseUrl, "/api/auth/google/native", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  return { authorization: `Bearer ${login.data.session.credential}`, userId: login.data.user.id };
}

async function completeIosLogin(baseUrl, provider) {
  const startResponse = await fetch(`${baseUrl}/api/auth/${provider}/start?client=ios`, { redirect: "manual" });
  const authorizeUrl = new URL(await redirected(startResponse));
  const cookie = cookieHeaderFromSetCookie(startResponse.headers.get("set-cookie"));
  const state = authorizeUrl.searchParams.get("state");
  const callbackResponse = await fetch(
    `${baseUrl}/api/auth/${provider}/callback?code=${PROVIDERS[provider].code}&state=${encodeURIComponent(state)}`,
    { headers: { cookie }, redirect: "manual" }
  );
  const callbackUrl = new URL(await redirected(callbackResponse));
  return callbackUrl.searchParams.get("code");
}

async function kakaoLogin(server) {
  const code = await completeIosLogin(server.baseUrl, "kakao");
  const exchanged = await api(server.baseUrl, "/api/auth/native/handoff", { provider: "kakao", code });
  return { authorization: `Bearer ${exchanged.data.session.credential}`, userId: exchanged.data.user.id };
}

async function request(server, pathName, {
  authorization,
  body,
  idempotencyKey,
  method = "GET",
  status = 200
} = {}) {
  const hasBody = body !== undefined;
  const response = await fetch(`${server.baseUrl}${pathName}`, {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      ...(hasBody ? { "Content-Type": "application/json" } : {})
    },
    body: hasBody ? JSON.stringify(body) : undefined
  });
  const json = await response.json();
  assert.equal(response.status, status, `${method} ${pathName}: ${JSON.stringify(json)}`);
  return json;
}

async function onSaleTickets(server, count = 2) {
  const state = await api(server.baseUrl, "/api/state");
  const byDate = new Map();
  for (const ticket of state.data.tickets) {
    if (ticket.status !== "ON_SALE") continue;
    const bucket = byDate.get(ticket.performanceDateId) || [];
    bucket.push(ticket);
    byDate.set(ticket.performanceDateId, bucket);
  }
  for (const [performanceDateId, tickets] of byDate) {
    if (tickets.length >= count) return { performanceDateId, tickets: tickets.slice(0, count) };
  }
  throw new Error("no performance date has enough ON_SALE tickets for this test");
}

test("queue entry admits immediately under capacity and can be left", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const user = await googleLogin(server);
  const { performanceDateId } = await onSaleTickets(server, 1);

  const entered = await request(server, "/api/me/queue-entries", {
    authorization: user.authorization,
    method: "POST",
    body: { performanceDateId }
  });
  assert.equal(entered.data.status, "ADMITTED");
  assert.equal(entered.data.position, 0);

  const reentered = await request(server, "/api/me/queue-entries", {
    authorization: user.authorization,
    method: "POST",
    body: { performanceDateId }
  });
  assert.equal(reentered.data.id, entered.data.id, "re-entering while active returns the same entry");

  const left = await request(server, `/api/me/queue-entries/${entered.data.id}`, {
    authorization: user.authorization,
    method: "DELETE"
  });
  assert.equal(left.data.status, "LEFT");
});

test("seat hold create/extend/convert/cancel happy path", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const user = await googleLogin(server);
  const { performanceDateId, tickets } = await onSaleTickets(server, 2);
  const ticketIds = tickets.map((ticket) => ticket.id);

  const hold = await request(server, "/api/me/seat-holds", {
    authorization: user.authorization,
    method: "POST",
    idempotencyKey: "hold-1",
    body: { performanceDateId, ticketIds }
  });
  assert.equal(hold.data.status, "ACTIVE");
  assert.deepEqual(hold.data.ticketIds.sort(), ticketIds.sort());

  const afterHold = await api(server.baseUrl, "/api/state");
  for (const ticketId of ticketIds) {
    const ticket = afterHold.data.tickets.find((item) => item.id === ticketId);
    assert.equal(ticket.status, "HELD");
  }

  const extended = await request(server, `/api/me/seat-holds/${hold.data.id}/extend`, {
    authorization: user.authorization,
    method: "PATCH"
  });
  assert.equal(extended.data.extensionsUsed, 1);
  assert.ok(Date.parse(extended.data.expiresAt) >= Date.parse(hold.data.expiresAt), "extension must not shorten the hold's expiry");

  const overExtended = await request(server, `/api/me/seat-holds/${hold.data.id}/extend`, {
    authorization: user.authorization,
    method: "PATCH",
    status: 409
  });
  assert.equal(overExtended.error.code, "HOLD_EXTENSION_LIMIT");

  const draft = await request(server, "/api/me/reservation-drafts", {
    authorization: user.authorization,
    method: "POST",
    idempotencyKey: "draft-1",
    body: { holdId: hold.data.id }
  });
  assert.equal(draft.data.status, "PENDING_PAYMENT");
  assert.deepEqual(draft.data.ticketIds.sort(), ticketIds.sort());
  assert.equal(draft.data.amount.total, draft.data.amount.faceValueTotal + draft.data.amount.serviceFee);

  const holdAfterConvert = await request(server, `/api/me/seat-holds/${hold.data.id}`, {
    authorization: user.authorization
  });
  assert.equal(holdAfterConvert.data.status, "CONVERTED");

  const afterDraft = await api(server.baseUrl, "/api/state");
  for (const ticketId of ticketIds) {
    const ticket = afterDraft.data.tickets.find((item) => item.id === ticketId);
    assert.equal(ticket.status, "RESERVED");
  }

  const cancelled = await request(server, `/api/me/reservation-drafts/${draft.data.id}`, {
    authorization: user.authorization,
    method: "DELETE"
  });
  assert.equal(cancelled.data.status, "CANCELLED");

  const afterCancel = await api(server.baseUrl, "/api/state");
  for (const ticketId of ticketIds) {
    const ticket = afterCancel.data.tickets.find((item) => item.id === ticketId);
    assert.equal(ticket.status, "ON_SALE");
  }
});

test("a single-seat hold can be purchased only by its owner and is converted", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const user = await googleLogin(server);
  const { performanceDateId, tickets } = await onSaleTickets(server, 1);
  const ticketId = tickets[0].id;

  const hold = await request(server, "/api/me/seat-holds", {
    authorization: user.authorization,
    method: "POST",
    idempotencyKey: "ios-single-seat-hold",
    body: { performanceDateId, ticketIds: [ticketId] }
  });
  await verifyIdentity(server.baseUrl, user.userId, "010-9000-0088");

  const legacyPurchase = await request(server, "/api/tickets/buy", {
    authorization: user.authorization,
    method: "POST",
    status: 409,
    body: {
      userId: user.userId,
      ticketId,
      paymentMethod: "CREDIT_CARD",
      pgTransactionId: "attacker-supplied-value",
      allowOwnedSingleSeatHold: true
    }
  });
  assert.equal(legacyPurchase.error.code, "TICKET_NOT_AVAILABLE");

  const strangerPurchase = await request(server, "/api/payments/tosspayments/purchase", {
    method: "POST",
    status: 409,
    idempotencyKey: "stranger-held-seat-purchase",
    body: {
      userId: "user_fan_a",
      ticketId,
      paymentMethod: "CREDIT_CARD",
      tossPaymentKey: "stranger-held-seat-payment"
    }
  });
  assert.equal(strangerPurchase.error.code, "TICKET_NOT_AVAILABLE");

  const purchase = await request(server, "/api/payments/tosspayments/purchase", {
    authorization: user.authorization,
    method: "POST",
    idempotencyKey: "ios-held-seat-purchase",
    body: {
      userId: user.userId,
      ticketId,
      paymentMethod: "CREDIT_CARD",
      tossPaymentKey: "ios-held-seat-payment"
    }
  });
  assert.equal(purchase.data.ticket.status, "OWNED");

  const ownedTickets = await request(server, "/api/me/tickets", {
    authorization: user.authorization
  });
  assert.ok(ownedTickets.data.some((ticket) => ticket.id === ticketId));

  const convertedHold = await request(server, `/api/me/seat-holds/${hold.data.id}`, {
    authorization: user.authorization
  });
  assert.equal(convertedHold.data.status, "CONVERTED");

  const state = await api(server.baseUrl, "/api/state");
  const purchasedTicket = state.data.tickets.find((item) => item.id === ticketId);
  assert.equal(purchasedTicket.status, "OWNED");
  assert.equal(purchasedTicket.heldBy, undefined);
  assert.equal(purchasedTicket.holdExpiresAt, undefined);
});

test("seat hold requires an idempotency key and replays identical retries", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const user = await googleLogin(server);
  const { performanceDateId, tickets } = await onSaleTickets(server, 4);
  const ticketIds = [tickets[0].id];

  const missingKey = await request(server, "/api/me/seat-holds", {
    authorization: user.authorization,
    method: "POST",
    body: { performanceDateId, ticketIds },
    status: 400
  });
  assert.equal(missingKey.error.code, "IDEMPOTENCY_KEY_REQUIRED");

  const first = await request(server, "/api/me/seat-holds", {
    authorization: user.authorization,
    method: "POST",
    idempotencyKey: "retry-key",
    body: { performanceDateId, ticketIds }
  });
  const retried = await request(server, "/api/me/seat-holds", {
    authorization: user.authorization,
    method: "POST",
    idempotencyKey: "retry-key",
    body: { performanceDateId, ticketIds }
  });
  assert.equal(retried.data.id, first.data.id);

  const reorderedRetryKey = "retry-key-reordered";
  const reorderedSeats = [tickets[1].id, tickets[2].id];
  const reorderedFirst = await request(server, "/api/me/seat-holds", {
    authorization: user.authorization,
    method: "POST",
    idempotencyKey: reorderedRetryKey,
    body: { performanceDateId, ticketIds: reorderedSeats }
  });
  const reorderedRetried = await request(server, "/api/me/seat-holds", {
    authorization: user.authorization,
    method: "POST",
    idempotencyKey: reorderedRetryKey,
    body: { performanceDateId, ticketIds: [...reorderedSeats].reverse() }
  });
  assert.equal(
    reorderedRetried.data.id,
    reorderedFirst.data.id,
    "a semantically identical retry must not depend on ticketIds array order"
  );

  const conflicting = await request(server, "/api/me/seat-holds", {
    authorization: user.authorization,
    method: "POST",
    idempotencyKey: "retry-key",
    body: { performanceDateId, ticketIds: [tickets[3].id] },
    status: 409
  });
  assert.equal(conflicting.error.code, "IDEMPOTENCY_CONFLICT");
});

test("seat hold is all-or-nothing across two different users and rejects duplicates/oversized requests", async (t) => {
  configureGoogleEnv(t, true);
  configureSocialEnv(t, true);
  const server = await startServer(t);
  const userA = await googleLogin(server);
  const userB = await kakaoLogin(server);
  const { performanceDateId, tickets } = await onSaleTickets(server, 2);
  const [seatX, seatY] = tickets.map((ticket) => ticket.id);

  await request(server, "/api/me/seat-holds", {
    authorization: userA.authorization,
    method: "POST",
    idempotencyKey: "user-a-hold",
    body: { performanceDateId, ticketIds: [seatX] }
  });

  const conflict = await request(server, "/api/me/seat-holds", {
    authorization: userB.authorization,
    method: "POST",
    idempotencyKey: "user-b-hold",
    body: { performanceDateId, ticketIds: [seatX, seatY] },
    status: 409
  });
  assert.equal(conflict.error.code, "SEAT_ALREADY_HELD");

  const stateAfterConflict = await api(server.baseUrl, "/api/state");
  const seatYTicket = stateAfterConflict.data.tickets.find((item) => item.id === seatY);
  assert.equal(seatYTicket.status, "ON_SALE", "seatY must not be partially held after the all-or-nothing rejection");

  const duplicate = await request(server, "/api/me/seat-holds", {
    authorization: userB.authorization,
    method: "POST",
    idempotencyKey: "user-b-duplicate",
    body: { performanceDateId, ticketIds: [seatY, seatY] },
    status: 422
  });
  assert.equal(duplicate.error.code, "DUPLICATE_SEAT");

  const tooMany = await request(server, "/api/me/seat-holds", {
    authorization: userB.authorization,
    method: "POST",
    idempotencyKey: "user-b-toomany",
    body: { performanceDateId, ticketIds: ["t1", "t2", "t3", "t4", "t5"] },
    status: 422
  });
  assert.equal(tooMany.error.code, "TOO_MANY_SEATS");
});

test("only the owning user can inspect or mutate a seat hold or reservation draft", async (t) => {
  configureGoogleEnv(t, true);
  configureSocialEnv(t, true);
  const server = await startServer(t);
  const owner = await googleLogin(server);
  const stranger = await kakaoLogin(server);
  const { performanceDateId, tickets } = await onSaleTickets(server, 1);

  const hold = await request(server, "/api/me/seat-holds", {
    authorization: owner.authorization,
    method: "POST",
    idempotencyKey: "owner-hold",
    body: { performanceDateId, ticketIds: [tickets[0].id] }
  });

  const strangerGet = await request(server, `/api/me/seat-holds/${hold.data.id}`, {
    authorization: stranger.authorization,
    status: 403
  });
  assert.equal(strangerGet.error.code, "NOT_OWNER");

  const strangerExtend = await request(server, `/api/me/seat-holds/${hold.data.id}/extend`, {
    authorization: stranger.authorization,
    method: "PATCH",
    status: 403
  });
  assert.equal(strangerExtend.error.code, "NOT_OWNER");

  const strangerRelease = await request(server, `/api/me/seat-holds/${hold.data.id}`, {
    authorization: stranger.authorization,
    method: "DELETE",
    status: 403
  });
  assert.equal(strangerRelease.error.code, "NOT_OWNER");

  const strangerDraft = await request(server, "/api/me/reservation-drafts", {
    authorization: stranger.authorization,
    method: "POST",
    idempotencyKey: "stranger-draft",
    body: { holdId: hold.data.id },
    status: 403
  });
  assert.equal(strangerDraft.error.code, "NOT_OWNER");
});

test("expired holds and reservation drafts release seats back to ON_SALE", async (t) => {
  configureGoogleEnv(t, true);
  const tmpDataDir = await mkdtemp(path.join(tmpdir(), "ticketground-booking-holds-"));
  const dbPath = path.join(tmpDataDir, "db.json");
  t.after(() => rm(tmpDataDir, { recursive: true, force: true }));

  const server = await startServer(t, { dbPath, now: "2026-09-19T17:00:00+09:00" });
  const user = await googleLogin(server);
  const { performanceDateId, tickets } = await onSaleTickets(server, 1);

  const hold = await request(server, "/api/me/seat-holds", {
    authorization: user.authorization,
    method: "POST",
    idempotencyKey: "expiry-hold",
    body: { performanceDateId, ticketIds: [tickets[0].id] }
  });

  const laterServer = await startServer(t, { dbPath, now: "2026-09-19T17:10:00+09:00" });
  const relogin = await googleLogin(laterServer);
  const expiredHold = await request(laterServer, `/api/me/seat-holds/${hold.data.id}`, {
    authorization: relogin.authorization
  });
  assert.equal(expiredHold.data.status, "EXPIRED");

  const stateAfterExpiry = await api(laterServer.baseUrl, "/api/state");
  const ticket = stateAfterExpiry.data.tickets.find((item) => item.id === tickets[0].id);
  assert.equal(ticket.status, "ON_SALE");
});
