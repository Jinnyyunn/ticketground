import test from "node:test";
import assert from "node:assert/strict";
import { adminApi, api, appAttestation, buyFirstTicket, issueGateToken, startServer } from "./backend-test-utils.mjs";

async function issueAdmissionQr(server) {
  const { baseUrl } = server;
  const { ticket } = await buyFirstTicket(baseUrl);
  const device = await api(baseUrl, "/api/devices/trust", {
    userId: "user_fan_a",
    deviceId: "iphone-gate-test",
    biometricVerified: true,
    appAttestation: appAttestation("TRUST_DEVICE", "user_fan_a", "iphone-gate-test")
  });
  const qr = await api(baseUrl, "/api/tickets/qr", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    channel: "APP",
    deviceId: "iphone-gate-test",
    deviceToken: device.data.deviceToken,
    appAttestation: appAttestation("ISSUE_QR", "user_fan_a", "iphone-gate-test", ticket.id)
  });
  return { baseUrl, ticket, qr };
}

test("gate verification without a gate token is rejected before touching the ticket", async (t) => {
  const server = await startServer(t);
  const { baseUrl, qr } = await issueAdmissionQr(server);

  const rejected = await api(baseUrl, "/api/gate/verify", qr.data, 401);
  assert.equal(rejected.error.code, "GATE_AUTH_REQUIRED");

  const state = await api(baseUrl, "/api/state");
  const untouched = state.data.tickets.find((item) => item.id === qr.data.ticketId);
  assert.notEqual(untouched.status, "ADMITTED", "an unauthenticated gate request must not admit the ticket");
});

test("gate verification rejects an unknown or revoked gate token", async (t) => {
  const server = await startServer(t);
  const { baseUrl, qr } = await issueAdmissionQr(server);

  const unknown = await api(baseUrl, "/api/gate/verify", qr.data, 401, { "x-gate-token": "not-a-real-token" });
  assert.equal(unknown.error.code, "GATE_AUTH_INVALID");

  const issued = await adminApi(server, "/api/admin/gate-sessions", { gateLabel: "GATE-REVOKED" });
  await adminApi(server, `/api/admin/gate-sessions/${issued.data.gateId}/revoke`, {});
  const revoked = await api(baseUrl, "/api/gate/verify", qr.data, 401, { "x-gate-token": issued.data.token });
  assert.equal(revoked.error.code, "GATE_AUTH_INVALID");
});

test("a valid gate token admits the ticket once and records which gate consumed it", async (t) => {
  const server = await startServer(t);
  const { baseUrl, qr } = await issueAdmissionQr(server);
  const gateToken = await issueGateToken(server, "GATE-A");

  const accepted = await api(baseUrl, "/api/gate/verify", qr.data, 200, { "x-gate-token": gateToken });
  assert.equal(accepted.data.valid, true);

  const audit = await adminApi(server, "/api/admin/workspaces/audit?action=GATE_QR_ACCEPTED");
  const entry = audit.data.ledger.find((item) => item.payload?.ticketId === qr.data.ticketId);
  assert.ok(entry, "an acceptance ledger entry was written");
  assert.notEqual(entry.payload.gateId, "UNKNOWN", "the accepting gate's id is recorded, not a placeholder");
});

test("two gates racing the same QR: exactly one is admitted, the other is told who won", async (t) => {
  const server = await startServer(t);
  const { baseUrl, qr } = await issueAdmissionQr(server);
  const gateATokenPromise = issueGateToken(server, "GATE-A");
  const gateBTokenPromise = issueGateToken(server, "GATE-B");
  const [gateAToken, gateBToken] = await Promise.all([gateATokenPromise, gateBTokenPromise]);

  const [resultA, resultB] = await Promise.all([
    api(baseUrl, "/api/gate/verify", qr.data, 200, { "x-gate-token": gateAToken }),
    api(baseUrl, "/api/gate/verify", qr.data, 200, { "x-gate-token": gateBToken })
  ]);

  const validCount = [resultA, resultB].filter((item) => item.data.valid === true).length;
  assert.equal(validCount, 1, "exactly one of the two concurrent gate scans admits the ticket");

  const loser = resultA.data.valid ? resultB : resultA;
  assert.equal(loser.data.valid, false);
  assert.equal(loser.data.alreadyUsed, true, "the losing gate is told the ticket was already consumed, not that the QR was invalid");
  assert.ok(loser.data.usedByGateId, "the losing gate can see which gate won the race");
});

test("a gate token scoped to one event cannot admit a ticket from a different event", async (t) => {
  const server = await startServer(t);
  const { baseUrl, qr, ticket } = await issueAdmissionQr(server);

  const wrongEventToken = await adminApi(server, "/api/admin/gate-sessions", {
    gateLabel: "GATE-WRONG-EVENT",
    eventId: "event_c945b7fa842c" // a real, but different, seeded event (les-miserables)
  });
  assert.notEqual(ticket.eventId, "event_c945b7fa842c", "sanity check: the ticket really belongs to a different event");

  const rejected = await api(baseUrl, "/api/gate/verify", qr.data, 200, { "x-gate-token": wrongEventToken.data.token });
  assert.equal(rejected.data.valid, false);
  assert.equal(rejected.data.eventScopeMismatch, true);

  const state = await api(baseUrl, "/api/state");
  const untouched = state.data.tickets.find((item) => item.id === qr.data.ticketId);
  assert.notEqual(untouched.status, "ADMITTED", "a gate scoped to the wrong event must not admit the ticket");

  // The same QR is still valid for a token scoped to the correct event (or
  // an unscoped token) - the mismatch check only blocks the wrong event.
  const rightEventToken = await adminApi(server, "/api/admin/gate-sessions", {
    gateLabel: "GATE-RIGHT-EVENT",
    eventId: ticket.eventId
  });
  const accepted = await api(baseUrl, "/api/gate/verify", qr.data, 200, { "x-gate-token": rightEventToken.data.token });
  assert.equal(accepted.data.valid, true);
});

test("gate token issuance and revocation are admin-only", async (t) => {
  const server = await startServer(t);
  // Every /api/admin/* route 404s on the public surface regardless of the
  // specific handler - this is the same blanket guard every other admin
  // route in api-router.js relies on (adminOnly && surface !== "admin").
  const publicAttempt = await api(server.baseUrl, "/api/admin/gate-sessions", { gateLabel: "GATE-C" }, 404);
  assert.equal(publicAttempt.error.code, "NOT_FOUND");
});
