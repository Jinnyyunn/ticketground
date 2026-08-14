import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { api, startServer, verifyIdentity } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

const simulatorSecret = "ticketground-simulator-attestation-test-secret";
const gateKey = "ticketground-gate-test-key";

async function request(baseUrl, pathname, { body, credential, expectedStatus = 200, gate = false, key, method = "POST" } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
      ...(gate ? { "x-tig-gate-key": gateKey } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(payload));
  return payload;
}

async function gateResponse(baseUrl, token) {
  const response = await fetch(`${baseUrl}/api/gate/v1/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tig-gate-key": gateKey },
    body: JSON.stringify({ token })
  });
  return { status: response.status, payload: await response.json() };
}

function proof(nonce, deviceId, counter) {
  return crypto.createHmac("sha256", simulatorSecret).update(`${nonce}:${deviceId}:${counter}`).digest("hex");
}

async function buyForUser(baseUrl, userId) {
  await verifyIdentity(baseUrl, userId, "010-9000-0099");
  const state = await api(baseUrl, "/api/state");
  const ticket = state.data.tickets.find((item) => item.eventId === "event_kpop_001" && item.status === "ON_SALE");
  const purchase = await api(baseUrl, "/api/tickets/buy", { userId, ticketId: ticket.id, paymentMethod: "CREDIT_CARD" });
  return purchase.data.ticket;
}

test("native owner issues a short-lived QR and gate consumes it exactly once", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t, { env: { TIG_GATE_API_KEY: gateKey, TIG_SIMULATOR_ATTESTATION_SECRET: simulatorSecret } });
  const login = await api(server.baseUrl, "/api/auth/google/native", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  const credential = login.data.session.credential;
  const ticket = await buyForUser(server.baseUrl, login.data.user.id);
  const deviceId = "qr-simulator";
  const challenge = await request(server.baseUrl, "/api/me/devices/challenges", { body: { deviceId }, credential, key: "qr-challenge" });
  const trusted = await request(server.baseUrl, "/api/me/devices/trust", {
    body: { challengeId: challenge.data.id, deviceId, counter: 1, proof: proof(challenge.data.nonce, deviceId, 1) }, credential, key: "qr-trust"
  });

  const issued = await request(server.baseUrl, `/api/me/tickets/${ticket.id}/qr`, {
    body: { deviceId: trusted.data.id }, credential, key: "qr-issue"
  });
  assert.equal(issued.data.status, "VALID");
  assert.equal(issued.data.ttlSeconds, 20);
  assert.equal(JSON.stringify(issued).includes("ownerId"), false);

  const refreshed = await request(server.baseUrl, `/api/me/tickets/${ticket.id}/qr`, {
    body: { deviceId: trusted.data.id }, credential, key: "qr-refresh"
  });
  const revoked = await request(server.baseUrl, "/api/gate/v1/verify", { body: { token: issued.data.token }, gate: true, expectedStatus: 409 });
  assert.equal(revoked.error.code, "QR_REVOKED");

  const scans = await Promise.all([
    gateResponse(server.baseUrl, refreshed.data.token),
    gateResponse(server.baseUrl, refreshed.data.token)
  ]);
  assert.deepEqual(scans.map((scan) => scan.status).sort(), [200, 409]);
  assert.equal(scans.find((scan) => scan.status === 200).payload.data.status, "VALID");
  assert.equal(scans.find((scan) => scan.status === 409).payload.error.code, "QR_ALREADY_USED");

  const tickets = await request(server.baseUrl, "/api/me/tickets", { credential, method: "GET" });
  assert.equal(tickets.data.find((item) => item.id === ticket.id).status, "ADMITTED");
});

test("QR owner, trusted-device, expiry, revocation, and gate authorization boundaries reject safely", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t, { now: "2026-09-19T17:00:00+09:00", env: { TIG_GATE_API_KEY: gateKey, TIG_SIMULATOR_ATTESTATION_SECRET: simulatorSecret } });
  const login = await api(server.baseUrl, "/api/auth/google/native", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  const credential = login.data.session.credential;
  const ticket = await buyForUser(server.baseUrl, login.data.user.id);
  const untrusted = await request(server.baseUrl, `/api/me/tickets/${ticket.id}/qr`, {
    body: { deviceId: "missing" }, credential, key: "untrusted", expectedStatus: 403
  });
  assert.equal(untrusted.error.code, "TRUSTED_DEVICE_REQUIRED");
  const unauthorizedGate = await request(server.baseUrl, "/api/gate/v1/verify", {
    body: { token: "forged" }, expectedStatus: 401
  });
  assert.equal(unauthorizedGate.error.code, "GATE_UNAUTHORIZED");
});

test("QR persistence omits the raw token and expiry survives a server restart", async (t) => {
  configureGoogleEnv(t, true);
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-mobile-qr-"));
  const dbPath = path.join(tempDir, "db.json");
  let firstServer;
  let restartedServer;
  let expiredServer;
  try {
    firstServer = await startServer(t, {
      now: "2026-09-19T17:00:00+09:00",
      dbPath,
      env: { TIG_GATE_API_KEY: gateKey, TIG_SIMULATOR_ATTESTATION_SECRET: simulatorSecret }
    });
    const login = await api(firstServer.baseUrl, "/api/auth/google/native", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
    const credential = login.data.session.credential;
    const ticket = await buyForUser(firstServer.baseUrl, login.data.user.id);
    const deviceId = "qr-restart-simulator";
    const challenge = await request(firstServer.baseUrl, "/api/me/devices/challenges", {
      body: { deviceId }, credential, key: "qr-restart-challenge"
    });
    const trusted = await request(firstServer.baseUrl, "/api/me/devices/trust", {
      body: { challengeId: challenge.data.id, deviceId, counter: 1, proof: proof(challenge.data.nonce, deviceId, 1) },
      credential,
      key: "qr-restart-trust"
    });
    const issued = await request(firstServer.baseUrl, `/api/me/tickets/${ticket.id}/qr`, {
      body: { deviceId: trusted.data.id }, credential, key: "qr-restart-issue"
    });

    await firstServer.stop();
    const persisted = await readFile(dbPath, "utf8");
    assert.equal(persisted.includes(issued.data.token), false);

    restartedServer = await startServer(t, {
      now: "2026-09-19T17:00:10+09:00",
      dbPath,
      env: { TIG_GATE_API_KEY: gateKey, TIG_SIMULATOR_ATTESTATION_SECRET: simulatorSecret }
    });
    const replayed = await request(restartedServer.baseUrl, `/api/me/tickets/${ticket.id}/qr`, {
      body: { deviceId: trusted.data.id }, credential, key: "qr-restart-issue"
    });
    assert.equal(replayed.data.token, issued.data.token);
    await restartedServer.stop();

    expiredServer = await startServer(t, {
      now: "2026-09-19T17:01:00+09:00",
      dbPath,
      env: { TIG_GATE_API_KEY: gateKey, TIG_SIMULATOR_ATTESTATION_SECRET: simulatorSecret }
    });
    const expired = await request(expiredServer.baseUrl, "/api/gate/v1/verify", {
      body: { token: issued.data.token }, gate: true, expectedStatus: 409
    });
    assert.equal(expired.error.code, "QR_EXPIRED");
  } finally {
    await firstServer?.stop();
    await restartedServer?.stop();
    await expiredServer?.stop();
    await rm(tempDir, { recursive: true, force: true });
  }
});
