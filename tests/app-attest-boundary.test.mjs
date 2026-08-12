import test from "node:test";
import assert from "node:assert/strict";
import { createAppAttestBackend } from "../backend/app-attest.js";

function boundary({ verifierURL = "https://verifier.example.test/verify", verifierToken = "secret" } = {}) {
  let serial = 0;
  let clock = Date.parse("2026-08-12T12:00:00Z");
  const httpError = (status, code, message) => Object.assign(new Error(message), { status, code });
  return {
    backend: createAppAttestBackend({
      currentTimeMs: () => clock,
      httpError,
      id: (prefix) => `${prefix}-${++serial}`,
      now: () => new Date(clock).toISOString(),
      randomHex: () => "11".repeat(32),
      verifierURL,
      verifierToken
    }),
    advance: (milliseconds) => { clock += milliseconds; }
  };
}

test("App Attest challenge is principal-bound, purpose-bound, expiring, and one-use", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body), authorization: options.headers.Authorization });
    return new Response(JSON.stringify({ verified: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const db = { appAttestChallenges: [] };
  const { backend, advance } = boundary();
  const challenge = backend.issueChallenge(db, { userId: "user-a", purpose: "TRUST_DEVICE", deviceId: "iphone-a" });
  await assert.rejects(
    backend.verifyProof(db, { userId: "user-b", purpose: "TRUST_DEVICE", deviceId: "iphone-a", body: { challengeId: challenge.id, keyId: "key", attestationObject: "proof" }, kind: "attestation" }),
    (error) => error.code === "APP_ATTEST_CHALLENGE_INVALID"
  );
  await backend.verifyProof(db, { userId: "user-a", purpose: "TRUST_DEVICE", deviceId: "iphone-a", body: { challengeId: challenge.id, keyId: "key", attestationObject: "proof" }, kind: "attestation" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.challenge, challenge.challenge);
  assert.equal(calls[0].authorization, "Bearer secret");
  await assert.rejects(
    backend.verifyProof(db, { userId: "user-a", purpose: "TRUST_DEVICE", deviceId: "iphone-a", body: { challengeId: challenge.id, keyId: "key", attestationObject: "proof" }, kind: "attestation" }),
    (error) => error.code === "APP_ATTEST_CHALLENGE_INVALID"
  );
  const expired = backend.issueChallenge(db, { userId: "user-a", purpose: "TRUST_DEVICE", deviceId: "iphone-a" });
  advance(2 * 60 * 1000 + 1);
  await assert.rejects(
    backend.verifyProof(db, { userId: "user-a", purpose: "TRUST_DEVICE", deviceId: "iphone-a", body: { challengeId: expired.id, keyId: "key", attestationObject: "proof" }, kind: "attestation" }),
    (error) => error.code === "APP_ATTEST_CHALLENGE_INVALID"
  );
});

test("App Attest boundary fails closed without an HTTPS configured verifier", async () => {
  const db = { appAttestChallenges: [] };
  const { backend } = boundary({ verifierURL: "http://verifier.invalid/", verifierToken: "secret" });
  const challenge = backend.issueChallenge(db, { userId: "user-a", purpose: "ISSUE_QR", deviceId: "iphone-a", ticketId: "ticket-a" });
  await assert.rejects(
    backend.verifyProof(db, { userId: "user-a", purpose: "ISSUE_QR", deviceId: "iphone-a", ticketId: "ticket-a", body: { challengeId: challenge.id, keyId: "key", assertion: "proof" }, kind: "assertion" }),
    (error) => error.code === "APP_ATTEST_VERIFIER_UNAVAILABLE"
  );
  assert.equal(db.appAttestChallenges[0].consumedAt, null);
});
