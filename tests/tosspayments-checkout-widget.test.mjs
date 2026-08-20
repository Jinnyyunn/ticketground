import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { api, startServer as startBackendServer, verifyIdentity } from "./backend-test-utils.mjs";

function startServer(t, options = {}) {
  return startBackendServer(t, {
    ...options,
    env: { NODE_ENV: "test", TIG_TOSSPAYMENTS_TEST_MODE: "1", ...options.env }
  });
}

async function lesMiserablesOnSaleTicket(baseUrl) {
  const state = await api(baseUrl, "/api/state");
  const ticket = state.data.tickets.find((item) => item.eventId === "event_c945b7fa842c" && item.status === "ON_SALE");
  assert.ok(ticket, "seeded les-miserables ticket exists");
  return ticket;
}

test("checkout still renders the fallback payment-method grid when TossPayments is unconfigured", async (t) => {
  const { baseUrl } = await startServer(t);
  const ticket = await lesMiserablesOnSaleTicket(baseUrl);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());

  const url = new URL(`${baseUrl}/checkout/les-miserables`);
  url.searchParams.set("date", "2026.05.13");
  url.searchParams.set("time", "19:30");
  url.searchParams.set("seats", ticket.seatLabel);
  url.searchParams.set("ticketId", ticket.id);
  await page.goto(url.toString(), { waitUntil: "networkidle" });

  await page.getByRole("heading", { name: "결제수단", level: 2 }).waitFor({ timeout: 5000 });
  assert.equal(await page.locator('input[name="payment-method"]').count(), 5, "the existing radio-button payment methods are untouched");
  assert.equal(await page.locator("#toss-payment-method").count(), 0, "no TossPayments widget mount point when unconfigured");
  assert.equal(await page.locator("#toss-agreement").count(), 0);
});

test("checkout swaps in the TossPayments widget mount points when TossPayments is configured", async (t) => {
  const { baseUrl } = await startServer(t, {
    env: {
      TIG_TOSSPAYMENTS_CLIENT_KEY: "test_gck_ticketground_fake_key",
      TIG_TOSSPAYMENTS_SECRET_KEY: "test_gsk_ticketground_fake_key",
    },
  });
  const ticket = await lesMiserablesOnSaleTicket(baseUrl);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());

  const url = new URL(`${baseUrl}/checkout/les-miserables`);
  url.searchParams.set("date", "2026.05.13");
  url.searchParams.set("time", "19:30");
  url.searchParams.set("seats", ticket.seatLabel);
  url.searchParams.set("ticketId", ticket.id);
  await page.goto(url.toString(), { waitUntil: "networkidle" });

  await page.getByRole("heading", { name: "결제수단", level: 2 }).waitFor({ timeout: 5000 });
  // "attached" only, not "visible" - a fake test clientKey never produces
  // real widget content from the live Toss SDK, so the mount points stay
  // empty (zero height). This test verifies our own conditional rendering
  // branch, not that Toss's SDK actually painted something into it.
  await page.locator("#toss-payment-method").waitFor({ timeout: 5000, state: "attached" });
  await page.locator("#toss-agreement").waitFor({ timeout: 5000, state: "attached" });
  assert.equal(await page.locator('input[name="payment-method"]').count(), 0, "the fallback radio grid is not rendered once Toss is configured");
});

test("checkout renders the identity verification gate above the payment method section", async (t) => {
  // Identity verification is a hard prerequisite for payment (the pay button
  // stays disabled until it's done), so it should render above the payment
  // method section rather than after it - asking the user to pick a payment
  // method before clearing the mandatory identity gate is backwards.
  const { baseUrl } = await startServer(t, {
    env: {
      TIG_TOSSPAYMENTS_CLIENT_KEY: "test_gck_ticketground_fake_key",
      TIG_TOSSPAYMENTS_SECRET_KEY: "test_gsk_ticketground_fake_key",
    },
  });
  const ticket = await lesMiserablesOnSaleTicket(baseUrl);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());

  const url = new URL(`${baseUrl}/checkout/les-miserables`);
  url.searchParams.set("date", "2026.05.13");
  url.searchParams.set("time", "19:30");
  url.searchParams.set("seats", ticket.seatLabel);
  url.searchParams.set("ticketId", ticket.id);
  await page.goto(url.toString(), { waitUntil: "networkidle" });

  await page.getByTestId("identity-gate").waitFor({ timeout: 5000 });
  await page.getByRole("heading", { name: "결제수단", level: 2 }).waitFor({ timeout: 5000 });

  const identityComesFirst = await page.evaluate(() => {
    const identityGate = document.querySelector('[data-testid="identity-gate"]');
    const paymentHeading = [...document.querySelectorAll("h2")].find((h) => h.textContent === "결제수단");
    if (!identityGate || !paymentHeading) return false;
    return Boolean(identityGate.compareDocumentPosition(paymentHeading) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  assert.equal(identityComesFirst, true);
});

test("checkout result page confirms a TossPayments purchase and forwards to the reservation page", async (t) => {
  const { baseUrl } = await startServer(t);
  await verifyIdentity(baseUrl, "user_fan_a", "010-9000-0001");
  const ticket = await lesMiserablesOnSaleTicket(baseUrl);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  t.after(() => context.close());
  await context.addInitScript(() => {
    window.localStorage.setItem("ticketground:session-user-id", "user_fan_a");
  });
  const page = await context.newPage();

  const url = new URL(`${baseUrl}/checkout/les-miserables/result`);
  url.searchParams.set("paymentKey", "toss_test_key_widget_flow");
  url.searchParams.set("orderId", ticket.id);
  url.searchParams.set("paymentMethod", "CREDIT_CARD");
  url.searchParams.set("date", "2026.05.13");
  url.searchParams.set("time", "19:30");
  await page.goto(url.toString(), { waitUntil: "networkidle" });

  await page.waitForURL(new RegExp(`/reservation/${ticket.id}`), { timeout: 5000 });
  await page.getByRole("heading", { name: "예매가 완료되었습니다" }).waitFor({ timeout: 5000 });

  const purchased = await api(baseUrl, "/api/state");
  const purchasedTicket = purchased.data.tickets.find((item) => item.id === ticket.id);
  assert.equal(purchasedTicket.status, "OWNED");
});

test("checkout result page shows a failure state when TossPayments never returned a paymentKey", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());

  const url = new URL(`${baseUrl}/checkout/les-miserables/result`);
  url.searchParams.set("message", "사용자가 결제를 취소했습니다.");
  await page.goto(url.toString(), { waitUntil: "networkidle" });

  await page.getByRole("heading", { name: "결제를 완료하지 못했습니다" }).waitFor({ timeout: 5000 });
  await page.getByText("사용자가 결제를 취소했습니다.").waitFor({ timeout: 5000 });
  await page.getByRole("link", { name: "결제 화면으로 돌아가기" }).waitFor({ timeout: 5000 });
});

test("checkout result page reports an expired session instead of silently failing", async (t) => {
  const { baseUrl } = await startServer(t);
  await verifyIdentity(baseUrl, "user_fan_a", "010-9000-0001");
  const ticket = await lesMiserablesOnSaleTicket(baseUrl);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());

  const url = new URL(`${baseUrl}/checkout/les-miserables/result`);
  url.searchParams.set("paymentKey", "toss_test_key_no_session");
  url.searchParams.set("orderId", ticket.id);
  url.searchParams.set("paymentMethod", "CREDIT_CARD");
  await page.goto(url.toString(), { waitUntil: "networkidle" });

  await page.getByRole("heading", { name: "결제를 완료하지 못했습니다" }).waitFor({ timeout: 5000 });
  await page.getByText("로그인 세션이 만료되었습니다").waitFor({ timeout: 5000 });

  const state = await api(baseUrl, "/api/state");
  const stillOnSale = state.data.tickets.find((item) => item.id === ticket.id);
  assert.equal(stillOnSale.status, "ON_SALE", "no purchase was attempted without a session");
});
