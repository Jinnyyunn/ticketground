import test from "node:test";
import assert from "node:assert/strict";
import { adminApi, api, appAttestation, buyFirstTicket, issueGateToken, startServer, verifyIdentity } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

test("backend issues virtual ticket, app-only admission QR, and one-use gate verification", async (t) => {
  const server = await startServer(t);
  const { baseUrl } = server;
  const { ticket, purchase } = await buyFirstTicket(baseUrl);

  assert.equal(purchase.admission.activationChannel, "APP_ONLY");
  assert.equal(purchase.admissionCredential, undefined);
  assert.equal(purchase.user, undefined);
  assert.equal(purchase.ticket.ownerId, undefined);
  assert.equal(purchase.ticket.admissionCredentialId, undefined);

  const virtualQr = await api(baseUrl, "/api/tickets/virtual-qr", {
    userId: "user_fan_a",
    ticketId: ticket.id
  });
  assert.equal(virtualQr.data.type, "VIRTUAL_TICKET");
  assert.equal(virtualQr.data.admissionChannel, "APP_ONLY");
  assert.equal(virtualQr.data.ownerId, undefined);
  assert.equal(virtualQr.data.signature, undefined);

  const device = await api(baseUrl, "/api/devices/trust", {
    userId: "user_fan_a",
    deviceId: "iphone-15-pro",
    deviceName: "민서 iPhone",
    platform: "iOS",
    biometricVerified: true,
    appAttestation: appAttestation("TRUST_DEVICE", "user_fan_a", "iphone-15-pro")
  });
  assert.equal(device.data.device.status, "TRUSTED");
  assert.ok(device.data.deviceToken);

  const admissionQr = await api(baseUrl, "/api/tickets/qr", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    channel: "APP",
    deviceId: "iphone-15-pro",
    deviceToken: device.data.deviceToken,
    appAttestation: appAttestation("ISSUE_QR", "user_fan_a", "iphone-15-pro", ticket.id)
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
  const publicUser = stateAfterQr.data.users.find((item) => item.id === "user_fan_a");
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

  const userTickets = await api(baseUrl, "/api/users/user_fan_a/tickets");
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
  const server = await startServer(t);
  const { baseUrl } = server;
  const { ticket } = await buyFirstTicket(baseUrl);
  const device = await api(baseUrl, "/api/devices/trust", {
    userId: "user_fan_a",
    deviceId: "iphone-15-pro",
    biometricVerified: true,
    appAttestation: appAttestation("TRUST_DEVICE", "user_fan_a", "iphone-15-pro")
  });
  const issueParams = {
    userId: "user_fan_a",
    ticketId: ticket.id,
    channel: "APP",
    deviceId: "iphone-15-pro",
    deviceToken: device.data.deviceToken,
    appAttestation: appAttestation("ISSUE_QR", "user_fan_a", "iphone-15-pro", ticket.id)
  };

  const staleQr = await api(baseUrl, "/api/tickets/qr", issueParams);
  const freshQr = await api(baseUrl, "/api/tickets/qr", issueParams);
  assert.notEqual(staleQr.data.nonce, freshQr.data.nonce, "re-issuing produces a new nonce/signature pair");

  const gateToken = await issueGateToken(server, "GATE-A");
  const staleAttempt = await api(baseUrl, "/api/gate/verify", staleQr.data, 200, { "x-gate-token": gateToken });
  assert.equal(staleAttempt.data.valid, false, "the superseded QR is rejected even though its own signature verifies");

  const freshAttempt = await api(baseUrl, "/api/gate/verify", freshQr.data, 200, { "x-gate-token": gateToken });
  assert.equal(freshAttempt.data.valid, true, "the currently active QR is still accepted");
});

test("backend rejects web admission QR, early QR activation, and forged app attestations", async (t) => {
  const early = await startServer(t, { now: "2026-09-19T15:00:00+09:00" });
  const { ticket } = await buyFirstTicket(early.baseUrl);
  const device = await api(early.baseUrl, "/api/devices/trust", {
    userId: "user_fan_a",
    deviceId: "iphone-early",
    biometricVerified: true,
    appAttestation: appAttestation("TRUST_DEVICE", "user_fan_a", "iphone-early")
  });

  const forgedDevice = await api(early.baseUrl, "/api/devices/trust", {
    userId: "user_fan_a",
    deviceId: "forged-iphone",
    biometricVerified: true
  }, 403);
  assert.equal(forgedDevice.error.code, "APP_ATTESTATION_REQUIRED");

  const webQr = await api(early.baseUrl, "/api/tickets/qr", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    channel: "WEB"
  }, 403);
  assert.equal(webQr.error.code, "APP_CHANNEL_REQUIRED");

  const earlyQr = await api(early.baseUrl, "/api/tickets/qr", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    channel: "APP",
    deviceId: "iphone-early",
    deviceToken: device.data.deviceToken,
    appAttestation: appAttestation("ISSUE_QR", "user_fan_a", "iphone-early", ticket.id)
  }, 409);
  assert.equal(earlyQr.error.code, "REAL_QR_NOT_READY");

  const forgedQr = await api(early.baseUrl, "/api/tickets/qr", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    channel: "APP",
    deviceId: "iphone-early",
    deviceToken: device.data.deviceToken,
    appAttestation: appAttestation("ISSUE_QR", "user_fan_b", "iphone-early", ticket.id)
  }, 403);
  assert.equal(forgedQr.error.code, "APP_ATTESTATION_REQUIRED");

  const emergencyBypass = await api(early.baseUrl, "/api/tickets/qr", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    channel: "WEB",
    emergencyOverride: true,
    emergencyReason: "public-body-bypass"
  }, 403);
  assert.equal(emergencyBypass.error.code, "APP_CHANNEL_REQUIRED");

  const ledger = await adminApi(early, "/api/ledger/verify");
  assert.equal(ledger.data.ok, true);
});

test("official resale clears an old owner admin admission hold before new owner QR issuance", async (t) => {
  // Given: an owner credential is under an admin hold.
  const server = await startServer(t);
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
  await verifyIdentity(server.baseUrl, "user_fan_b", "010-9000-0002");
  await api(server.baseUrl, "/api/resale/purchase", {
    buyerId: "user_fan_b",
    poolId: pool.data.id,
    paymentMethod: "CREDIT_CARD"
  });
  const device = await api(server.baseUrl, "/api/devices/trust", {
    userId: "user_fan_b",
    deviceId: "buyer-iphone",
    biometricVerified: true,
    appAttestation: appAttestation("TRUST_DEVICE", "user_fan_b", "buyer-iphone")
  });

  // Then: the new legitimate owner can issue a real admission QR instead of inheriting ADMIN_HOLD_ACTIVE.
  const admissionQr = await api(server.baseUrl, "/api/tickets/qr", {
    userId: "user_fan_b",
    ticketId: ticket.id,
    channel: "APP",
    deviceId: "buyer-iphone",
    deviceToken: device.data.deviceToken,
    appAttestation: appAttestation("ISSUE_QR", "user_fan_b", "buyer-iphone", ticket.id)
  });
  assert.equal(admissionQr.data.type, "ADMISSION");
  const admissionAfter = await adminApi(server, "/api/admin/workspaces/admission");
  const reassignedCredential = admissionAfter.data.admissionCredentials.find((item) => item.ticketId === ticket.id);
  assert.equal(reassignedCredential.userId, "user_fan_b");
  assert.equal(reassignedCredential.adminHold, false);
  assert.equal(reassignedCredential.adminHoldReason, null);
});

test("a logged-in session cannot issue an admission QR for someone else's ticket by naming them as userId", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t);
  const { baseUrl } = server;
  const { ticket } = await buyFirstTicket(baseUrl);

  // An unrelated, logged-in attacker registers their own device, then claims
  // to be the real owner (user_fan_a) by putting that id in the request body.
  const login = await api(baseUrl, "/api/auth/google", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  const credential = login.data.credential;
  const authHeaders = { Authorization: `Bearer ${credential}` };

  const device = await api(baseUrl, "/api/devices/trust", {
    userId: "user_fan_a",
    deviceId: "attacker-iphone",
    biometricVerified: true,
    appAttestation: appAttestation("TRUST_DEVICE", "google_user_test", "attacker-iphone")
  }, 200, authHeaders);
  // The trusted device is registered under the session's real user
  // (google_user_test), not the impersonated user_fan_a from the body.
  assert.equal(device.data.device.userId, "google_user_test");

  const attempt = await api(baseUrl, "/api/tickets/qr", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    channel: "APP",
    deviceId: "attacker-iphone",
    deviceToken: device.data.deviceToken,
    appAttestation: appAttestation("ISSUE_QR", "google_user_test", "attacker-iphone", ticket.id)
  }, 403, authHeaders);
  // The server resolves the actor from the session (google_user_test, who
  // does not own the ticket), not from the claimed body.userId.
  assert.equal(attempt.error.code, "NOT_OWNER");

  const state = await api(baseUrl, "/api/state");
  const untouched = state.data.tickets.find((item) => item.id === ticket.id);
  assert.equal(untouched.currentQr, undefined, "no admission QR was issued for the real owner's ticket");
});
