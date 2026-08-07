import test from "node:test";
import assert from "node:assert/strict";
import { GateApiError, parseGateQrPayload, verifyGateQr } from "../src/lib/gate-api.ts";

test("parseGateQrPayload accepts a well-formed admission QR payload", () => {
  const payload = parseGateQrPayload(JSON.stringify({
    ticketId: "ticket_abc",
    ownerId: "user_fan_a",
    expiresAt: "2026-09-19T10:00:20.000Z",
    nonce: "abcd1234",
    signature: "deadbeef"
  }));
  assert.deepEqual(payload, {
    ticketId: "ticket_abc",
    ownerId: "user_fan_a",
    expiresAt: "2026-09-19T10:00:20.000Z",
    nonce: "abcd1234",
    signature: "deadbeef"
  });
});

test("parseGateQrPayload rejects non-JSON QR content instead of crashing", () => {
  assert.throws(() => parseGateQrPayload("not json at all"), (error) => {
    assert.ok(error instanceof GateApiError);
    assert.equal(error.code, "MALFORMED_QR");
    return true;
  });
});

test("parseGateQrPayload rejects JSON missing required fields", () => {
  assert.throws(() => parseGateQrPayload(JSON.stringify({ ticketId: "ticket_abc" })), (error) => {
    assert.ok(error instanceof GateApiError);
    assert.equal(error.code, "MALFORMED_QR");
    return true;
  });
});

test("parseGateQrPayload rejects a QR encoding an unrelated JSON array or scalar", () => {
  assert.throws(() => parseGateQrPayload("42"), (error) => error instanceof GateApiError);
  assert.throws(() => parseGateQrPayload("[]"), (error) => error instanceof GateApiError);
});

test("verifyGateQr sends the gate token as x-gate-token and returns parsed data on success", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let capturedRequest;
  globalThis.fetch = async (url, init) => {
    capturedRequest = { url, init };
    return new Response(JSON.stringify({ ok: true, data: { valid: true } }), { status: 200 });
  };

  const result = await verifyGateQr("gate-token-123", {
    ticketId: "ticket_abc",
    ownerId: "user_fan_a",
    expiresAt: "2026-09-19T10:00:20.000Z",
    nonce: "abcd1234",
    signature: "deadbeef"
  });

  assert.equal(result.valid, true);
  assert.equal(capturedRequest.url, "/api/gate/verify");
  assert.equal(capturedRequest.init.headers["x-gate-token"], "gate-token-123");
  assert.equal(JSON.parse(capturedRequest.init.body).ticketId, "ticket_abc");
});

test("verifyGateQr surfaces the server's error code instead of a generic failure", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: false, error: { code: "GATE_AUTH_INVALID", message: "유효하지 않은 게이트 세션입니다." } }), { status: 401 });

  await assert.rejects(
    verifyGateQr("bad-token", { ticketId: "t", ownerId: "u", expiresAt: "e", nonce: "n", signature: "s" }),
    (error) => {
      assert.ok(error instanceof GateApiError);
      assert.equal(error.code, "GATE_AUTH_INVALID");
      assert.equal(error.status, 401);
      return true;
    }
  );
});

test("verifyGateQr wraps a network failure (offline) as a distinguishable NETWORK_ERROR", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };

  await assert.rejects(
    verifyGateQr("gate-token-123", { ticketId: "t", ownerId: "u", expiresAt: "e", nonce: "n", signature: "s" }),
    (error) => {
      assert.ok(error instanceof GateApiError);
      assert.equal(error.code, "NETWORK_ERROR");
      return true;
    }
  );
});
