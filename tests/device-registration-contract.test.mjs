import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

const simulatorSecret = "ticketground-simulator-attestation-test-secret";

async function credential(baseUrl) {
  const login = await api(baseUrl, "/api/auth/google/native", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  return login.data.session.credential;
}

async function request(baseUrl, pathname, { body, credential: token, expectedStatus = 200, key, method = "POST" } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(payload));
  return payload;
}

function proof(nonce, deviceId, counter) {
  return crypto.createHmac("sha256", simulatorSecret).update(`${nonce}:${deviceId}:${counter}`).digest("hex");
}

test("simulator trust challenge is single-use and push registration rotates without exposing tokens", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t, { env: { TIG_SIMULATOR_ATTESTATION_SECRET: simulatorSecret } });
  const token = await credential(server.baseUrl);
  const deviceId = "simulator-c156";

  const challenge = await request(server.baseUrl, "/api/me/devices/challenges", {
    body: { deviceId }, credential: token, key: "challenge-1"
  });
  const trusted = await request(server.baseUrl, "/api/me/devices/trust", {
    body: { challengeId: challenge.data.id, deviceId, counter: 1, proof: proof(challenge.data.nonce, deviceId, 1) },
    credential: token,
    key: "trust-1"
  });
  assert.equal(trusted.data.status, "TRUSTED");
  assert.equal(Object.hasOwn(trusted.data, "nonce"), false);

  const replay = await request(server.baseUrl, "/api/me/devices/trust", {
    body: { challengeId: challenge.data.id, deviceId, counter: 1, proof: proof(challenge.data.nonce, deviceId, 1) },
    credential: token, key: "trust-replay", expectedStatus: 409
  });
  assert.equal(replay.error.code, "DEVICE_CHALLENGE_USED");

  const registered = await request(server.baseUrl, `/api/me/devices/${trusted.data.id}/push-token`, {
    body: { token: "raw-apns-token-one", environment: "simulator" }, credential: token, key: "push-1", method: "PUT"
  });
  assert.equal(registered.data.deliveryStatus, "REGISTERED");
  assert.equal(JSON.stringify(registered).includes("raw-apns-token-one"), false);
  const rotated = await request(server.baseUrl, `/api/me/devices/${trusted.data.id}/push-token`, {
    body: { token: "raw-apns-token-two", environment: "simulator" }, credential: token, key: "push-2", method: "PUT"
  });
  assert.equal(rotated.data.deliveryStatus, "REGISTERED");

  const payload = await request(server.baseUrl, `/api/me/devices/${trusted.data.id}/test-payload`, {
    body: {}, credential: token, key: "payload-1"
  });
  assert.deepEqual(payload.data, { aps: { alert: { body: "알림 수신 준비가 완료되었습니다.", title: "Ticketground" }, sound: "default" }, kind: "DEVICE_TEST" });
  assert.equal(JSON.stringify(payload).includes("raw-apns-token"), false);
});

test("notification preferences are separate from delivery and revocation disables delivery", async (t) => {
  configureGoogleEnv(t, true);
  const server = await startServer(t, { env: { TIG_SIMULATOR_ATTESTATION_SECRET: simulatorSecret } });
  const token = await credential(server.baseUrl);
  const deviceId = "simulator-settings";
  const challenge = await request(server.baseUrl, "/api/me/devices/challenges", { body: { deviceId }, credential: token, key: "settings-challenge" });
  const device = await request(server.baseUrl, "/api/me/devices/trust", {
    body: { challengeId: challenge.data.id, deviceId, counter: 1, proof: proof(challenge.data.nonce, deviceId, 1) }, credential: token, key: "settings-trust"
  });
  const settings = await request(server.baseUrl, "/api/me/notification-settings", {
    body: { watchlistOpen: false, reservationUpdates: true }, credential: token, key: "settings-1", method: "PUT"
  });
  assert.deepEqual(settings.data.preferences, { reservationUpdates: true, watchlistOpen: false });
  assert.equal(settings.data.delivery.available, false);

  await request(server.baseUrl, `/api/me/devices/${device.data.id}/push-token`, {
    body: { token: "sim-token", environment: "simulator" }, credential: token, key: "settings-push", method: "PUT"
  });
  const revoked = await request(server.baseUrl, `/api/me/devices/${device.data.id}`, {
    credential: token, key: "device-revoke", method: "DELETE"
  });
  assert.equal(revoked.data.status, "REVOKED");
  const after = await request(server.baseUrl, "/api/me/notification-settings", { credential: token, method: "GET" });
  assert.equal(after.data.delivery.available, false);
  const deniedPayload = await request(server.baseUrl, `/api/me/devices/${device.data.id}/test-payload`, {
    body: {}, credential: token, key: "payload-denied", expectedStatus: 409
  });
  assert.equal(deniedPayload.error.code, "PUSH_DELIVERY_UNAVAILABLE");
});
