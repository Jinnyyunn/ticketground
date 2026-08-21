export function createCommerceBackend({
  appendLedger,
  currentTimeMs,
  ensureAdmissionCredential,
  ensureIdentityVerified,
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

  function purchaseIdempotency(userId, key, payload) {
    return {
      keyDigest: hash(`purchase:${userId}:${key}`),
      requestDigest: hash(`purchase:payload:${JSON.stringify(payload)}`)
    };
  }

  function ticketPurchaseContext(db, ticketId) {
    const ticket = db.tickets.find((item) => item.id === ticketId);
    if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
    const { event, zone } = eventZone(db, ticket.eventId, ticket.zoneId);
    const performanceDate = eventDate(event, ticket.performanceDateId);
    return { ticket, event, zone, performanceDate };
  }

  function assertTicketPurchasable(db, ticketId, { allowOwnedSingleSeatHold = false, userId, reservationDraftId } = {}) {
    const context = ticketPurchaseContext(db, ticketId);
    let seatHold = null;
    let reservationDraft = null;
    if (context.ticket.status === "HELD" && allowOwnedSingleSeatHold && userId) {
      seatHold = db.seatHolds.find((item) => (
        item.id === context.ticket.heldBy
        && item.userId === userId
        && item.status === "ACTIVE"
        && item.ticketIds.length === 1
        && item.ticketIds[0] === context.ticket.id
        && Date.parse(item.expiresAt) > currentTimeMs()
      )) || null;
    }
    if (context.ticket.status === "RESERVED" && reservationDraftId && userId) {
      reservationDraft = db.reservationDrafts.find((item) => (
        item.id === reservationDraftId
        && item.userId === userId
        && item.status === "PENDING_PAYMENT"
        && item.ticketIds.length === 1
        && item.ticketIds[0] === context.ticket.id
        && context.ticket.reservationId === item.id
        && Date.parse(item.expiresAt) > currentTimeMs()
      )) || null;
    }
    if (context.ticket.status !== "ON_SALE" && !seatHold && !reservationDraft) {
      throw httpError(409, "TICKET_NOT_AVAILABLE", "구매 가능한 티켓이 아닙니다.");
    }
    if (!isEventBookable(context.event)) {
      throw httpError(409, "EVENT_NOT_ON_SALE", `${saleSummary(context.event).label} 티켓은 아직 예매할 수 없습니다.`);
    }
    return { ...context, seatHold, reservationDraft };
  }

  // A lost response after a successful purchase can make a client retry
  // the exact same request. Without this, that retry either fails on an
  // already-OWNED ticket (confusing the caller) or - if the caller reacts
  // by picking a different ticket - silently buys a second seat. A replay
  // with the same idempotency key returns the original result unchanged;
  // a reused key with different purchase details is rejected outright.
  //
  // Exposed separately (not just used inside buyPrimary) so a PG-specific
  // route can detect a replay BEFORE re-confirming payment with the
  // provider - re-confirming on every retry would either cost money/API
  // calls or, worse, fail outright because assertTicketPurchasable() will
  // no longer accept an already-OWNED ticket.
  function findIdempotentPurchase(db, userId, idempotencyKey, payload) {
    if (!idempotencyKey) return null;
    const idempotency = purchaseIdempotency(userId, idempotencyKey, payload);
    const existingTransaction = db.paymentTransactions.find((item) => item.idempotency?.keyDigest === idempotency.keyDigest);
    if (!existingTransaction) return null;
    if (existingTransaction.idempotency.requestDigest !== idempotency.requestDigest) {
      throw httpError(409, "IDEMPOTENCY_CONFLICT", "같은 재시도 키에 다른 구매 요청이 전달되었습니다.");
    }
    return existingTransaction;
  }

  function buyPrimary(db, {
    userId, ticketId, paymentMethod, pgTransactionId, idempotencyKey,
    allowOwnedSingleSeatHold = false, reservationDraftId, approvedAmount,
    idempotencyPaymentMethod = paymentMethod
  }) {
    const user = findUser(db, userId);
    ensureIdentityVerified(db, user.id);
    const payment = resolvePaymentMethod(paymentMethod);

    const existingTransaction = findIdempotentPurchase(
      db, user.id, idempotencyKey, { ticketId, paymentMethod: idempotencyPaymentMethod }
    );
    if (existingTransaction) {
      const context = ticketPurchaseContext(db, existingTransaction.ticketId);
      const credential = db.admissionCredentials.find((item) => item.ticketId === existingTransaction.ticketId);
      const replayPayment = resolvePaymentMethod(existingTransaction.method);
      return {
        user, ticket: context.ticket, event: context.event, performanceDate: context.performanceDate,
        payment: { ...replayPayment, amount: existingTransaction.amount }, admissionCredential: credential
      };
    }

    const { ticket, event, zone, performanceDate, seatHold, reservationDraft } = assertTicketPurchasable(db, ticketId, {
      allowOwnedSingleSeatHold,
      userId: user.id,
      reservationDraftId
    });

    ticket.ownerId = user.id;
    ticket.status = "OWNED";
    delete ticket.heldBy;
    delete ticket.holdExpiresAt;
    delete ticket.reservationId;
    delete ticket.reservationExpiresAt;
    if (seatHold) {
      seatHold.status = "CONVERTED";
      seatHold.updatedAt = now();
    }
    if (reservationDraft) {
      reservationDraft.status = "CONFIRMED";
      reservationDraft.updatedAt = now();
    }
    ticket.virtualQr = {
      issuedAt: now(),
      type: "VIRTUAL_TICKET"
    };
    const credential = ensureAdmissionCredential(db, { user, ticket, event, performanceDate });
    const paidAmount = Number.isFinite(approvedAmount)
      ? money(approvedAmount)
      : reservationDraft?.amount?.total ?? ticket.faceValue;
    db.paymentTransactions.push({
      id: id("pay"),
      ticketId: ticket.id,
      userId: user.id,
      type: "PRIMARY",
      amount: paidAmount,
      method: payment.key,
      status: payment.status,
      pgTransactionId: pgTransactionId || `${payment.key}-${hash(`${ticket.id}:${user.id}:${now()}`).slice(0, 12)}`,
      ...(idempotencyKey ? {
        idempotency: purchaseIdempotency(user.id, idempotencyKey, { ticketId, paymentMethod: idempotencyPaymentMethod })
      } : {}),
      createdAt: now()
    });
    appendLedger(db, user.id, "PRIMARY_PURCHASE", {
      ticketId: ticket.id,
      admissionCredentialId: credential.id,
      eventId: event.id,
      performanceDateId: performanceDate.id,
      seatLabel: ticket.seatLabel,
      zone: zone.name,
      price: paidAmount,
      amount: paidAmount,
      paymentMethod: payment.key,
      paymentLabel: payment.label,
      paymentStatus: payment.status,
      approvalId: `${payment.key}-${id("pay").toUpperCase()}`,
      policy: "date-selected-seat-owner-assignment"
    });
    return { user, ticket, event, performanceDate, payment: { ...payment, amount: paidAmount }, admissionCredential: credential };
  }

  const MAX_GROUP_PURCHASE_SEATS = 48;

  // Shape-validates a ticketIds array (present, non-empty, no duplicates,
  // within the group size cap) and returns the deduplicated list. Exposed
  // separately from buyPrimaryGroup() so a PG-specific route can reject a
  // malformed request with the right 400/422 BEFORE spending a TossPayments
  // API call - the same reason findIdempotentPurchase() is exposed on its
  // own for the single-ticket path.
  function normalizeGroupTicketIds(ticketIds) {
    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      throw httpError(400, "MISSING_FIELD", "ticketIds 값이 필요합니다.");
    }
    const uniqueTicketIds = [...new Set(ticketIds)];
    if (uniqueTicketIds.length !== ticketIds.length) {
      throw httpError(422, "DUPLICATE_SEAT", "같은 좌석을 중복해서 선택할 수 없습니다.");
    }
    if (uniqueTicketIds.length > MAX_GROUP_PURCHASE_SEATS) {
      throw httpError(422, "TOO_MANY_SEATS", `한 번에 구매할 수 있는 좌석은 최대 ${MAX_GROUP_PURCHASE_SEATS}석입니다.`);
    }
    return uniqueTicketIds;
  }

  function purchaseGroupIdempotency(userId, key, payload) {
    return {
      keyDigest: hash(`purchase-group:${userId}:${key}`),
      requestDigest: hash(`purchase-group:payload:${JSON.stringify(payload)}`)
    };
  }

  // Mirrors findIdempotentPurchase()'s replay/conflict semantics for a
  // multi-ticket order: every paymentTransaction created for the group
  // carries the same idempotency.keyDigest, so any one of them is enough to
  // detect a replay, but ALL of them are needed to reconstruct the full set
  // of purchased tickets for the replayed response.
  function findIdempotentGroupPurchase(db, userId, idempotencyKey, payload) {
    if (!idempotencyKey) return null;
    const idempotency = purchaseGroupIdempotency(userId, idempotencyKey, payload);
    const existingTransactions = db.paymentTransactions.filter((item) => item.idempotency?.keyDigest === idempotency.keyDigest);
    if (existingTransactions.length === 0) return null;
    if (existingTransactions.some((item) => item.idempotency.requestDigest !== idempotency.requestDigest)) {
      throw httpError(409, "IDEMPOTENCY_CONFLICT", "같은 재시도 키에 다른 구매 요청이 전달되었습니다.");
    }
    return existingTransactions;
  }

  // Splits one approved total across N tickets so every ticket still gets
  // its own paymentTransaction record (same shape admin/finance tooling
  // already reads) while the recorded amounts sum to EXACTLY the approved
  // total - no penny left unaccounted for by rounding. Falls back to each
  // ticket's own faceValue (no split needed) when no total was approved,
  // matching buyPrimary()'s own default when approvedAmount is absent.
  function splitGroupAmount(totalAmount, faceValues) {
    if (!Number.isFinite(totalAmount)) return faceValues.map((value) => money(value));
    const sumFaceValues = faceValues.reduce((sum, value) => sum + value, 0);
    const extra = totalAmount - sumFaceValues;
    const perSeatExtra = Math.floor(extra / faceValues.length);
    return faceValues.map((value, index) => {
      const isLast = index === faceValues.length - 1;
      const seatExtra = isLast ? extra - perSeatExtra * (faceValues.length - 1) : perSeatExtra;
      return money(value + seatExtra);
    });
  }

  // One order, multiple line items: TossPayments only ever sees a single
  // orderId/amount pair for the whole charge (that constraint lives entirely
  // in the route layer - see api-router.js), but a single purchase can cover
  // several tickets at once. Every ticket still gets its own
  // paymentTransaction, ledger entry and admission credential exactly like a
  // single-ticket buyPrimary() purchase would - they just share one
  // idempotency key and one pgTransactionId so retries and refunds treat the
  // group as one unit.
  //
  // Availability is checked for every ticket in the set BEFORE any of them
  // is mutated, and the whole check-then-mutate sequence below never awaits -
  // so nothing else can interleave and grab one of these seats mid-purchase
  // (the same synchronous-atomicity guarantee buyPrimary() relies on for the
  // single-ticket case). If any ticket in the set is no longer purchasable,
  // assertTicketPurchasable() throws before anything is mutated - a group
  // purchase never partially applies.
  //
  // Intentionally scoped to the web's holds-free direct-purchase model - it
  // does not support allowOwnedSingleSeatHold/reservationDraftId, since the
  // web checkout flow never creates seat holds or reservation drafts (only
  // the native app's separate booking-holds.js flow does).
  function buyPrimaryGroup(db, {
    userId, ticketIds, paymentMethod, pgTransactionId, idempotencyKey, approvedAmount,
    idempotencyPaymentMethod = paymentMethod
  }) {
    const user = findUser(db, userId);
    ensureIdentityVerified(db, user.id);
    const payment = resolvePaymentMethod(paymentMethod);

    const uniqueTicketIds = normalizeGroupTicketIds(ticketIds);
    const sortedTicketIds = [...uniqueTicketIds].sort();
    const existingTransactions = findIdempotentGroupPurchase(
      db, user.id, idempotencyKey, { ticketIds: sortedTicketIds, paymentMethod: idempotencyPaymentMethod }
    );
    if (existingTransactions) {
      const tickets = [];
      const admissionCredentials = [];
      for (const transaction of existingTransactions) {
        const context = ticketPurchaseContext(db, transaction.ticketId);
        tickets.push(context.ticket);
        admissionCredentials.push(db.admissionCredentials.find((item) => item.ticketId === transaction.ticketId) || null);
      }
      const first = ticketPurchaseContext(db, existingTransactions[0].ticketId);
      const replayPayment = resolvePaymentMethod(existingTransactions[0].method);
      const totalAmount = existingTransactions.reduce((sum, item) => sum + item.amount, 0);
      return {
        user, tickets, event: first.event, performanceDate: first.performanceDate,
        payment: { ...replayPayment, amount: totalAmount }, admissionCredentials
      };
    }

    const contexts = uniqueTicketIds.map((ticketId) => assertTicketPurchasable(db, ticketId, { userId: user.id }));
    const [{ event, performanceDate }] = contexts;
    if (contexts.some((context) => context.event.id !== event.id || context.performanceDate.id !== performanceDate.id)) {
      throw httpError(422, "SEAT_PERFORMANCE_MISMATCH", "선택한 좌석이 같은 회차에 속하지 않습니다.");
    }

    const faceValues = contexts.map((context) => context.ticket.faceValue);
    const perTicketAmounts = splitGroupAmount(approvedAmount, faceValues);
    const groupId = id("order");
    const sharedPgTransactionId = pgTransactionId || `${payment.key}-${hash(`${groupId}:${user.id}:${now()}`).slice(0, 12)}`;
    const idempotency = idempotencyKey
      ? purchaseGroupIdempotency(user.id, idempotencyKey, { ticketIds: sortedTicketIds, paymentMethod: idempotencyPaymentMethod })
      : null;

    const tickets = [];
    const admissionCredentials = [];
    contexts.forEach((context, index) => {
      const { ticket, zone, seatHold, reservationDraft } = context;
      ticket.ownerId = user.id;
      ticket.status = "OWNED";
      delete ticket.heldBy;
      delete ticket.holdExpiresAt;
      delete ticket.reservationId;
      delete ticket.reservationExpiresAt;
      if (seatHold) {
        seatHold.status = "CONVERTED";
        seatHold.updatedAt = now();
      }
      if (reservationDraft) {
        reservationDraft.status = "CONFIRMED";
        reservationDraft.updatedAt = now();
      }
      ticket.virtualQr = { issuedAt: now(), type: "VIRTUAL_TICKET" };
      const credential = ensureAdmissionCredential(db, { user, ticket, event, performanceDate });
      const paidAmount = perTicketAmounts[index];
      db.paymentTransactions.push({
        id: id("pay"),
        ticketId: ticket.id,
        userId: user.id,
        type: "PRIMARY",
        amount: paidAmount,
        method: payment.key,
        status: payment.status,
        pgTransactionId: sharedPgTransactionId,
        groupId,
        ...(idempotency ? { idempotency } : {}),
        createdAt: now()
      });
      appendLedger(db, user.id, "PRIMARY_PURCHASE", {
        ticketId: ticket.id,
        groupId,
        admissionCredentialId: credential.id,
        eventId: event.id,
        performanceDateId: performanceDate.id,
        seatLabel: ticket.seatLabel,
        zone: zone.name,
        price: paidAmount,
        amount: paidAmount,
        paymentMethod: payment.key,
        paymentLabel: payment.label,
        paymentStatus: payment.status,
        approvalId: `${payment.key}-${id("pay").toUpperCase()}`,
        policy: "date-selected-seat-owner-assignment-group"
      });
      tickets.push(ticket);
      admissionCredentials.push(credential);
    });

    const totalAmount = perTicketAmounts.reduce((sum, value) => sum + value, 0);
    return { user, tickets, event, performanceDate, payment: { ...payment, amount: totalAmount }, admissionCredentials };
  }

  function listForResale(db, { sellerId, ticketId, price, showSlug }) {
    const seller = findUser(db, sellerId);
    const ticket = db.tickets.find((item) => item.id === ticketId);
    if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
    if (ticket.ownerId !== seller.id) throw httpError(403, "NOT_OWNER", "소유자만 재판매 등록할 수 있습니다.");
    if (ticket.status !== "OWNED") throw httpError(409, "INVALID_TICKET_STATE", "보유 중인 티켓만 등록할 수 있습니다.");
    if (ticket.institutional) {
      throw httpError(403, "INSTITUTIONAL_TICKET_RESALE_BLOCKED", "기관 예매로 배정된 티켓은 재판매 등록할 수 없습니다.");
    }
    if (ticket.transferCount >= ticket.maxTransferCount) {
      throw httpError(409, "TRANSFER_LIMIT_REACHED", "양도 가능 횟수를 초과했습니다.");
    }

    const resalePrice = money(price);
    if (!Number.isFinite(resalePrice)) {
      throw httpError(422, "INVALID_RESALE_PRICE", "재판매 가격을 확인해주세요.", {
        minPrice: ticket.minPrice,
        maxPrice: ticket.maxPrice
      });
    }
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
      showSlug: showSlug || null,
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

  function cancelResaleListing(db, { sellerId, poolId }) {
    const seller = findUser(db, sellerId);
    const pool = db.resalePools.find((item) => item.id === poolId);
    if (!pool) throw httpError(404, "POOL_NOT_FOUND", "재판매 풀을 찾을 수 없습니다.");
    if (pool.sellerId !== seller.id) throw httpError(403, "NOT_OWNER", "등록자만 양도 등록을 취소할 수 있습니다.");
    if (pool.status !== "OPEN") throw httpError(409, "POOL_CLOSED", "이미 종료된 풀입니다.");
    const ticket = db.tickets.find((item) => item.id === pool.ticketId);
    if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
    if (ticket.ownerId !== seller.id) throw httpError(403, "NOT_OWNER", "소유자만 양도 등록을 취소할 수 있습니다.");

    ticket.status = "OWNED";
    pool.status = "CANCELED";
    pool.canceledAt = now();
    appendLedger(db, seller.id, "RESALE_LISTING_CANCELED", {
      poolId: pool.id,
      ticketId: ticket.id,
      policy: "seller-cancel-open-resale-pool"
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
    ensureIdentityVerified(db, buyer.id);
    const seller = findUser(db, pool.sellerId);
    const ticket = db.tickets.find((item) => item.id === pool.ticketId);
    if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
    const payment = resolvePaymentMethod(paymentMethod);
    const fee = Math.ceil(pool.price * OFFICIAL_RESALE_FEE_RATE);
    const buyerTotal = pool.price + fee;
    const sellerSettlement = pool.price;

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
    const payment = resolvePaymentMethod(paymentMethod);
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
      paymentMethod: payment.key,
      seed,
      ledgerAction: "RESALE_PURCHASE_MATCHED",
      policy: "single-click-zone-pool-assignment"
    });
  }

  function directTransferAttempt(db, { actorId, ticketId, targetUserId, offeredPrice }) {
    const actor = findUser(db, actorId);
    const ticket = db.tickets.find((item) => item.id === ticketId);
    if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
    if (ticket.ownerId !== actor.id) {
      throw httpError(403, "TICKET_OWNER_MISMATCH", "본인이 소유한 티켓에 대해서만 직접 양도 검증을 요청할 수 있습니다.", {
        actorId: actor.id,
        ticketId: ticket.id
      });
    }

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

  return {
    assertTicketPurchasable, buyPrimary, buyPrimaryGroup, cancelResaleListing, directTransferAttempt, drawPool,
    findIdempotentGroupPurchase, findIdempotentPurchase, joinPool, listForResale, normalizeGroupTicketIds, purchaseResale
  };
}
