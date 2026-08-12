import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

async function request(server, pathName, {
  authorization,
  body,
  idempotencyKey,
  method = "GET",
  status = 200
} = {}) {
  const response = await fetch(`${server.baseUrl}${pathName}`, {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      ...(idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json();
  assert.equal(response.status, status, `${method} ${pathName}: ${JSON.stringify(json)}`);
  return json;
}

async function nativeLogin(server) {
  const login = await api(server.baseUrl, "/api/auth/google/native", {
    credential: GOOGLE_AUTH_TEST_CREDENTIAL
  });
  return {
    authorization: `Bearer ${login.data.session.credential}`,
    user: login.data.user
  };
}

async function buyOwnedTickets(server, login, count) {
  await request(server, "/api/identity/portone-danal/start", {
    authorization: login.authorization,
    method: "POST",
    body: { userId: "spoofed-user", phone: "010-9000-0011" }
  }).then((started) => request(server, "/api/identity/portone-danal/confirm", {
    authorization: login.authorization,
    method: "POST",
    body: {
      userId: "spoofed-user",
      phone: "010-9000-0011",
      identityVerificationId: started.data.identityVerificationId
    }
  }));
  const state = await api(server.baseUrl, "/api/state");
  const tickets = state.data.tickets.filter((ticket) => ticket.status === "ON_SALE").slice(0, count);
  assert.equal(tickets.length, count);
  for (const ticket of tickets) {
    await request(server, "/api/tickets/buy", {
      authorization: login.authorization,
      method: "POST",
      body: { userId: "spoofed-user", ticketId: ticket.id, paymentMethod: "CREDIT_CARD" }
    });
  }
  return tickets;
}

async function prepareTwoPrincipals(t, ticketCount = 2) {
  configureGoogleEnv(t, true);
  const dataDir = await mkdtemp(path.join(tmpdir(), "ticketground-native-lifecycle-"));
  const dbPath = path.join(dataDir, "db.json");
  t.after(() => rm(dataDir, { recursive: true, force: true }));

  const bootstrap = await startServer(t, { dbPath });
  const seller = await nativeLogin(bootstrap);
  const tickets = await buyOwnedTickets(bootstrap, seller, ticketCount);
  await bootstrap.stop();

  const buyerCredential = "native-lifecycle-buyer-credential";
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  db.nativeSessions.push({
    id: "native_session_lifecycle_buyer",
    userId: "user_fan_b",
    credentialHash: crypto.createHash("sha256").update(buyerCredential).digest("hex"),
    issuedAt: "2026-09-19T08:00:00.000Z",
    expiresAt: "2026-10-19T08:00:00.000Z",
    revokedAt: null
  });
  await writeFile(dbPath, JSON.stringify(db, null, 2));

  const server = await startServer(t, { dbPath });
  return {
    buyer: { authorization: `Bearer ${buyerCredential}`, user: { id: "user_fan_b" } },
    dbPath,
    seller,
    server,
    tickets
  };
}

test("health advertises the native lifecycle contract required by native clients", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);

  const health = await request(server, "/api/health");

  assert.equal(health.data.status, "UP");
  assert.equal(health.data.capabilities.includes("native-lifecycle-v1"), true);
});

test("native resale pools bind seller and buyer to bearer while replaying mutations without identity leakage", async (t) => {
  const { buyer, seller, server, tickets } = await prepareTwoPrincipals(t, 2);
  const listingBody = { ticketId: tickets[0].id, price: tickets[0].faceValue, showSlug: "native-show" };

  const missingKey = await request(server, "/api/me/resale-pools", {
    authorization: seller.authorization,
    method: "POST",
    body: listingBody,
    status: 400
  });
  assert.equal(missingKey.error.code, "IDEMPOTENCY_KEY_REQUIRED");

  const first = await request(server, "/api/me/resale-pools", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "native-resale-list",
    body: listingBody
  });
  const replay = await request(server, "/api/me/resale-pools", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "native-resale-list",
    body: listingBody
  });
  assert.deepEqual(replay.data, first.data);

  const conflict = await request(server, "/api/me/resale-pools", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "native-resale-list",
    body: { ...listingBody, price: listingBody.price - 1 },
    status: 409
  });
  assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  const second = await request(server, "/api/me/resale-pools", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "native-resale-list-2",
    body: { ticketId: tickets[1].id, price: tickets[1].faceValue }
  });
  const joined = await request(server, `/api/me/resale-pools/${first.data.id}/join`, {
    authorization: buyer.authorization,
    method: "POST",
    idempotencyKey: "native-resale-join",
    body: {}
  });
  const joinReplay = await request(server, `/api/me/resale-pools/${first.data.id}/join`, {
    authorization: buyer.authorization,
    method: "POST",
    idempotencyKey: "native-resale-join",
    body: {}
  });
  assert.deepEqual(joinReplay.data, joined.data);

  const joinConflict = await request(server, `/api/me/resale-pools/${second.data.id}/join`, {
    authorization: buyer.authorization,
    method: "POST",
    idempotencyKey: "native-resale-join",
    body: {},
    status: 409
  });
  assert.equal(joinConflict.error.code, "IDEMPOTENCY_CONFLICT");

  const sellerPools = await request(server, "/api/me/resale-pools", { authorization: seller.authorization });
  const buyerPools = await request(server, "/api/me/resale-pools", { authorization: buyer.authorization });
  assert.deepEqual(sellerPools.data.map((pool) => pool.id).sort(), [first.data.id, second.data.id].sort());
  assert.deepEqual(buyerPools.data.map((pool) => pool.id), [first.data.id]);
  for (const payload of [first.data, joined.data, ...sellerPools.data, ...buyerPools.data]) {
    assert.equal(payload.sellerId, undefined);
    assert.equal(payload.buyers, undefined);
    assert.equal(payload.buyerId, undefined);
    assert.equal(JSON.stringify(payload).includes(seller.user.id), false);
    assert.equal(JSON.stringify(payload).includes(buyer.user.id), false);
  }

  const forbidden = await request(server, `/api/me/resale-pools/${first.data.id}`, {
    authorization: buyer.authorization,
    method: "DELETE",
    status: 403
  });
  assert.equal(forbidden.error.code, "NOT_OWNER");
  const canceled = await request(server, `/api/me/resale-pools/${first.data.id}`, {
    authorization: seller.authorization,
    method: "DELETE",
    idempotencyKey: "native-resale-cancel"
  });
  assert.equal(canceled.data.status, "CANCELED");
  const cancelReplay = await request(server, `/api/me/resale-pools/${first.data.id}`, {
    authorization: seller.authorization,
    method: "DELETE",
    idempotencyKey: "native-resale-cancel"
  });
  assert.deepEqual(cancelReplay.data, canceled.data);
  const cancelConflict = await request(server, `/api/me/resale-pools/${second.data.id}`, {
    authorization: seller.authorization,
    method: "DELETE",
    idempotencyKey: "native-resale-cancel",
    status: 409
  });
  assert.equal(cancelConflict.error.code, "IDEMPOTENCY_CONFLICT");
});

test("native cancellation requests require an owned ticket, persist idempotently, and never refund automatically", async (t) => {
  const { buyer, dbPath, seller, server, tickets } = await prepareTwoPrincipals(t, 2);
  const body = { ticketId: tickets[0].id, reason: "일정 변경", refundAcknowledged: true };

  const foreign = await request(server, "/api/me/cancellation-requests", {
    authorization: buyer.authorization,
    method: "POST",
    idempotencyKey: "foreign-cancel",
    body,
    status: 403
  });
  assert.equal(foreign.error.code, "NOT_OWNER");

  await request(server, "/api/me/resale-pools", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "cancel-state-list",
    body: { ticketId: tickets[1].id, price: tickets[1].faceValue }
  });
  const invalidState = await request(server, "/api/me/cancellation-requests", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "invalid-state-cancel",
    body: { ...body, ticketId: tickets[1].id },
    status: 409
  });
  assert.equal(invalidState.error.code, "INVALID_TICKET_STATE");

  const first = await request(server, "/api/me/cancellation-requests", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "native-cancel",
    body
  });
  const replay = await request(server, "/api/me/cancellation-requests", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "native-cancel",
    body
  });
  assert.equal(first.data.status, "PENDING_REVIEW");
  assert.deepEqual(replay.data, first.data);

  const differentKeyRetry = await request(server, "/api/me/cancellation-requests", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "native-cancel-different-key",
    body
  });
  assert.deepEqual(differentKeyRetry.data, first.data);

  const conflict = await request(server, "/api/me/cancellation-requests", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "native-cancel",
    body: { ...body, reason: "다른 사유" },
    status: 409
  });
  assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");
  await server.stop();

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.equal(persisted.cancellationRequests.length, 1);
  assert.equal(persisted.paymentTransactions.filter((payment) => payment.ticketId === tickets[0].id).every((payment) => payment.status === "PAID"), true);
  assert.equal(persisted.ledger.some((entry) => entry.action.includes("REFUND")), false);

  const restarted = await startServer(t, { dbPath });
  const restartReplay = await request(restarted, "/api/me/cancellation-requests", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "native-cancel",
    body
  });
  const requests = await request(restarted, "/api/me/cancellation-requests", { authorization: seller.authorization });
  const buyerRequests = await request(restarted, "/api/me/cancellation-requests", { authorization: buyer.authorization });
  assert.deepEqual(restartReplay.data, first.data);
  assert.deepEqual(requests.data, [first.data]);
  assert.deepEqual(buyerRequests.data, []);
});

test("native device inventory redacts secrets and only allows the bearer to revoke a device", async (t) => {
  const { buyer, dbPath, seller, server } = await prepareTwoPrincipals(t, 0);
  const deviceId = "seller-iphone";
  await server.stop();
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  db.trustedDevices.push({
    id: "device_seller_inventory",
    userId: seller.user.id,
    deviceId,
    tokenHash: "must-not-be-exposed",
    deviceName: "Seller iPhone",
    platform: "ios",
    status: "TRUSTED",
    createdAt: "2026-09-19T08:00:00.000Z",
    lastVerifiedAt: "2026-09-19T08:00:00.000Z"
  });
  await writeFile(dbPath, JSON.stringify(db, null, 2));
  const restarted = await startServer(t, { dbPath });

  const devices = await request(restarted, "/api/me/devices", { authorization: seller.authorization });
  assert.equal(devices.data.length, 1);
  assert.equal(devices.data[0].deviceId, deviceId);
  assert.equal(devices.data[0].tokenHash, undefined);
  assert.equal(devices.data[0].deviceToken, undefined);

  const hidden = await request(restarted, "/api/me/devices", { authorization: buyer.authorization });
  assert.deepEqual(hidden.data, []);
  const foreign = await request(restarted, `/api/me/devices/${devices.data[0].id}`, {
    authorization: buyer.authorization,
    method: "DELETE",
    status: 404
  });
  assert.equal(foreign.error.code, "DEVICE_NOT_FOUND");

  const revoked = await request(restarted, `/api/me/devices/${devices.data[0].id}`, {
    authorization: seller.authorization,
    method: "DELETE"
  });
  assert.equal(revoked.data.status, "REVOKED");
  await restarted.stop();
  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  const audit = persisted.ledger.findLast((entry) => entry.action === "TRUSTED_DEVICE_REVOKED");
  assert.equal(audit.actorId, seller.user.id);
  assert.equal(audit.payload.deviceId, devices.data[0].id);
});

test("native push tokens store only a digest and safe suffix with durable idempotent upsert", async (t) => {
  const { dbPath, seller, server } = await prepareTwoPrincipals(t, 0);
  const rawToken = "apns-secret-device-token-1234567890";
  const body = { platform: "ios", token: rawToken };

  const invalid = await request(server, "/api/me/push-tokens", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "push-invalid",
    body: { platform: "web", token: rawToken },
    status: 422
  });
  assert.equal(invalid.error.code, "UNSUPPORTED_PUSH_PLATFORM");

  const first = await request(server, "/api/me/push-tokens", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "push-upsert",
    body
  });
  const replay = await request(server, "/api/me/push-tokens", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "push-upsert",
    body
  });
  assert.deepEqual(replay.data, first.data);
  assert.equal(first.data.suffix, "7890");
  assert.equal(first.data.token, undefined);
  assert.equal(first.data.tokenDigest, undefined);

  const conflict = await request(server, "/api/me/push-tokens", {
    authorization: seller.authorization,
    method: "POST",
    idempotencyKey: "push-upsert",
    body: { platform: "android", token: rawToken },
    status: 409
  });
  assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  const tokens = await request(server, "/api/me/push-tokens", { authorization: seller.authorization });
  assert.deepEqual(tokens.data, [first.data]);
  await server.stop();
  const rawDb = await readFile(dbPath, "utf8");
  assert.equal(rawDb.includes(rawToken), false);
  const persisted = JSON.parse(rawDb);
  assert.equal(persisted.pushTokens[0].tokenDigest, crypto.createHash("sha256").update(`push-token:${rawToken}`).digest("hex"));

  const restarted = await startServer(t, { dbPath });
  const afterRestart = await request(restarted, "/api/me/push-tokens", { authorization: seller.authorization });
  assert.deepEqual(afterRestart.data, [first.data]);
});

test("Android integrity routes discriminate platform and never persist the proof token", async (t) => {
  const { dbPath, seller, server } = await prepareTwoPrincipals(t, 0);
  const unsupportedPlatform = await request(server, "/api/me/device-attestation/challenges", {
    authorization: seller.authorization,
    method: "POST",
    body: { platform: "windows", purpose: "TRUST_DEVICE", deviceId: "pixel-a" },
    status: 422
  });
  assert.equal(unsupportedPlatform.error.code, "INVALID_ATTESTATION_PLATFORM");

  const challenge = await request(server, "/api/me/device-attestation/challenges", {
    authorization: seller.authorization,
    method: "POST",
    body: { platform: "android", purpose: "TRUST_DEVICE", deviceId: "pixel-a" }
  });
  assert.equal(challenge.data.platform, "android");
  const rejected = await request(server, "/api/devices/trust", {
    authorization: seller.authorization,
    method: "POST",
    body: {
      platform: "android",
      deviceId: "pixel-a",
      deviceName: "Pixel",
      biometricVerified: true,
      challengeId: challenge.data.id,
      integrityToken: "raw-play-integrity-token"
    },
    status: 503
  });
  assert.equal(rejected.error.code, "PLAY_INTEGRITY_VERIFIER_UNAVAILABLE");
  await server.stop();
  assert.equal((await readFile(dbPath, "utf8")).includes("raw-play-integrity-token"), false);
});
