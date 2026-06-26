export function createCommerceBackend({
  appendLedger,
  currentTimeMs,
  ensureAdmissionCredential,
  eventDate,
  eventZone,
  findUser,
  hash,
  hmac,
  httpError,
  id,
  isEventBookable,
  money,
  now,
  resolvePaymentMethod,
  saleSummary
}) {
  const OFFICIAL_RESALE_FEE_RATE = 0.05;

  function buyPrimary(db, { userId, ticketId, paymentMethod }) {
    const user = findUser(db, userId);
    const ticket = db.tickets.find((item) => item.id === ticketId);
    const payment = resolvePaymentMethod(paymentMethod);
    if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
    if (ticket.status !== "ON_SALE") throw httpError(409, "TICKET_NOT_AVAILABLE", "구매 가능한 티켓이 아닙니다.");
    const { event, zone } = eventZone(db, ticket.eventId, ticket.zoneId);
    if (!isEventBookable(event)) {
      throw httpError(409, "EVENT_NOT_ON_SALE", `${saleSummary(event).label} 티켓은 아직 예매할 수 없습니다.`);
    }
    const performanceDate = eventDate(event, ticket.performanceDateId);
    if (payment.requiresBalance && user.balance < ticket.faceValue) {
      throw httpError(402, "INSUFFICIENT_BALANCE", "충전금이 부족합니다. 다른 결제수단을 선택해주세요.");
    }

    if (payment.requiresBalance) user.balance -= ticket.faceValue;
    ticket.ownerId = user.id;
    ticket.status = "OWNED";
    ticket.virtualQr = {
      issuedAt: now(),
      type: "VIRTUAL_TICKET"
    };
    const credential = ensureAdmissionCredential(db, { user, ticket, event, performanceDate });
    db.paymentTransactions.push({
      id: id("pay"),
      ticketId: ticket.id,
      userId: user.id,
      type: "PRIMARY",
      amount: ticket.faceValue,
      method: payment.key,
      status: payment.status,
      pgTransactionId: `${payment.key}-${hash(`${ticket.id}:${user.id}:${now()}`).slice(0, 12)}`,
      createdAt: now()
    });
    appendLedger(db, user.id, "PRIMARY_PURCHASE", {
      ticketId: ticket.id,
      admissionCredentialId: credential.id,
      eventId: event.id,
      performanceDateId: performanceDate.id,
      seatLabel: ticket.seatLabel,
      zone: zone.name,
      price: ticket.faceValue,
      paymentMethod: payment.key,
      paymentLabel: payment.label,
      paymentStatus: payment.status,
      approvalId: `${payment.key}-${id("pay").toUpperCase()}`,
      policy: "date-selected-seat-owner-assignment"
    });
    return { user, ticket, event, performanceDate, payment, admissionCredential: credential };
  }

  function listForResale(db, { sellerId, ticketId, price }) {
    const seller = findUser(db, sellerId);
    const ticket = db.tickets.find((item) => item.id === ticketId);
    if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
    if (ticket.ownerId !== seller.id) throw httpError(403, "NOT_OWNER", "소유자만 재판매 등록할 수 있습니다.");
    if (ticket.status !== "OWNED") throw httpError(409, "INVALID_TICKET_STATE", "보유 중인 티켓만 등록할 수 있습니다.");
    if (ticket.transferCount >= ticket.maxTransferCount) {
      throw httpError(409, "TRANSFER_LIMIT_REACHED", "양도 가능 횟수를 초과했습니다.");
    }

    const resalePrice = money(price);
    if (resalePrice < ticket.minPrice || resalePrice > ticket.maxPrice) {
      throw httpError(422, "PRICE_OUT_OF_POLICY", "가격 정책 범위를 벗어났습니다.", {
        minPrice: ticket.minPrice,
        maxPrice: ticket.maxPrice
      });
    }

    const pool = {
      id: id("pool"),
      eventId: ticket.eventId,
      performanceDateId: ticket.performanceDateId,
      zoneId: ticket.zoneId,
      ticketId: ticket.id,
      sellerId: seller.id,
      price: resalePrice,
      buyers: [],
      status: "OPEN",
      createdAt: now()
    };
    ticket.status = "IN_RESALE_POOL";
    db.resalePools.push(pool);
    appendLedger(db, seller.id, "RESALE_LISTED", {
      poolId: pool.id,
      ticketId: ticket.id,
      price: resalePrice,
      rule: "no-directed-transfer"
    });
    return pool;
  }

  function joinPool(db, { buyerId, poolId }) {
    const buyer = findUser(db, buyerId);
    const pool = db.resalePools.find((item) => item.id === poolId);
    if (!pool) throw httpError(404, "POOL_NOT_FOUND", "재판매 풀을 찾을 수 없습니다.");
    if (pool.status !== "OPEN") throw httpError(409, "POOL_CLOSED", "이미 종료된 풀입니다.");
    if (pool.sellerId === buyer.id) throw httpError(409, "SELF_PURCHASE_BLOCKED", "본인 티켓은 구매 대기할 수 없습니다.");
    if (!pool.buyers.includes(buyer.id)) pool.buyers.push(buyer.id);

    appendLedger(db, buyer.id, "POOL_JOINED", {
      poolId: pool.id,
      zoneId: pool.zoneId,
      policy: "buyer-hidden-random-queue"
    });
    return pool;
  }

  function openResalePool(db, poolId) {
    const pool = db.resalePools.find((item) => item.id === poolId);
    if (!pool) throw httpError(404, "POOL_NOT_FOUND", "재판매 풀을 찾을 수 없습니다.");
    if (pool.status !== "OPEN") throw httpError(409, "POOL_CLOSED", "이미 종료된 풀입니다.");
    return pool;
  }

  function completeResaleMatch(db, { pool, buyer, paymentMethod, seed, ledgerAction, policy }) {
    const seller = findUser(db, pool.sellerId);
    const ticket = db.tickets.find((item) => item.id === pool.ticketId);
    if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
    const payment = resolvePaymentMethod(paymentMethod);
    const fee = Math.ceil(pool.price * OFFICIAL_RESALE_FEE_RATE);
    const buyerTotal = pool.price + fee;
    const sellerSettlement = pool.price;

    if (payment.requiresBalance && buyer.balance < buyerTotal) {
      pool.buyers = pool.buyers.filter((idValue) => idValue !== buyer.id);
      appendLedger(db, buyer.id, "MATCH_SKIPPED_INSUFFICIENT_BALANCE", { poolId: pool.id });
      return { pool, skipped: buyer.id };
    }

    if (payment.requiresBalance) buyer.balance -= buyerTotal;
    seller.balance += sellerSettlement;
    ticket.ownerId = buyer.id;
    ticket.transferCount += 1;
    ticket.status = "OWNED";
    ticket.currentQr = null;
    const event = db.events.find((item) => item.id === ticket.eventId);
    const performanceDate = eventDate(event, ticket.performanceDateId);
    const credential = ensureAdmissionCredential(db, { user: buyer, ticket, event, performanceDate });
    pool.status = "MATCHED";
    pool.winnerId = buyer.id;
    pool.matchedAt = now();
    pool.paymentMethod = payment.key;
    pool.buyerFee = fee;
    pool.buyerTotal = buyerTotal;
    pool.sellerSettlement = sellerSettlement;
    db.paymentTransactions.push({
      id: id("pay"),
      ticketId: ticket.id,
      userId: buyer.id,
      sellerId: seller.id,
      type: "RESALE",
      amount: buyerTotal,
      transferAmount: sellerSettlement,
      platformFee: fee,
      platformFeeRate: OFFICIAL_RESALE_FEE_RATE,
      method: payment.key,
      status: payment.status,
      pgTransactionId: `${payment.key}-${hash(`${pool.id}:${buyer.id}:${now()}`).slice(0, 12)}`,
      createdAt: now()
    });

    appendLedger(db, "SYSTEM", ledgerAction, {
      poolId: pool.id,
      ticketId: ticket.id,
      admissionCredentialId: credential.id,
      sellerId: seller.id,
      buyerId: buyer.id,
      price: pool.price,
      buyerFee: fee,
      buyerTotal,
      sellerSettlement,
      feeRate: OFFICIAL_RESALE_FEE_RATE,
      paymentMethod: payment.key,
      randomSeedCommitment: seed,
      policy
    });
    return { pool, ticket, buyer, seller, fee, buyerTotal, sellerSettlement, payment, admissionCredential: credential };
  }

  function drawPool(db, { poolId, paymentMethod = "CREDIT_CARD" }) {
    const pool = openResalePool(db, poolId);
    if (pool.buyers.length === 0) throw httpError(409, "EMPTY_POOL", "대기자가 없습니다.");

    const seed = hmac(`${pool.id}:${pool.buyers.join(",")}:${currentTimeMs()}`);
    const winnerIndex = Number.parseInt(seed.slice(0, 8), 16) % pool.buyers.length;
    const winnerId = pool.buyers[winnerIndex];
    const buyer = findUser(db, winnerId);
    return completeResaleMatch(db, {
      pool,
      buyer,
      paymentMethod,
      seed,
      ledgerAction: "RANDOM_RESALE_MATCHED",
      policy: "zone-pool-random-assignment"
    });
  }

  function purchaseResale(db, { buyerId, poolId, paymentMethod = "CREDIT_CARD" }) {
    const buyer = findUser(db, buyerId);
    const pool = openResalePool(db, poolId);
    if (pool.sellerId === buyer.id) throw httpError(409, "SELF_PURCHASE_BLOCKED", "본인 티켓은 구매할 수 없습니다.");
    if (!pool.buyers.includes(buyer.id)) pool.buyers.push(buyer.id);
    appendLedger(db, buyer.id, "POOL_JOINED", {
      poolId: pool.id,
      zoneId: pool.zoneId,
      policy: "single-click-resale-purchase"
    });
    const seed = hmac(`${pool.id}:${buyer.id}:${currentTimeMs()}`);
    return completeResaleMatch(db, {
      pool,
      buyer,
      paymentMethod,
      seed,
      ledgerAction: "RESALE_PURCHASE_MATCHED",
      policy: "single-click-zone-pool-assignment"
    });
  }

  function directTransferAttempt(db, { actorId, ticketId, targetUserId, offeredPrice }) {
    const actor = findUser(db, actorId);
    const ticket = db.tickets.find((item) => item.id === ticketId);
    if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");

    actor.trustScore = Math.max(0, actor.trustScore - 18);
    actor.status = actor.trustScore < 40 ? "WATCHLIST" : actor.status;
    actor.sanctions.push({
      id: id("sanction"),
      reason: "지정 양도 시도",
      penalty: "trust-score-minus-18",
      at: now()
    });
    appendLedger(db, actor.id, "DIRECT_TRANSFER_BLOCKED", {
      ticketId,
      targetUserId,
      offeredPrice,
      reason: "missing-platform-approval-signature"
    });
    return { blocked: true, user: actor, ticket };
  }

  return { buyPrimary, directTransferAttempt, drawPool, joinPool, listForResale, purchaseResale };
}
