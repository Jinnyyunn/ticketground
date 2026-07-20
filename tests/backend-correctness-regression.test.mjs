import test from "node:test";
import assert from "node:assert/strict";
import { createBootpayBackend } from "../backend/bootpay.js";
import { adminApi, api, buyFirstTicket, startServer } from "./backend-test-utils.mjs";

function httpError(status, code, message, detail = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.detail = detail;
  return error;
}

test("resale listing rejects non-finite prices before opening a pool", async (t) => {
  const server = await startServer(t);
  const { ticket } = await buyFirstTicket(server.baseUrl);

  const rejected = await api(server.baseUrl, "/api/resale/list", {
    sellerId: "user_fan_a",
    ticketId: ticket.id,
    price: "not-a-number"
  }, 422);

  assert.equal(rejected.error.code, "INVALID_RESALE_PRICE");
  const resale = await adminApi(server, "/api/admin/workspaces/resale");
  const inventory = await adminApi(server, `/api/admin/workspaces/inventory?eventId=${ticket.eventId}&limit=100`);
  assert.equal(resale.data.resalePools.length, 0);
  assert.equal(inventory.data.tickets.find((item) => item.id === ticket.id).status, "OWNED");
});

test("bulk user status update validates every row before mutating users", async (t) => {
  const server = await startServer(t);

  const rejected = await adminApi(server, "/api/admin/users/statuses", {
    updates: [
      { userId: "user_fan_a", status: "WATCHLIST" },
      { userId: "missing_user", status: "BANNED" }
    ],
    reason: "partial mutation regression"
  }, 404);

  assert.equal(rejected.error.code, "USER_NOT_FOUND");
  const accounts = await adminApi(server, "/api/admin/workspaces/accounts?search=user_fan_a");
  assert.equal(accounts.data.users[0].status, "ACTIVE");
  assert.deepEqual(accounts.data.users[0].sanctions, []);
});

test("BootPay real receipt verification rejects amount mismatches", async (t) => {
  const previousFetch = globalThis.fetch;
  const previousApplicationId = process.env.TIG_BOOTPAY_APPLICATION_ID;
  const previousPrivateKey = process.env.TIG_BOOTPAY_PRIVATE_KEY;
  process.env.TIG_BOOTPAY_APPLICATION_ID = "app-id";
  process.env.TIG_BOOTPAY_PRIVATE_KEY = "private-key";
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousApplicationId === undefined) delete process.env.TIG_BOOTPAY_APPLICATION_ID;
    else process.env.TIG_BOOTPAY_APPLICATION_ID = previousApplicationId;
    if (previousPrivateKey === undefined) delete process.env.TIG_BOOTPAY_PRIVATE_KEY;
    else process.env.TIG_BOOTPAY_PRIVATE_KEY = previousPrivateKey;
  });
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.endsWith("/request/token")) {
      return Response.json({ data: { token: "bootpay-access-token" } });
    }
    if (value.includes("/receipt/receipt_low_amount")) {
      return Response.json({ data: { status: 1, price: 1000, method: "card" } });
    }
    throw new Error(`unexpected BootPay URL: ${value}`);
  };
  const bootpay = createBootpayBackend({
    hash: (input) => `hash-${input}`,
    httpError,
    now: () => "2026-07-20T00:00:00.000Z"
  });

  await assert.rejects(
    () => bootpay.confirmBootpayPayment({}, {
      ticketId: "ticket_1",
      userId: "user_fan_a",
      paymentKey: "CREDIT_CARD",
      receiptId: "receipt_low_amount",
      expectedAmount: 154000
    }),
    (error) => error.code === "BOOTPAY_AMOUNT_MISMATCH"
  );
});

test("BootPay configured mode requires a receipt id instead of falling back to mock confirmation", async (t) => {
  const previousApplicationId = process.env.TIG_BOOTPAY_APPLICATION_ID;
  const previousPrivateKey = process.env.TIG_BOOTPAY_PRIVATE_KEY;
  process.env.TIG_BOOTPAY_APPLICATION_ID = "app-id";
  process.env.TIG_BOOTPAY_PRIVATE_KEY = "private-key";
  t.after(() => {
    if (previousApplicationId === undefined) delete process.env.TIG_BOOTPAY_APPLICATION_ID;
    else process.env.TIG_BOOTPAY_APPLICATION_ID = previousApplicationId;
    if (previousPrivateKey === undefined) delete process.env.TIG_BOOTPAY_PRIVATE_KEY;
    else process.env.TIG_BOOTPAY_PRIVATE_KEY = previousPrivateKey;
  });
  const bootpay = createBootpayBackend({
    hash: (input) => `hash-${input}`,
    httpError,
    now: () => "2026-07-20T00:00:00.000Z"
  });

  await assert.rejects(
    () => bootpay.confirmBootpayPayment({}, {
      ticketId: "ticket_1",
      userId: "user_fan_a",
      paymentKey: "CREDIT_CARD",
      expectedAmount: 154000
    }),
    (error) => error.code === "BOOTPAY_RECEIPT_REQUIRED"
  );
});
