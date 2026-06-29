import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { api, buyFirstTicket, startServer } from "./backend-test-utils.mjs";

test("resale page registers and purchases through backend APIs", async (t) => {
  const { baseUrl } = await startServer(t);
  const { ticket } = await buyFirstTicket(baseUrl);
  const browser = await chromium.launch();
  t.after(async () => {
    await browser.close();
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${baseUrl}/resale?sessionUserId=user_fan_b`);
  const buyerOwnedTicketIds = await page.getByTestId("owned-ticket-select").locator("option").evaluateAll((options) =>
    options.map((option) => option.value)
  );
  assert.ok(!buyerOwnedTicketIds.includes(ticket.id), "buyer session must not see seller-owned tickets");

  await page.goto(`${baseUrl}/resale?sessionUserId=user_fan_a`);

  await page.getByTestId("owned-ticket-select").selectOption(ticket.id);
  await page.getByTestId("resale-price-input").fill(String(ticket.faceValue));

  const listResponse = page.waitForResponse((response) =>
    response.url().includes("/api/resale/list") && response.request().method() === "POST"
  );
  await page.getByTestId("resale-register").click();
  const listedResponse = await listResponse;
  const listedRequestBody = JSON.parse(listedResponse.request().postData() || "{}");
  assert.equal(listedRequestBody.sellerId, "user_fan_a");
  const listed = await listedResponse.json();
  assert.equal(listed.ok, true);
  assert.equal(listed.data.ticketId, ticket.id);

  await page.goto(`${baseUrl}/resale?sessionUserId=user_fan_b`);
  await page.getByRole("button", { name: "구하기" }).click();

  const purchaseResponse = page.waitForResponse((response) =>
    response.url().includes("/api/resale/purchase") && response.request().method() === "POST"
  );
  await page.getByTestId("resale-purchase").click();
  const purchasedResponse = await purchaseResponse;
  const purchasedRequestBody = JSON.parse(purchasedResponse.request().postData() || "{}");
  assert.equal(purchasedRequestBody.buyerId, "user_fan_b");
  const purchased = await purchasedResponse.json();
  assert.equal(purchased.ok, true);
  assert.equal(purchased.data.ticket.id, ticket.id);
  assert.equal(purchased.data.pool.status, "MATCHED");
  assert.equal(purchased.data.payment.status, "PAID");

  const buyerTickets = await api(baseUrl, "/api/users/user_fan_b/tickets");
  assert.deepEqual(buyerTickets.data.map((item) => item.id), [ticket.id]);
  await assert.match(await page.getByTestId("match-result").innerText(), /매칭 완료|결제 완료/);
});
