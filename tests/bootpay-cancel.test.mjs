import assert from "node:assert/strict";
import test from "node:test";
import { createBootpayBackend } from "../backend/bootpay.js";

function backend() {
  return createBootpayBackend({
    hash: (value) => `hash:${value}`,
    httpError(status, code, message, detail) {
      return Object.assign(new Error(message), { code, status, detail });
    },
    now: () => "2026-09-19T17:00:00.000Z"
  });
}

test("cancelBootpayPayment is a no-op success in mock mode (no BootPay keys configured)", async (t) => {
  const previousAppId = process.env.TIG_BOOTPAY_APPLICATION_ID;
  const previousPrivateKey = process.env.TIG_BOOTPAY_PRIVATE_KEY;
  delete process.env.TIG_BOOTPAY_APPLICATION_ID;
  delete process.env.TIG_BOOTPAY_PRIVATE_KEY;
  t.after(() => {
    if (previousAppId === undefined) delete process.env.TIG_BOOTPAY_APPLICATION_ID;
    else process.env.TIG_BOOTPAY_APPLICATION_ID = previousAppId;
    if (previousPrivateKey === undefined) delete process.env.TIG_BOOTPAY_PRIVATE_KEY;
    else process.env.TIG_BOOTPAY_PRIVATE_KEY = previousPrivateKey;
  });

  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("must not call the real BootPay API in mock mode");
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await backend().cancelBootpayPayment({ receiptId: "bootpay_mock_abc123", price: 88000, reason: "test" });
  assert.deepEqual(result, { receiptId: "bootpay_mock_abc123", cancelled: true, mock: true });
  assert.equal(fetchCalled, false);
});

test("cancelBootpayPayment calls the documented BootPay REST contract when configured", async (t) => {
  const previousAppId = process.env.TIG_BOOTPAY_APPLICATION_ID;
  const previousPrivateKey = process.env.TIG_BOOTPAY_PRIVATE_KEY;
  process.env.TIG_BOOTPAY_APPLICATION_ID = "test-app-id";
  process.env.TIG_BOOTPAY_PRIVATE_KEY = "test-private-key";
  t.after(() => {
    if (previousAppId === undefined) delete process.env.TIG_BOOTPAY_APPLICATION_ID;
    else process.env.TIG_BOOTPAY_APPLICATION_ID = previousAppId;
    if (previousPrivateKey === undefined) delete process.env.TIG_BOOTPAY_PRIVATE_KEY;
    else process.env.TIG_BOOTPAY_PRIVATE_KEY = previousPrivateKey;
  });

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/request/token")) {
      return { ok: true, json: async () => ({ data: { token: "test-token" } }) };
    }
    if (String(url).endsWith("/cancel")) {
      return { ok: true, json: async () => ({ status: 1, data: { receipt_id: "bootpay_real_1" } }) };
    }
    throw new Error(`unexpected URL: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await backend().cancelBootpayPayment({ receiptId: "bootpay_real_1", price: 88000, reason: "좌석 배정 실패" });
  assert.deepEqual(result, { receiptId: "bootpay_real_1", cancelled: true, mock: false });

  const cancelCall = calls.find((call) => call.url.endsWith("/cancel"));
  assert.equal(cancelCall.url, "https://api.bootpay.co.kr/cancel");
  assert.equal(cancelCall.init.method, "POST");
  assert.equal(cancelCall.init.headers.Authorization, "test-token");
  assert.deepEqual(JSON.parse(cancelCall.init.body), {
    receipt_id: "bootpay_real_1",
    price: 88000,
    reason: "좌석 배정 실패"
  });
});

test("cancelBootpayPayment surfaces a clear error when the BootPay cancel call itself fails", async (t) => {
  const previousAppId = process.env.TIG_BOOTPAY_APPLICATION_ID;
  const previousPrivateKey = process.env.TIG_BOOTPAY_PRIVATE_KEY;
  process.env.TIG_BOOTPAY_APPLICATION_ID = "test-app-id";
  process.env.TIG_BOOTPAY_PRIVATE_KEY = "test-private-key";
  t.after(() => {
    if (previousAppId === undefined) delete process.env.TIG_BOOTPAY_APPLICATION_ID;
    else process.env.TIG_BOOTPAY_APPLICATION_ID = previousAppId;
    if (previousPrivateKey === undefined) delete process.env.TIG_BOOTPAY_PRIVATE_KEY;
    else process.env.TIG_BOOTPAY_PRIVATE_KEY = previousPrivateKey;
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/request/token")) {
      return { ok: true, json: async () => ({ data: { token: "test-token" } }) };
    }
    if (String(url).endsWith("/cancel")) {
      return { ok: false, json: async () => ({ status: 0, message: "already cancelled" }) };
    }
    throw new Error(`unexpected URL: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    backend().cancelBootpayPayment({ receiptId: "bootpay_real_2", price: 88000, reason: "test" }),
    (error) => {
      assert.equal(error.code, "BOOTPAY_CANCEL_FAILED");
      assert.equal(error.status, 502);
      return true;
    }
  );
});
