import test from "node:test";
import assert from "node:assert/strict";
import { createAppAttestBackend } from "../backend/app-attest.js";

function boundary({
  verifierURL = "https://verifier.example.test/verify",
  verifierToken = "secret",
  playIntegrityVerifierURL = "https://play-integrity.example.test/verify",
  playIntegrityVerifierToken = "play-secret"
} = {}) {
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
      verifierToken,
      playIntegrityVerifierURL,
      playIntegrityVerifierToken
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

test("Play Integrity challenge routes only its bound Android token to the configured verifier", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body), authorization: options.headers.Authorization });
    return new Response(JSON.stringify({
      verified: true,
      packageName: "kr.ticketground.app",
      challenge: Buffer.from("11".repeat(32), "hex").toString("base64"),
      purpose: "ISSUE_QR",
      deviceId: "pixel-a",
      ticketId: "ticket-a"
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const db = { appAttestChallenges: [] };
  const { backend } = boundary();
  const challenge = backend.issueChallenge(db, {
    userId: "user-a",
    platform: "android",
    purpose: "ISSUE_QR",
    deviceId: "pixel-a",
    ticketId: "ticket-a"
  });

  await assert.rejects(
    backend.verifyProof(db, {
      userId: "user-a",
      platform: "android",
      purpose: "ISSUE_QR",
      deviceId: "pixel-a",
      ticketId: "ticket-b",
      body: { challengeId: challenge.id, integrityToken: "raw-play-token" }
    }),
    (error) => error.code === "APP_ATTEST_CHALLENGE_INVALID"
  );
  await backend.verifyProof(db, {
    userId: "user-a",
    platform: "android",
    purpose: "ISSUE_QR",
    deviceId: "pixel-a",
    ticketId: "ticket-a",
    body: { challengeId: challenge.id, integrityToken: "raw-play-token" }
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://play-integrity.example.test/verify");
  assert.equal(calls[0].authorization, "Bearer play-secret");
  assert.deepEqual(calls[0].body, {
    packageName: "kr.ticketground.app",
    challenge: challenge.challenge,
    purpose: "ISSUE_QR",
    deviceId: "pixel-a",
    ticketId: "ticket-a",
    integrityToken: "raw-play-token"
  });
  assert.equal(JSON.stringify(db).includes("raw-play-token"), false);
  await assert.rejects(
    backend.verifyProof(db, {
      userId: "user-a",
      platform: "android",
      purpose: "ISSUE_QR",
      deviceId: "pixel-a",
      ticketId: "ticket-a",
      body: { challengeId: challenge.id, integrityToken: "raw-play-token" }
    }),
    (error) => error.code === "APP_ATTEST_CHALLENGE_INVALID"
  );
});

test("Play Integrity fails closed for missing configuration and mismatched verifier binding", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const db = { appAttestChallenges: [] };
  const unavailable = boundary({ playIntegrityVerifierURL: null, playIntegrityVerifierToken: null }).backend;
  const unavailableChallenge = unavailable.issueChallenge(db, {
    userId: "user-a", platform: "android", purpose: "TRUST_DEVICE", deviceId: "pixel-a"
  });
  await assert.rejects(
    unavailable.verifyProof(db, {
      userId: "user-a", platform: "android", purpose: "TRUST_DEVICE", deviceId: "pixel-a",
      body: { challengeId: unavailableChallenge.id, integrityToken: "raw-token" }
    }),
    (error) => error.code === "PLAY_INTEGRITY_VERIFIER_UNAVAILABLE"
  );

  globalThis.fetch = async () => new Response(JSON.stringify({
    verified: true,
    packageName: "wrong.package",
    challenge: unavailableChallenge.challenge,
    purpose: "TRUST_DEVICE",
    deviceId: "pixel-a",
    ticketId: null
  }), { status: 200, headers: { "Content-Type": "application/json" } });
  const mismatchedDb = { appAttestChallenges: [] };
  const configured = boundary().backend;
  const mismatchedChallenge = configured.issueChallenge(mismatchedDb, {
    userId: "user-a", platform: "android", purpose: "TRUST_DEVICE", deviceId: "pixel-a"
  });
  await assert.rejects(
    configured.verifyProof(mismatchedDb, {
      userId: "user-a", platform: "android", purpose: "TRUST_DEVICE", deviceId: "pixel-a",
      body: { challengeId: mismatchedChallenge.id, integrityToken: "raw-token" }
    }),
    (error) => error.code === "PLAY_INTEGRITY_REQUIRED"
  );
  assert.equal(mismatchedDb.appAttestChallenges[0].consumedAt, null);
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
