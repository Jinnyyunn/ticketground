import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { createTicketgroundApp } from "../backend/app.js";

const APP_ATTESTATION_SECRET = "risk-gate-app-secret";

function appAttestation(purpose, ...parts) {
  return crypto
    .createHmac("sha256", APP_ATTESTATION_SECRET)
    .update(["app", purpose, ...parts.map((part) => String(part || ""))].join(":"))
    .digest("hex");
}

// NODE_ENV=production (as used by `npm test`) blocks PortOne Danal's mock
// verification unless this is explicitly set - same production safeguard
// startServer()'s child process gets by default (see backend/identity.js's
// portOneMockAllowed()).
function withPortOneTestMode(t) {
  const previous = process.env.TIG_PORTONE_IDENTITY_TEST_MODE;
  process.env.TIG_PORTONE_IDENTITY_TEST_MODE = "1";
  t.after(() => {
    if (previous === undefined) delete process.env.TIG_PORTONE_IDENTITY_TEST_MODE;
    else process.env.TIG_PORTONE_IDENTITY_TEST_MODE = previous;
  });
}

// issueQr()'s risk gate can't be exercised end-to-end through startServer()
// (a spawned child process) with precise trustScore values, since the only
// admin-facing status mutation (WATCHLIST) always caps trustScore to <=39 -
// which this same risk formula floors at HOLD. Running the app in-process
// gives direct access to app.db.users to set exact trustScore values and
// land requests in the OTP/delay bands specifically.
async function ticketgroundApp(t) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-risk-gate-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  return await createTicketgroundApp({
    dbPath: path.join(tempDir, "db.json"),
    mediaDir: { directory: path.join(tempDir, "uploads"), urlPrefix: "/manual-uploads" },
    runtime: {
      appAttestationSecret: APP_ATTESTATION_SECRET,
      nowOverride: "2026-09-19T18:30:00+09:00",
      secret: "risk-gate-runtime-secret"
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
  request.headers = { host: "risk-gate.test" };
  request.socket = { remoteAddress: "127.0.0.1" };
  return request;
}

async function requestApp(app, { body, expectedStatus = 200, method, url }) {
  const response = { status: 0, body: "" };
  const res = {
    writeHead(status) { response.status = status; },
    end(chunk = "") { response.body += chunk.toString(); }
  };
  await app.handleRequest(requestStream(method, url, body), res, app.db, "public");
  const json = JSON.parse(response.body);
  assert.equal(response.status, expectedStatus, `${url} status ${response.status}: ${response.body}`);
  return json;
}

async function verifyIdentity(app, userId, phone) {
  const started = await requestApp(app, { method: "POST", url: "/api/identity/portone-danal/start", body: { userId, phone } });
  await requestApp(app, {
    method: "POST",
    url: "/api/identity/portone-danal/confirm",
    body: { userId, phone, identityVerificationId: started.data.identityVerificationId }
  });
}

async function buyFirstTicket(app, userId = "user_fan_a", eventId = "event_kpop_001") {
  const state = await requestApp(app, { method: "GET", url: "/api/state" });
  const ticket = state.data.tickets.find((item) => item.eventId === eventId && item.status === "ON_SALE");
  assert.ok(ticket, "seeded on-sale ticket exists");
  const purchase = await requestApp(app, {
    method: "POST",
    url: "/api/tickets/buy",
    body: { userId, ticketId: ticket.id, paymentMethod: "CREDIT_CARD" }
  });
  return purchase.data.ticket;
}

async function trustAndIssueQr(app, { userId, ticketId, deviceId, otpVerified, delayAcknowledged, expectedStatus }) {
  const device = await requestApp(app, {
    method: "POST",
    url: "/api/devices/trust",
    body: { userId, deviceId, biometricVerified: true, appAttestation: appAttestation("TRUST_DEVICE", userId, deviceId) }
  });
  return requestApp(app, {
    method: "POST",
    url: "/api/tickets/qr",
    expectedStatus,
    body: {
      userId,
      ticketId,
      channel: "APP",
      deviceId,
      deviceToken: device.data.deviceToken,
      appAttestation: appAttestation("ISSUE_QR", userId, deviceId, ticketId),
      otpVerified,
      delayAcknowledged
    }
  });
}

test("issueQr risk gate: OTP band blocks without otpVerified and passes with it", async (t) => {
  withPortOneTestMode(t);
  const app = await ticketgroundApp(t);
  await verifyIdentity(app, "user_fan_a", "010-9000-0001");
  const ticket = await buyFirstTicket(app, "user_fan_a");
  app.db.users.find((item) => item.id === "user_fan_a").trustScore = 56; // riskScoreFor => 44 (OTP_REQUIRED)

  const blocked = await trustAndIssueQr(app, { userId: "user_fan_a", ticketId: ticket.id, deviceId: "otp-band-device", expectedStatus: 403 });
  assert.equal(blocked.error.code, "OTP_REQUIRED");
  assert.equal(blocked.error.detail.riskScore, 44);

  const allowed = await trustAndIssueQr(app, { userId: "user_fan_a", ticketId: ticket.id, deviceId: "otp-band-device", otpVerified: true, expectedStatus: 200 });
  assert.equal(allowed.data.type, "ADMISSION");
});

test("issueQr risk gate: delay band blocks until delayAcknowledged, then passes", async (t) => {
  withPortOneTestMode(t);
  const app = await ticketgroundApp(t);
  await verifyIdentity(app, "user_fan_a", "010-9000-0001");
  const ticket = await buyFirstTicket(app, "user_fan_a");
  app.db.users.find((item) => item.id === "user_fan_a").trustScore = 25; // riskScoreFor => 75 (DELAY_OR_SUPPORT_CHECK)

  const blocked = await trustAndIssueQr(app, { userId: "user_fan_a", ticketId: ticket.id, deviceId: "delay-band-device", expectedStatus: 409 });
  assert.equal(blocked.error.code, "DELAY_REQUIRED");
  assert.equal(blocked.error.detail.delaySeconds, 30);

  const allowed = await trustAndIssueQr(app, { userId: "user_fan_a", ticketId: ticket.id, deviceId: "delay-band-device", delayAcknowledged: true, expectedStatus: 200 });
  assert.equal(allowed.data.type, "ADMISSION");
});

test("issueQr risk gate: HOLD band cannot be bypassed by otpVerified or delayAcknowledged", async (t) => {
  withPortOneTestMode(t);
  const app = await ticketgroundApp(t);
  await verifyIdentity(app, "user_fan_a", "010-9000-0001");
  const ticket = await buyFirstTicket(app, "user_fan_a");
  app.db.users.find((item) => item.id === "user_fan_a").trustScore = 5; // riskScoreFor => 95 (HOLD)

  const blocked = await trustAndIssueQr(app, {
    userId: "user_fan_a",
    ticketId: ticket.id,
    deviceId: "hold-band-device",
    otpVerified: true,
    delayAcknowledged: true,
    expectedStatus: 423
  });
  assert.equal(blocked.error.code, "RISK_HOLD_ACTIVE");
  assert.equal(blocked.error.detail.requiresAdminReview, true);
});
