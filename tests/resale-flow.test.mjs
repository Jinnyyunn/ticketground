import test from "node:test";
import assert from "node:assert/strict";
import { adminApi, api, buyFirstTicket, startServer } from "./backend-test-utils.mjs";

test("backend rejects out-of-policy resale prices", async (t) => {
  const { baseUrl } = await startServer(t);
  const { ticket } = await buyFirstTicket(baseUrl);

  const aboveMax = await api(baseUrl, "/api/resale/list", {
    sellerId: "user_fan_a",
    ticketId: ticket.id,
    price: ticket.maxPrice + 1
  }, 422);
  assert.equal(aboveMax.error.code, "PRICE_OUT_OF_POLICY");
  assert.equal(aboveMax.error.detail.minPrice, ticket.minPrice);
  assert.equal(aboveMax.error.detail.maxPrice, ticket.maxPrice);

  const belowMin = await api(baseUrl, "/api/resale/list", {
    sellerId: "user_fan_a",
    ticketId: ticket.id,
    price: ticket.minPrice - 1
  }, 422);
  assert.equal(belowMin.error.code, "PRICE_OUT_OF_POLICY");
  assert.equal(belowMin.error.detail.minPrice, ticket.minPrice);
  assert.equal(belowMin.error.detail.maxPrice, ticket.maxPrice);
});

test("backend resale purchase joins and immediately matches clicked buyer", async (t) => {
  const server = await startServer(t);
  const { baseUrl } = server;
  const { ticket } = await buyFirstTicket(baseUrl);
  const price = ticket.faceValue;
  const expectedFee = Math.ceil(price * 0.05);

  const pool = await api(baseUrl, "/api/resale/list", {
    sellerId: "user_fan_a",
    ticketId: ticket.id,
    price
  });
  await api(baseUrl, "/api/resale/join", {
    buyerId: "user_scalper",
    poolId: pool.data.id
  });

  const purchase = await api(baseUrl, "/api/resale/purchase", {
    buyerId: "user_fan_b",
    poolId: pool.data.id,
    paymentMethod: "CREDIT_CARD"
  });
  assert.equal(purchase.data.fee, expectedFee);
  assert.equal(purchase.data.buyerTotal, price + expectedFee);
  assert.equal(purchase.data.sellerSettlement, price);
  assert.equal(purchase.data.pool.status, "MATCHED");
  assert.equal(purchase.data.pool.buyerFee, expectedFee);
  assert.equal(purchase.data.payment.status, "PAID");
  assert.equal(purchase.data.ticket.status, "OWNED");

  const clickedBuyerTickets = await api(baseUrl, "/api/users/user_fan_b/tickets");
  assert.deepEqual(clickedBuyerTickets.data.map((item) => item.id), [ticket.id]);
  const previousWaiterTickets = await api(baseUrl, "/api/users/user_scalper/tickets");
  assert.deepEqual(previousWaiterTickets.data, []);

  const admin = await adminApi(server, "/api/admin/summary");
  const matchedPool = admin.data.resalePools.find((item) => item.id === pool.data.id);
  assert.equal(matchedPool.winnerId, "user_fan_b");
});

test("backend resale draw applies official fee policy and settlement fields", async (t) => {
  const server = await startServer(t);
  const { baseUrl } = server;
  const { ticket } = await buyFirstTicket(baseUrl);
  const price = ticket.faceValue;
  const expectedFee = Math.ceil(price * 0.05);

  const pool = await api(baseUrl, "/api/resale/list", {
    sellerId: "user_fan_a",
    ticketId: ticket.id,
    price
  });
  assert.equal(pool.data.price, price);
  assert.equal(pool.data.buyerCount, 0);
  assert.equal(pool.data.buyers, undefined);

  const joined = await api(baseUrl, "/api/resale/join", {
    buyerId: "user_fan_b",
    poolId: pool.data.id
  });
  assert.equal(joined.data.status, "OPEN");
  assert.equal(joined.data.buyerCount, 1);
  assert.equal(joined.data.buyers, undefined);

  const stateAfterJoin = await api(baseUrl, "/api/state");
  const publicPool = stateAfterJoin.data.resalePools.find((item) => item.id === pool.data.id);
  assert.equal(publicPool.buyerCount, 1);
  assert.equal(publicPool.buyers, undefined);

  const draw = await api(baseUrl, "/api/resale/draw", {
    poolId: pool.data.id,
    paymentMethod: "CREDIT_CARD"
  });
  assert.equal(draw.data.fee, expectedFee);
  assert.equal(draw.data.buyerTotal, price + expectedFee);
  assert.equal(draw.data.sellerSettlement, price);
  assert.equal(draw.data.pool.buyerFee, expectedFee);
  assert.equal(draw.data.pool.buyerTotal, price + expectedFee);
  assert.equal(draw.data.pool.sellerSettlement, price);
  assert.equal(draw.data.payment.status, "PAID");
  assert.equal(draw.data.ticket.status, "OWNED");

  const admin = await adminApi(server, "/api/admin/summary");
  const match = admin.data.ledger.find((entry) => entry.action === "RANDOM_RESALE_MATCHED");
  assert.equal(match.payload.buyerFee, expectedFee);
  assert.equal(match.payload.buyerTotal, price + expectedFee);
  assert.equal(match.payload.sellerSettlement, price);
  assert.equal(match.payload.feeRate, 0.05);
});

test("backend rejects removed balance payment method without mutating resale pool", async (t) => {
  const server = await startServer(t);
  const { baseUrl } = server;
  const { ticket } = await buyFirstTicket(baseUrl);
  const pool = await api(baseUrl, "/api/resale/list", {
    sellerId: "user_fan_a",
    ticketId: ticket.id,
    price: ticket.faceValue
  });

  const rejected = await api(baseUrl, "/api/resale/purchase", {
    buyerId: "user_fan_b",
    poolId: pool.data.id,
    paymentMethod: "BALANCE"
  }, 422);
  assert.equal(rejected.error.code, "UNSUPPORTED_PAYMENT_METHOD");

  const admin = await adminApi(server, "/api/admin/summary");
  const poolState = admin.data.resalePools.find((item) => item.id === pool.data.id);
  const ticketState = admin.data.tickets.find((item) => item.id === ticket.id);
  assert.equal(poolState.status, "OPEN");
  assert.deepEqual(poolState.buyers, []);
  assert.equal(ticketState.status, "IN_RESALE_POOL");
  assert.equal(poolState.winnerId, undefined);
});
