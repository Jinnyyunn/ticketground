export function createMobileLifecycleBackend({
  appendLedger,
  cancelResaleListing,
  hash,
  httpError,
  id,
  joinPool,
  listForResale,
  now,
  publicResalePool,
  sortJson
}) {
  function requestDigest(kind, payload) {
    return hash(`mobile-lifecycle:${kind}:payload:${JSON.stringify(sortJson(payload))}`);
  }

  function idempotentMutation(db, { kind, userId, key, payload }, mutate) {
    const keyDigest = hash(`mobile-lifecycle:${kind}:${userId}:${key}`);
    const digest = requestDigest(kind, payload);
    const existing = db.mobileMutationReceipts.find((receipt) => receipt.keyDigest === keyDigest);
    if (existing) {
      if (existing.requestDigest !== digest) {
        throw httpError(409, "IDEMPOTENCY_CONFLICT", "같은 재시도 키에 다른 요청이 전달되었습니다.");
      }
      return existing.response;
    }

    const response = mutate();
    db.mobileMutationReceipts.push({
      id: id("mobile_receipt"),
      kind,
      userId,
      keyDigest,
      requestDigest: digest,
      response,
      createdAt: now()
    });
    return response;
  }

  function mobileResalePool(pool) {
    const publicPool = publicResalePool(pool);
    return {
      id: publicPool.id,
      eventId: publicPool.eventId,
      performanceDateId: publicPool.performanceDateId,
      zoneId: publicPool.zoneId,
      ticketId: publicPool.ticketId,
      showSlug: publicPool.showSlug,
      price: publicPool.price,
      buyerFee: publicPool.buyerFee,
      buyerTotal: publicPool.buyerTotal,
      sellerSettlement: publicPool.sellerSettlement,
      buyerCount: publicPool.buyerCount,
      status: publicPool.status,
      createdAt: publicPool.createdAt,
      matchedAt: publicPool.matchedAt
    };
  }

  function listResalePoolsForPrincipal(db, userId) {
    return db.resalePools
      .filter((pool) => pool.sellerId === userId || pool.buyers.includes(userId))
      .map(mobileResalePool);
  }

  function createResalePoolForPrincipal(db, userId, body, idempotencyKey) {
    const payload = {
      ticketId: body.ticketId,
      price: body.price,
      showSlug: body.showSlug || null
    };
    return idempotentMutation(db, {
      kind: "resale-list",
      userId,
      key: idempotencyKey,
      payload
    }, () => mobileResalePool(listForResale(db, { sellerId: userId, ...payload })));
  }

  function joinResalePoolForPrincipal(db, userId, poolId, idempotencyKey) {
    return idempotentMutation(db, {
      kind: "resale-join",
      userId,
      key: idempotencyKey,
      payload: { poolId }
    }, () => mobileResalePool(joinPool(db, { buyerId: userId, poolId })));
  }

  function cancelResalePoolForPrincipal(db, userId, poolId) {
    return mobileResalePool(cancelResaleListing(db, { sellerId: userId, poolId }));
  }

  function publicCancellationRequest(request) {
    return {
      id: request.id,
      ticketId: request.ticketId,
      reason: request.reason,
      refundAcknowledged: request.refundAcknowledged,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt
    };
  }

  function listCancellationRequestsForPrincipal(db, userId) {
    return db.cancellationRequests
      .filter((request) => request.userId === userId)
      .map(publicCancellationRequest);
  }

  function createCancellationRequestForPrincipal(db, userId, body, idempotencyKey) {
    const reason = String(body.reason || "").trim();
    if (!reason) throw httpError(400, "MISSING_FIELD", "reason 값이 필요합니다.");
    if (body.refundAcknowledged !== true) {
      throw httpError(422, "REFUND_ACKNOWLEDGEMENT_REQUIRED", "환불 검토 절차를 확인해야 합니다.");
    }
    const payload = { ticketId: body.ticketId, reason, refundAcknowledged: true };
    return idempotentMutation(db, {
      kind: "cancellation-request",
      userId,
      key: idempotencyKey,
      payload
    }, () => {
      const ticket = db.tickets.find((item) => item.id === body.ticketId);
      if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
      if (ticket.ownerId !== userId) throw httpError(403, "NOT_OWNER", "소유한 티켓만 취소 요청할 수 있습니다.");
      if (ticket.status !== "OWNED") {
        throw httpError(409, "INVALID_TICKET_STATE", "보유 중인 티켓만 취소 요청할 수 있습니다.");
      }
      const activeRequest = db.cancellationRequests.find((request) => (
        request.userId === userId
        && request.ticketId === ticket.id
        && request.status === "PENDING_REVIEW"
      ));
      if (activeRequest) return publicCancellationRequest(activeRequest);
      const timestamp = now();
      const request = {
        id: id("cancel_request"),
        userId,
        ticketId: ticket.id,
        reason,
        refundAcknowledged: true,
        status: "PENDING_REVIEW",
        createdAt: timestamp,
        updatedAt: timestamp
      };
      db.cancellationRequests.push(request);
      appendLedger(db, userId, "CANCELLATION_REQUESTED", {
        cancellationRequestId: request.id,
        ticketId: ticket.id,
        status: request.status,
        policy: "manual-refund-review-required"
      });
      return publicCancellationRequest(request);
    });
  }

  function publicDevice(device) {
    return {
      id: device.id,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      platform: device.platform,
      status: device.status,
      createdAt: device.createdAt,
      lastVerifiedAt: device.lastVerifiedAt,
      revokedAt: device.revokedAt || null
    };
  }

  function listDevicesForPrincipal(db, userId) {
    return db.trustedDevices.filter((device) => device.userId === userId).map(publicDevice);
  }

  function revokeDeviceForPrincipal(db, userId, deviceId) {
    const device = db.trustedDevices.find((item) => item.id === deviceId && item.userId === userId);
    if (!device) throw httpError(404, "DEVICE_NOT_FOUND", "등록된 기기를 찾을 수 없습니다.");
    if (device.status !== "REVOKED") {
      device.status = "REVOKED";
      device.revokedAt = now();
      appendLedger(db, userId, "TRUSTED_DEVICE_REVOKED", {
        deviceId: device.id,
        platform: device.platform
      });
    }
    return publicDevice(device);
  }

  function publicPushToken(pushToken) {
    return {
      platform: pushToken.platform,
      status: pushToken.status,
      suffix: pushToken.suffix,
      createdAt: pushToken.createdAt,
      updatedAt: pushToken.updatedAt
    };
  }

  function listPushTokensForPrincipal(db, userId) {
    return db.pushTokens.filter((pushToken) => pushToken.userId === userId).map(publicPushToken);
  }

  function upsertPushTokenForPrincipal(db, userId, body, idempotencyKey) {
    const platform = String(body.platform || "").toLowerCase();
    if (platform !== "ios" && platform !== "android") {
      throw httpError(422, "UNSUPPORTED_PUSH_PLATFORM", "ios 또는 android 푸시 토큰만 등록할 수 있습니다.");
    }
    const token = String(body.token || "").trim();
    if (!token) throw httpError(400, "MISSING_FIELD", "token 값이 필요합니다.");
    const tokenDigest = hash(`push-token:${token}`);
    return idempotentMutation(db, {
      kind: "push-token-upsert",
      userId,
      key: idempotencyKey,
      payload: { platform, tokenDigest }
    }, () => {
      let pushToken = db.pushTokens.find((item) => item.userId === userId && item.tokenDigest === tokenDigest);
      const timestamp = now();
      if (!pushToken) {
        pushToken = {
          id: id("push_token"),
          userId,
          platform,
          tokenDigest,
          suffix: token.slice(-4),
          status: "ACTIVE",
          createdAt: timestamp,
          updatedAt: timestamp
        };
        db.pushTokens.push(pushToken);
      } else {
        pushToken.platform = platform;
        pushToken.status = "ACTIVE";
        pushToken.suffix = token.slice(-4);
        pushToken.updatedAt = timestamp;
      }
      appendLedger(db, userId, "PUSH_TOKEN_UPSERTED", {
        pushTokenId: pushToken.id,
        platform,
        suffix: pushToken.suffix
      });
      return publicPushToken(pushToken);
    });
  }

  return {
    cancelResalePoolForPrincipal,
    createCancellationRequestForPrincipal,
    createResalePoolForPrincipal,
    joinResalePoolForPrincipal,
    listCancellationRequestsForPrincipal,
    listDevicesForPrincipal,
    listPushTokensForPrincipal,
    listResalePoolsForPrincipal,
    revokeDeviceForPrincipal,
    upsertPushTokenForPrincipal
  };
}
