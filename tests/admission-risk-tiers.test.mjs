import test from "node:test";
import assert from "node:assert/strict";
import { createAdmissionBackend } from "../backend/admission.js";

function httpError(status, code, message, detail = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.detail = detail;
  return error;
}

// riskScoreFor/riskGate are pure functions of user.status/trustScore - none
// of createAdmissionBackend's other dependencies are touched by them, so
// trivial stubs are enough to exercise them directly without a full app.
const { riskGate, riskScoreFor } = createAdmissionBackend({
  appendLedger: () => {},
  currentTimeMs: () => Date.parse("2026-08-01T00:00:00.000Z"),
  eventDate: () => ({}),
  findUser: () => ({}),
  hash: (value) => `hash-${value}`,
  hmac: (value) => `hmac-${value}`,
  httpError,
  id: (prefix) => `${prefix}_test`,
  now: () => "2026-08-01T00:00:00.000Z",
  offsetIso: (iso) => iso,
  randomHex: () => "test",
  stableId: (prefix) => `${prefix}_test`
});

test("riskScoreFor: a clean, high-trust account scores near zero", () => {
  const score = riskScoreFor({ status: "ACTIVE", trustScore: 92 });
  assert.ok(score < 30, `expected ALLOW-band score, got ${score}`);
  assert.equal(riskGate(score).action, "ALLOW");
});

test("riskScoreFor: moderate trust erosion lands in the OTP band", () => {
  const score = riskScoreFor({ status: "ACTIVE", trustScore: 56 });
  assert.equal(score, 44);
  assert.equal(riskGate(score).action, "OTP_REQUIRED");
});

test("riskScoreFor: severe (but not yet flagged) trust erosion lands in the delay band", () => {
  const score = riskScoreFor({ status: "ACTIVE", trustScore: 25 });
  assert.equal(score, 75);
  const gate = riskGate(score);
  assert.equal(gate.action, "DELAY_OR_SUPPORT_CHECK");
  assert.equal(gate.delaySeconds, 30);
});

test("riskScoreFor: a WATCHLIST account is always held regardless of trustScore", () => {
  // Even a WATCHLIST account with a comparatively high trustScore (e.g. one
  // that was flagged for a reason other than repeated trustScore penalties)
  // must not slip through as OTP-only.
  const score = riskScoreFor({ status: "WATCHLIST", trustScore: 45 });
  assert.equal(riskGate(score).action, "HOLD");
  assert.equal(riskGate(score).requiresAdminReview, true);
});

test("riskGate: boundaries are inclusive/exclusive as documented", () => {
  assert.equal(riskGate(29).action, "ALLOW");
  assert.equal(riskGate(30).action, "OTP_REQUIRED");
  assert.equal(riskGate(59).action, "OTP_REQUIRED");
  assert.equal(riskGate(60).action, "DELAY_OR_SUPPORT_CHECK");
  assert.equal(riskGate(79).action, "DELAY_OR_SUPPORT_CHECK");
  assert.equal(riskGate(80).action, "HOLD");
  assert.equal(riskGate(100).action, "HOLD");
});
