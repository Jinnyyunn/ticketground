import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  adminApi,
  api,
  buyFirstTicket,
  buyFirstNativeTicket,
  issueGateToken,
  issueIosAdmissionQr,
  issueIosAppAttestProof,
  nativeGoogleLogin,
  startAttestedServer,
  startServer,
  trustIosDevice,
  verifyNativeIdentity
} from "./backend-test-utils.mjs";

test("backend issues virtual ticket, app-only admission QR, and one-use gate verification", async (t) => {
  const server = await startAttestedServer(t);
  const { baseUrl } = server;
  const login = await nativeGoogleLogin(baseUrl);
  const { ticket, purchase } = await buyFirstNativeTicket(baseUrl, login);

  assert.equal(purchase.admission.activationChannel, "APP_ONLY");
  assert.equal(purchase.admissionCredential, undefined);
  assert.equal(purchase.user, undefined);
  assert.equal(purchase.ticket.ownerId, undefined);
  assert.equal(purchase.ticket.admissionCredentialId, undefined);

  const virtualQr = await api(baseUrl, "/api/tickets/virtual-qr", {
    userId: login.user.id,
    ticketId: ticket.id
  }, 200, { Authorization: login.authorization });
  assert.equal(virtualQr.data.type, "VIRTUAL_TICKET");
  assert.equal(virtualQr.data.admissionChannel, "APP_ONLY");
  assert.equal(virtualQr.data.ownerId, undefined);
  assert.equal(virtualQr.data.signature, undefined);

  const device = await trustIosDevice(baseUrl, login, {
    deviceId: "iphone-15-pro",
    deviceName: "민서 iPhone"
  });
  assert.equal(device.data.device.status, "TRUSTED");
  assert.ok(device.data.deviceToken);

  const admissionQr = await issueIosAdmissionQr(baseUrl, login, {
    ticketId: ticket.id,
    deviceId: "iphone-15-pro",
    deviceToken: device.data.deviceToken
  });
  assert.equal(admissionQr.data.type, "ADMISSION");
  assert.equal(admissionQr.data.ttlSeconds, 20);
  assert.ok(Date.parse(admissionQr.data.expiresAt) - Date.parse(admissionQr.data.issuedAt) <= 20_000);

  const gateToken = await issueGateToken(server, "GATE-A");
  const gateAccepted = await api(baseUrl, "/api/gate/verify", admissionQr.data, 200, { "x-gate-token": gateToken });
  assert.equal(gateAccepted.data.valid, true);
  assert.equal(gateAccepted.data.credential, undefined);

  const replay = await api(baseUrl, "/api/gate/verify", admissionQr.data, 200, { "x-gate-token": gateToken });
  assert.equal(replay.data.valid, false);

  const stateAfterQr = await api(baseUrl, "/api/state");
  const publicTicket = stateAfterQr.data.tickets.find((item) => item.id === ticket.id);
  assert.equal(publicTicket.ownerId, undefined);
  assert.equal(publicTicket.admissionCredentialId, undefined);
  assert.equal(publicTicket.currentQr, undefined);
  assert.equal(publicTicket.signature, undefined);
  assert.equal(publicTicket.nonce, undefined);
  const publicUser = stateAfterQr.data.users.find((item) => item.id === login.user.id);
  assert.equal(publicUser.balance, undefined);
  assert.equal(publicUser.status, undefined);
  assert.equal(publicUser.trustScore, undefined);
  assert.equal(publicUser.sanctions, undefined);
  assert.equal(stateAfterQr.data.admissionCredentials, undefined);
  assert.equal(stateAfterQr.data.watchlist, undefined);
  assert.equal(stateAfterQr.data.notificationJobs, undefined);
  assert.equal(stateAfterQr.data.supportThreads, undefined);
  assert.equal(stateAfterQr.data.backendSummary.admissionCredentials, undefined);
  assert.equal(stateAfterQr.data.ledger.latestHash, undefined);

  const userTickets = await api(baseUrl, `/api/users/${login.user.id}/tickets`, undefined, 200, {
    Authorization: login.authorization
  });
  assert.equal(userTickets.data.length, 1);
  assert.equal(userTickets.data[0].id, ticket.id);
  assert.equal(userTickets.data[0].faceValue, ticket.faceValue);
  assert.equal(userTickets.data[0].ownerId, undefined);
});

test("gate verification rejects a superseded QR even though its signature is still cryptographically valid", async (t) => {
  // A rotated (re-issued) QR's old signature is still a correct HMAC for its
  // own (ticketId, ownerId, expiresAt, nonce) tuple, so it must be rejected
  // for freshness (not matching the ticket's current QR), not for a bad
  // signature - this exercises the exact comparison the gate check performs.
  const server = await startAttestedServer(t);
  const { baseUrl } = server;
  const login = await nativeGoogleLogin(baseUrl);
  const { ticket } = await buyFirstNativeTicket(baseUrl, login);
  const device = await trustIosDevice(baseUrl, login, {
    deviceId: "iphone-15-pro",
    deviceName: "iPhone 15 Pro"
  });
  const issueParams = {
    ticketId: ticket.id,
    deviceId: "iphone-15-pro",
    deviceToken: device.data.deviceToken
  };

  const staleQr = await issueIosAdmissionQr(baseUrl, login, issueParams);
  const freshQr = await issueIosAdmissionQr(baseUrl, login, issueParams);
  assert.notEqual(staleQr.data.nonce, freshQr.data.nonce, "re-issuing produces a new nonce/signature pair");

  const gateToken = await issueGateToken(server, "GATE-A");
  const staleAttempt = await api(baseUrl, "/api/gate/verify", staleQr.data, 200, { "x-gate-token": gateToken });
  assert.equal(staleAttempt.data.valid, false, "the superseded QR is rejected even though its own signature verifies");

  const freshAttempt = await api(baseUrl, "/api/gate/verify", freshQr.data, 200, { "x-gate-token": gateToken });
  assert.equal(freshAttempt.data.valid, true, "the currently active QR is still accepted");
});

test("gate verification rejects a QR strictly by the server's own clock once its signed 20s TTL has elapsed", async (t) => {
  // expiresAt travels inside the signed payload (hmac(ticketId:ownerId:expiresAt:nonce)),
  // so a captured QR can't be kept "alive" by resubmitting it with a
  // different expiresAt - that would just break the signature. The only way
  // to test that the TTL is actually enforced server-side (not merely
  // displayed client-side) is to leave the captured payload completely
  // untouched and move the *server's* clock past the expiresAt it already
  // signed, then confirm verification fails for expiry - not because the
  // credential was consumed (alreadyUsed) or superseded by a later issuance.
  const dataDir = await mkdtemp(path.join(tmpdir(), "ticketground-qr-ttl-"));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const dbPath = path.join(dataDir, "db.json");

  const server = await startAttestedServer(t, { dbPath, now: "2026-09-19T17:00:00+09:00" });
  const login = await nativeGoogleLogin(server.baseUrl);
  const { ticket } = await buyFirstNativeTicket(server.baseUrl, login);
  const device = await trustIosDevice(server.baseUrl, login, {
    deviceId: "iphone-ttl",
    deviceName: "TTL iPhone"
  });
  const admissionQr = await issueIosAdmissionQr(server.baseUrl, login, {
    ticketId: ticket.id,
    deviceId: "iphone-ttl",
    deviceToken: device.data.deviceToken
  });
  assert.equal(admissionQr.data.expiresAt, "2026-09-19T08:00:20.000Z");
  const gateToken = await issueGateToken(server, "GATE-TTL");

  // A later server process reads the same persisted db.json - the captured
  // QR fields are forwarded byte-for-byte, only the server's clock moved.
  const laterServer = await startServer(t, { dbPath, now: "2026-09-19T17:00:21+09:00" });
  const expiredAttempt = await api(laterServer.baseUrl, "/api/gate/verify", admissionQr.data, 200, { "x-gate-token": gateToken });
  assert.equal(expiredAttempt.data.valid, false, "a QR past its own signed expiresAt must be rejected");
  assert.equal(expiredAttempt.data.alreadyUsed, false, "rejection must be attributed to expiry, not a prior consumption");
  assert.equal(expiredAttempt.data.eventScopeMismatch, false);
});

test("backend rejects web admission QR, early QR activation, and forged app attestations", async (t) => {
  const early = await startAttestedServer(t, { now: "2026-09-19T15:00:00+09:00" });
  const login = await nativeGoogleLogin(early.baseUrl);
  const { ticket } = await buyFirstNativeTicket(early.baseUrl, login);
  const device = await trustIosDevice(early.baseUrl, login, {
    deviceId: "iphone-early",
    deviceName: "Early iPhone"
  });

  const forgedDevice = await api(early.baseUrl, "/api/devices/trust", {
    userId: login.user.id,
    deviceId: "forged-iphone",
    biometricVerified: true
  }, 403, { Authorization: login.authorization });
  assert.equal(forgedDevice.error.code, "APP_ATTEST_CHALLENGE_INVALID");

  const webQr = await api(early.baseUrl, "/api/tickets/qr", {
    userId: login.user.id,
    ticketId: ticket.id,
    channel: "WEB"
  }, 403, { Authorization: login.authorization });
  assert.equal(webQr.error.code, "APP_CHANNEL_REQUIRED");

  const earlyQr = await issueIosAdmissionQr(early.baseUrl, login, {
    ticketId: ticket.id,
    deviceId: "iphone-early",
    deviceToken: device.data.deviceToken,
    expectedStatus: 409
  });
  assert.equal(earlyQr.error.code, "REAL_QR_NOT_READY");

  const forgedProof = await issueIosAppAttestProof(early.baseUrl, login.authorization, {
    purpose: "ISSUE_QR",
    deviceId: "different-iphone",
    ticketId: ticket.id,
    kind: "assertion"
  });
  const forgedQr = await api(early.baseUrl, "/api/tickets/qr", {
    userId: login.user.id,
    ticketId: ticket.id,
    channel: "APP",
    deviceId: "iphone-early",
    deviceToken: device.data.deviceToken,
    ...forgedProof
  }, 403, { Authorization: login.authorization });
  assert.equal(forgedQr.error.code, "APP_ATTEST_CHALLENGE_INVALID");

  const emergencyBypass = await api(early.baseUrl, "/api/tickets/qr", {
    userId: login.user.id,
    ticketId: ticket.id,
    channel: "WEB",
    emergencyOverride: true,
    emergencyReason: "public-body-bypass"
  }, 403, { Authorization: login.authorization });
  assert.equal(emergencyBypass.error.code, "APP_CHANNEL_REQUIRED");

  const ledger = await adminApi(early, "/api/ledger/verify");
  assert.equal(ledger.data.ok, true);
});

test("official resale clears an old owner admin admission hold before new owner QR issuance", async (t) => {
  // Given: an owner credential is under an admin hold.
  const server = await startAttestedServer(t);
  const { ticket } = await buyFirstTicket(server.baseUrl);
  const admissionBefore = await adminApi(server, "/api/admin/workspaces/admission");
  const credential = admissionBefore.data.admissionCredentials.find((item) => item.ticketId === ticket.id);
  assert.ok(credential);
  const held = await adminApi(server, "/api/admin/admission/hold", {
    credentialId: credential.id,
    hold: true,
    reason: "previous owner investigation"
  });
  assert.equal(held.data.adminHold, true);

  // When: the ticket is reassigned through official resale to a different verified buyer.
  const pool = await api(server.baseUrl, "/api/resale/list", {
    sellerId: "user_fan_a",
    ticketId: ticket.id,
    price: ticket.faceValue
  });
  const buyer = await nativeGoogleLogin(server.baseUrl);
  await verifyNativeIdentity(server.baseUrl, buyer, "010-9000-0002");
  await api(server.baseUrl, "/api/resale/purchase", {
    buyerId: "ignored-body-user",
    poolId: pool.data.id,
    paymentMethod: "CREDIT_CARD"
  }, 200, { Authorization: buyer.authorization });
  const device = await trustIosDevice(server.baseUrl, buyer, {
    deviceId: "buyer-iphone",
    deviceName: "Buyer iPhone"
  });

  // Then: the new legitimate owner can issue a real admission QR instead of inheriting ADMIN_HOLD_ACTIVE.
  const admissionQr = await issueIosAdmissionQr(server.baseUrl, buyer, {
    ticketId: ticket.id,
    deviceId: "buyer-iphone",
    deviceToken: device.data.deviceToken
  });
  assert.equal(admissionQr.data.type, "ADMISSION");
  const admissionAfter = await adminApi(server, "/api/admin/workspaces/admission");
  const reassignedCredential = admissionAfter.data.admissionCredentials.find((item) => item.ticketId === ticket.id);
  assert.equal(reassignedCredential.userId, buyer.user.id);
  assert.equal(reassignedCredential.adminHold, false);
  assert.equal(reassignedCredential.adminHoldReason, null);
});

test("a logged-in session cannot issue an admission QR for someone else's ticket by naming them as userId", async (t) => {
  const server = await startAttestedServer(t);
  const { baseUrl } = server;
  const { ticket } = await buyFirstTicket(baseUrl);

  // An unrelated, logged-in attacker registers their own device, then claims
  // to be the real owner (user_fan_a) by putting that id in the request body.
  const login = await nativeGoogleLogin(baseUrl);
  const authHeaders = { Authorization: login.authorization };

  const device = await trustIosDevice(baseUrl, login, {
    userId: "user_fan_a",
    deviceId: "attacker-iphone",
    deviceName: "Attacker iPhone"
  });
  // The trusted device is registered under the session's real user
  // (google_user_test), not the impersonated user_fan_a from the body.
  assert.equal(device.data.device.userId, "google_user_test");

  const proof = await issueIosAppAttestProof(baseUrl, login.authorization, {
    purpose: "ISSUE_QR",
    deviceId: "attacker-iphone",
    ticketId: ticket.id,
    kind: "assertion"
  });
  const attempt = await api(baseUrl, "/api/tickets/qr", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    channel: "APP",
    deviceId: "attacker-iphone",
    deviceToken: device.data.deviceToken,
    ...proof
  }, 403, authHeaders);
  // The server resolves the actor from the session (google_user_test, who
  // does not own the ticket), not from the claimed body.userId.
  assert.equal(attempt.error.code, "NOT_OWNER");

  const state = await api(baseUrl, "/api/state");
  const untouched = state.data.tickets.find((item) => item.id === ticket.id);
  assert.equal(untouched.currentQr, undefined, "no admission QR was issued for the real owner's ticket");
});
