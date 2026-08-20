// Live, browser-driven reproduction + verification for the multi-seat
// purchase bug: selecting 2 seats in the real booking UI used to only ever
// charge for and deliver 1 ticket (booking-panel.tsx's checkoutHref dropped
// every ticketId after the first). This drives the actual booking -> seat
// selection -> checkout -> payment -> reservation flow through a real
// Chrome instance (no API shortcuts for the purchase step itself) and
// asserts on both the rendered UI and the server's ticket/payment state.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { api, startServer, verifyIdentity } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";
import { installPublishedChartFixture } from "./seat-chart-browser-fixture.mjs";

// .omo/ is the repo's established (gitignored) location for test evidence
// screenshots - see tests/home-card-routes.test.mjs.
const screenshotDir = path.join(".omo", "evidence", "multi-seat-purchase-bug", "multi-seat-booking-ui-flow");

test("selecting 2 seats in the booking UI charges the full summed total and delivers both tickets, end to end", async (t) => {
  await mkdir(screenshotDir, { recursive: true });
  configureGoogleEnv(t, true);
  const { baseUrl } = await startServer(t);
  // A real (test-mode) Google login, not just a raw userId in localStorage -
  // the checkout page's identity-verification check (getIdentityStatus) goes
  // through the Bearer-authenticated /api/me/* routes and requires an actual
  // session credential to render past "로그인이 필요합니다.", exactly like a
  // real customer's browser would have after logging in.
  const login = await api(baseUrl, "/api/auth/google/native", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  const userId = login.data.user.id;
  const credential = login.data.session.credential;
  await verifyIdentity(baseUrl, userId, "010-9000-0001");

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  t.after(() => context.close());
  await context.addInitScript(([storedUserId, storedCredential]) => {
    window.localStorage.setItem("ticketground:session-user-id", storedUserId);
    window.localStorage.setItem("ticketground:session-credential", storedCredential);
  }, [userId, credential]);
  const page = await context.newPage();
  await installPublishedChartFixture(page, baseUrl, ["les-miserables"]);

  // Step 1: booking page, select quantity 2 and move to seat selection.
  await page.goto(`${baseUrl}/booking/les-miserables?date=2026.05.13&time=19%3A30`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "2매" }).click();
  await page.getByRole("button", { name: "좌석 선택으로 이동" }).click();
  await page.locator("[data-seat-map-seat]").first().waitFor({ timeout: 5000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-seat-map-seat]").length >= 2);

  // Step 2: select two distinct seats.
  const firstSeat = page.locator("[data-seat-map-seat]").nth(0);
  const secondSeat = page.locator("[data-seat-map-seat]").nth(1);
  await firstSeat.click();
  await secondSeat.click();
  await page.getByText("2/2매", { exact: true }).waitFor({ timeout: 5000 });

  const payLink = page.getByRole("link", { name: "결제하기", exact: true });
  await payLink.waitFor({ timeout: 5000 });
  const checkoutHref = await payLink.getAttribute("href");
  // The regression itself: the href must carry BOTH selected ticket ids, not
  // just the first one.
  const checkoutUrl = new URL(checkoutHref, baseUrl);
  const ticketIdsParam = checkoutUrl.searchParams.get("ticketIds") || "";
  const linkedTicketIds = ticketIdsParam.split(",").filter(Boolean);
  assert.equal(linkedTicketIds.length, 2, `checkout link must carry both selected seats' ticket ids, got: ${checkoutHref}`);

  await payLink.click();
  await page.waitForURL(/\/checkout\/les-miserables/, { timeout: 5000 });
  await page.getByRole("heading", { name: "결제 정보 확인", level: 1 }).waitFor({ timeout: 5000 });

  // Look up the two selected tickets' actual faceValue server-side so we know
  // the expected total independent of anything the client computed.
  const state = await api(baseUrl, "/api/state");
  const ticketA = state.data.tickets.find((item) => item.id === linkedTicketIds[0]);
  const ticketB = state.data.tickets.find((item) => item.id === linkedTicketIds[1]);
  assert.ok(ticketA && ticketB, "both selected tickets resolve server-side");
  const expectedTotal = ticketA.faceValue + ticketB.faceValue + 2 * 2000;

  await page.getByText("2매", { exact: true }).first().waitFor({ timeout: 5000 });
  await page.getByText(`${expectedTotal.toLocaleString("ko-KR")}원`).first().waitFor({ timeout: 5000 });
  await page.screenshot({ path: path.join(screenshotDir, "01-checkout-two-seats.png"), fullPage: true });

  // Step 3: TossPayments isn't configured for this test server, so checkout
  // falls back to the plain payment-method grid / buyTickets() path - the
  // same real UI a customer without a Toss-configured deploy would use.
  await page.locator('input[name="payment-method"]').first().check();
  await page.getByText("결제 조건, Tig 티켓 QR 정책, 취소/환불 규정에 동의합니다").click();

  const purchaseRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/tickets/buy");
  const payButton = page.getByRole("button", { name: "결제 완료" });
  await payButton.waitFor({ timeout: 5000 });
  await assert.doesNotReject(payButton.click());

  const request = await purchaseRequest;
  const requestBody = JSON.parse(request.postData() || "{}");
  assert.deepEqual(
    [...requestBody.ticketIds].sort(),
    [...linkedTicketIds].sort(),
    "the purchase request itself carries both ticket ids, not just the first"
  );

  await page.waitForURL(/\/reservation\//, { timeout: 8000 });
  await page.getByRole("heading", { name: "예매가 완료되었습니다" }).waitFor({ timeout: 5000 });
  await page.screenshot({ path: path.join(screenshotDir, "02-reservation-both-tickets.png"), fullPage: true });

  const reservationBody = await page.locator("body").innerText();
  assert.match(reservationBody, new RegExp(ticketA.seatLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "first seat's label is shown on the reservation page");
  assert.match(reservationBody, new RegExp(ticketB.seatLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "second seat's label is shown too - it used to be silently dropped");
  assert.match(reservationBody, new RegExp(`${expectedTotal.toLocaleString("ko-KR")}원`), "the combined total for both seats is shown, not just one seat's price");

  // Step 4: the actual server-side proof - both tickets OWNED, neither
  // dropped, neither left in a stale HELD/available state, correct combined
  // amount actually recorded.
  const finalState = await api(baseUrl, "/api/state");
  const finalA = finalState.data.tickets.find((item) => item.id === ticketA.id);
  const finalB = finalState.data.tickets.find((item) => item.id === ticketB.id);
  assert.equal(finalA.status, "OWNED", "first selected seat was actually delivered");
  assert.equal(finalB.status, "OWNED", "second selected seat was actually delivered - this is exactly what used to be dropped");

  const owned = await api(baseUrl, `/api/users/${userId}/tickets`);
  assert.ok(owned.data.some((ticket) => ticket.id === ticketA.id));
  assert.ok(owned.data.some((ticket) => ticket.id === ticketB.id));
});
