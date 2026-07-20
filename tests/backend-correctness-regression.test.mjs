import test from "node:test";
import assert from "node:assert/strict";
import { createAdminBackend } from "../backend/admin.js";
import { createBootpayBackend } from "../backend/bootpay.js";
import { adminApi, api, buyFirstTicket, startServer } from "./backend-test-utils.mjs";

function httpError(status, code, message, detail = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.detail = detail;
  return error;
}

function adminBackend() {
  return createAdminBackend({
    adminTicket: (ticket) => ticket,
    appendLedger: () => {},
    clone: (value) => structuredClone(value),
    ensureTicketsForEvent: () => {},
    httpError,
    id: (prefix) => `${prefix}_test`,
    mediaDir: null,
    money: (value) => Math.round(Number(value)),
    now: () => "2026-07-20T00:00:00.000Z",
    seatLayoutForVenue: () => [],
    stableId: (prefix, ...parts) => `${prefix}_${parts.join("_")}`,
    verifyLedger: () => ({ ok: true })
  });
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

test("admin account update rejects weak replacement passwords without partial account mutation", () => {
  const { updateAdminAccount } = adminBackend();
  const account = {
    id: "admin_target",
    username: "target",
    passwordHash: "abc",
    passwordSalt: "def",
    roleKeys: ["support"],
    ipAllowlist: ["203.0.113.10"],
    active: true
  };
  const db = { adminAccounts: [account] };
  const actor = { id: "admin_actor", roleKeys: ["owner"] };

  assert.throws(
    () => updateAdminAccount(db, {
      adminId: "admin_target",
      roleKeys: ["finance"],
      ipAllowlist: ["198.51.100.10"],
      active: false,
      password: "short"
    }, actor),
    (error) => error.code === "WEAK_ADMIN_PASSWORD"
  );

  assert.deepEqual(account.roleKeys, ["support"]);
  assert.deepEqual(account.ipAllowlist, ["203.0.113.10"]);
  assert.equal(account.active, true);
});

test("event sale update rejects invalid replacement images without partial event mutation", async () => {
  const { updateEventSale } = adminBackend();
  const event = {
    id: "event_test",
    title: "Original title",
    category: "concert",
    venueId: "venue_1",
    venue: "Original venue",
    date: "2026-12-24T19:30:00+09:00",
    saleState: "ON_SALE",
    saleNote: "original note",
    discountRate: 0,
    image: "/images/original.jpg",
    zones: [{ id: "zone_vip", name: "VIP", faceValue: 154000, resaleFeeRate: 0.08, maxTransferCount: 1, seatCount: 1 }],
    dates: [{ id: "perf_1", startsAt: "2026-12-24T19:30:00+09:00", label: "1회차" }],
    schedules: [{ label: "1회차", date: "2026-12-24", times: ["19:30"] }]
  };
  const db = {
    events: [event],
    venues: [{ id: "venue_1", name: "Original venue", map: { type: "test" } }],
    tickets: []
  };

  await assert.rejects(
    () => updateEventSale(db, {
      eventId: "event_test",
      title: "Mutated title",
      category: "musical",
      startsAt: "2026-12-25T20:00:00+09:00",
      venueId: "venue_1",
      saleState: "CLOSED",
      saleNote: "mutated note",
      discountRate: 25,
      imageDataUrl: "data:image/png;base64,not-valid"
    }),
    (error) => error.code === "INVALID_EVENT_IMAGE"
  );

  assert.equal(event.title, "Original title");
  assert.equal(event.category, "concert");
  assert.equal(event.date, "2026-12-24T19:30:00+09:00");
  assert.equal(event.saleState, "ON_SALE");
  assert.equal(event.saleNote, "original note");
  assert.equal(event.discountRate, 0);
  assert.equal(event.image, "/images/original.jpg");
});
