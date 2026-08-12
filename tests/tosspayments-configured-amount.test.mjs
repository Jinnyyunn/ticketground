import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { createTicketgroundApp } from "../backend/app.js";

// The TossPayments widget always charges faceValue + one seat's service fee
// (checkout-panel.tsx trustedTotalAmount / SERVICE_FEE_PER_SEAT). These tests
// run with a *configured* TossPayments account (real verifyTosspaymentsPayment
// path, not the mock fallback), which startServer()'s child-process HTTP
// tests can't exercise because they can't inject a mocked global fetch into
// the spawned process. Running the app in-process here lets us mock fetch
// and prove the server computes the same total the widget actually charged.
async function ticketgroundApp(t) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-toss-amount-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  return await createTicketgroundApp({
    dbPath: path.join(tempDir, "db.json"),
    mediaDir: { directory: path.join(tempDir, "uploads"), urlPrefix: "/manual-uploads" },
    runtime: {
      nowOverride: "2026-07-22T12:00:00+09:00",
      secret: "toss-amount-runtime-secret"
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
  request.headers = { host: "toss-amount.test" };
  request.socket = { remoteAddress: "127.0.0.1" };
  return request;
}

async function requestApp(app, { body, expectedStatus = 200, headers = {}, method, url }) {
  const response = { status: 0, body: "", headers: {} };
  const res = {
    writeHead(status, responseHeaders = {}) {
      response.status = status;
      response.headers = responseHeaders;
    },
    end(chunk = "") {
      response.body += chunk.toString();
    }
  };
  const req = requestStream(method, url, body);
  for (const [key, value] of Object.entries(headers)) req.headers[key.toLowerCase()] = value;
  await app.handleRequest(req, res, app.db, "public");
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

async function onSaleTicket(app) {
  const state = await requestApp(app, { method: "GET", url: "/api/state" });
  const ticket = state.data.tickets.find((item) => item.eventId === "event_kpop_001" && item.status === "ON_SALE");
  assert.ok(ticket, "seeded on-sale ticket exists");
  return ticket;
}

function withConfiguredTossEnv(t) {
  const previous = {
    client: process.env.TIG_TOSSPAYMENTS_CLIENT_KEY,
    secret: process.env.TIG_TOSSPAYMENTS_SECRET_KEY,
    // NODE_ENV=production (as used by `npm test`) blocks PortOne Danal's
    // mock verification unless this is explicitly set - same production
    // safeguard startServer()'s child process gets by default.
    identityTestMode: process.env.TIG_PORTONE_IDENTITY_TEST_MODE
  };
  process.env.TIG_TOSSPAYMENTS_CLIENT_KEY = "test_gck_toss_amount";
  process.env.TIG_TOSSPAYMENTS_SECRET_KEY = "test_gsk_toss_amount";
  process.env.TIG_PORTONE_IDENTITY_TEST_MODE = "1";
  t.after(() => {
    if (previous.client === undefined) delete process.env.TIG_TOSSPAYMENTS_CLIENT_KEY;
    else process.env.TIG_TOSSPAYMENTS_CLIENT_KEY = previous.client;
    if (previous.secret === undefined) delete process.env.TIG_TOSSPAYMENTS_SECRET_KEY;
    else process.env.TIG_TOSSPAYMENTS_SECRET_KEY = previous.secret;
    if (previous.identityTestMode === undefined) delete process.env.TIG_PORTONE_IDENTITY_TEST_MODE;
    else process.env.TIG_PORTONE_IDENTITY_TEST_MODE = previous.identityTestMode;
  });
}

function withMockedTossConfirmFetch(t, { totalAmount }) {
  const previousFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = previousFetch; });
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value === "https://api.tosspayments.com/v1/payments/confirm") {
      return Response.json({ status: "DONE", paymentKey: "toss_live_confirmed", approvedAt: "2026-07-22T12:00:00+09:00", totalAmount });
    }
    throw new Error(`unexpected TossPayments URL: ${value}`);
  };
}

test("configured tosspayments purchase succeeds when the confirmed amount includes the seat's service fee", async (t) => {
  withConfiguredTossEnv(t);
  const app = await ticketgroundApp(t);
  await verifyIdentity(app, "user_fan_a", "010-9000-0001");
  const ticket = await onSaleTicket(app);

  // This is exactly what the TossPayments widget actually charges
  // (checkout-panel.tsx trustedTotalAmount = faceValue + serviceFeePerSeat).
  withMockedTossConfirmFetch(t, { totalAmount: ticket.faceValue + 2000 });

  const purchase = await requestApp(app, {
    method: "POST",
    url: "/api/payments/tosspayments/purchase",
    headers: { "X-Idempotency-Key": "toss-configured-fee-ok" },
    body: { userId: "user_fan_a", ticketId: ticket.id, paymentMethod: "CREDIT_CARD", tossPaymentKey: "toss_live_confirmed" }
  });

  assert.equal(purchase.data.ticket.status, "OWNED");
  assert.equal(purchase.data.tosspayments.mock, false);
});

test("configured tosspayments purchase rejects a confirmed amount that is missing the service fee", async (t) => {
  withConfiguredTossEnv(t);
  const app = await ticketgroundApp(t);
  await verifyIdentity(app, "user_fan_a", "010-9000-0001");
  const ticket = await onSaleTicket(app);

  // Only the bare face value was actually charged/confirmed - e.g. a
  // tampered client that stripped the service fee before calling setAmount().
  withMockedTossConfirmFetch(t, { totalAmount: ticket.faceValue });

  const rejected = await requestApp(app, {
    method: "POST",
    url: "/api/payments/tosspayments/purchase",
    expectedStatus: 409,
    headers: { "X-Idempotency-Key": "toss-configured-fee-missing" },
    body: { userId: "user_fan_a", ticketId: ticket.id, paymentMethod: "CREDIT_CARD", tossPaymentKey: "toss_live_confirmed" }
  });

  assert.equal(rejected.error.code, "TOSSPAYMENTS_AMOUNT_MISMATCH");
  const state = await requestApp(app, { method: "GET", url: "/api/state" });
  const stillOnSale = state.data.tickets.find((item) => item.id === ticket.id);
  assert.equal(stillOnSale.status, "ON_SALE", "no ticket was allocated for a rejected amount mismatch");
});
