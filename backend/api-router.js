export function createApiRouter({
  addSupportMessage,
  adminHoldAdmissionCredential,
  acknowledgeOperatorAlerts,
  adminCancelResalePool,
  adminLedgerCsv,
  adminVenues,
  adminWorkspace,
  appendLedger,
  assertTicketPurchasable,
  bootpayConfig,
  confirmBootpayPayment,
  createAdminAccount,
  cancelResaleListing,
  createSupportThread,
  createEventDraft,
  demoSession,
  directTransferAttempt,
  drawPool,
  googleSession,
  httpError,
  confirmPortOneDanalVerification,
  issueQr,
  joinPool,
  listForResale,
  notifyWatchlist,
  purchaseResale,
  publicCatalog,
  publicDirectTransferResult,
  publicPurchaseResult,
  publicResaleDrawResult,
  publicResalePool,
  publicState,
  publicTicketsForUser,
  publicIdentityStatus,
  socialAuthCallback,
  socialAuthSession,
  socialAuthStart,
  approveGroupBookingRequest,
  buyPrimary,
  rejectGroupBookingRequest,
  seatMap,
  startPortOneDanalVerification,
  submitGroupBookingRequest,
  supportThreadForUser,
  trustDevice,
  updateEventSale,
  updateEventVenue,
  updateAdminAccount,
  updateDemoProfile,
  updateSupportStatus,
  updateTicketStatus,
  updateTicketStatuses,
  updateUserStatus,
  updateUserStatuses,
  upsertWatchlist,
  userWatchlist,
  venueMapForEvent,
  verifyAppAttestation,
  verifyLedger,
  verifyQr,
  virtualQr
}) {
function requireBody(body, keys) {
  for (const key of keys) {
    if (body[key] === undefined || body[key] === "") {
      throw httpError(400, "MISSING_FIELD", `${key} 값이 필요합니다.`);
    }
  }
}

async function parseBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8 * 1024 * 1024) {
      throw httpError(413, "REQUEST_TOO_LARGE", "요청 본문이 너무 큽니다.");
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw httpError(400, "BAD_JSON", "JSON 본문을 확인해주세요.");
  }
}

async function handleApi(req, res, db, surface) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const body = req.method === "POST" ? await parseBody(req) : {};
  const seatMapMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/seat-map$/);
  const userSessionMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/session$/);
  const userProfileMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/profile$/);
  const userIdentityMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/identity$/);
  const userTicketsMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/tickets$/);
  const userWatchlistMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/watchlist$/);
  const adminWorkspaceMatch = url.pathname.match(/^\/api\/admin\/workspaces\/([^/]+)$/);
  const adminOnly = url.pathname.startsWith("/api/admin/") || url.pathname === "/api/admin/summary" || url.pathname === "/api/ledger";

  if (adminOnly && surface !== "admin") {
    throw httpError(404, "NOT_FOUND", "요청한 API가 없습니다.");
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    return { status: "UP", version: "78b3c7c" };
  }
  if (req.method === "GET" && url.pathname === "/api/state") return publicState(db);
  if (req.method === "GET" && url.pathname === "/api/catalog") {
    const rawLimit = url.searchParams.get("limit");
    if (rawLimit === null) return publicCatalog(db);
    const limit = Number(rawLimit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw httpError(400, "INVALID_LIMIT", "limit은 1 이상 100 이하의 정수여야 합니다.");
    }
    return publicCatalog(db, { limit });
  }
  if (req.method === "GET" && url.pathname === "/api/payments/bootpay/config") return bootpayConfig();
  if (req.method === "POST" && url.pathname === "/api/group-booking/requests") return submitGroupBookingRequest(db, body);
  if (req.method === "GET" && url.pathname === "/api/auth/kakao/start") return socialAuthStart(req, "kakao");
  if (req.method === "GET" && url.pathname === "/api/auth/naver/start") return socialAuthStart(req, "naver");
  if (req.method === "GET" && url.pathname === "/api/auth/kakao/callback") return socialAuthCallback(db, req, "kakao", url.searchParams);
  if (req.method === "GET" && url.pathname === "/api/auth/naver/callback") return socialAuthCallback(db, req, "naver", url.searchParams);
  if (req.method === "GET" && url.pathname === "/api/auth/kakao/session") return socialAuthSession(db, req, "kakao");
  if (req.method === "GET" && url.pathname === "/api/auth/naver/session") return socialAuthSession(db, req, "naver");
  if (req.method === "GET" && url.pathname === "/api/ledger/verify") return verifyLedger(db);
  if (req.method === "GET" && url.pathname === "/api/ledger") return db.ledger.slice(-30).reverse();
  if (req.method === "GET" && url.pathname === "/api/admin/summary") return adminWorkspace(db, "overview", req.admin);
  if (req.method === "GET" && url.pathname === "/api/admin/venues") return adminVenues(db);
  if (req.method === "GET" && url.pathname === "/api/admin/ledger/export") {
    return {
      rawBody: adminLedgerCsv(db, {
        action: url.searchParams.get("action") || undefined,
        actorId: url.searchParams.get("actorId") || undefined,
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined
      }),
      responseHeaders: {
        "Content-Disposition": "attachment; filename=\"ticketground-ledger.csv\"",
        "Content-Type": "text/csv; charset=utf-8"
      }
    };
  }
  if (req.method === "GET" && adminWorkspaceMatch) {
    return adminWorkspace(db, decodeURIComponent(adminWorkspaceMatch[1]), req.admin, {
      action: url.searchParams.get("action") || undefined,
      actorId: url.searchParams.get("actorId") || undefined,
      category: url.searchParams.get("category") || undefined,
      eventId: url.searchParams.get("eventId") || undefined,
      from: url.searchParams.get("from") || undefined,
      method: url.searchParams.get("method") || undefined,
      performanceDateId: url.searchParams.get("performanceDateId") || undefined,
      status: url.searchParams.get("status") || undefined,
      search: url.searchParams.get("search") || undefined,
      to: url.searchParams.get("to") || undefined,
      zoneId: url.searchParams.get("zoneId") || undefined,
      limit: url.searchParams.get("limit") || undefined,
      page: url.searchParams.get("page") || undefined
    });
  }
  if (req.method === "GET" && userSessionMatch) return demoSession(db, decodeURIComponent(userSessionMatch[1]));
  if (req.method === "GET" && userIdentityMatch) return publicIdentityStatus(db, decodeURIComponent(userIdentityMatch[1]));
  if (req.method === "GET" && userTicketsMatch) return publicTicketsForUser(db, decodeURIComponent(userTicketsMatch[1]));
  if (req.method === "GET" && userWatchlistMatch) return userWatchlist(db, decodeURIComponent(userWatchlistMatch[1]));
  if (req.method === "GET" && url.pathname === "/api/support/threads") {
    const userId = url.searchParams.get("userId");
    if (!userId) throw httpError(400, "MISSING_FIELD", "userId 값이 필요합니다.");
    return supportThreadForUser(db, userId);
  }
  if (req.method === "GET" && url.pathname === "/api/seat-map") {
    return seatMap(db, {
      category: url.searchParams.get("category"),
      venueId: url.searchParams.get("venueId"),
      eventId: url.searchParams.get("eventId")
    });
  }
  if (req.method === "GET" && seatMapMatch) return venueMapForEvent(db, decodeURIComponent(seatMapMatch[1]));

  if (req.method === "POST" && url.pathname === "/api/support/threads") {
    requireBody(body, ["userId", "message"]);
    return createSupportThread(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/support/messages") {
    requireBody(body, ["threadId", "actorId", "message"]);
    return addSupportMessage(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/auth/google") {
    requireBody(body, ["credential"]);
    return googleSession(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/identity/portone-danal/start") {
    requireBody(body, ["userId", "phone"]);
    return startPortOneDanalVerification(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/identity/portone-danal/confirm") {
    requireBody(body, ["userId", "phone", "identityVerificationId"]);
    return confirmPortOneDanalVerification(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/watchlist") {
    requireBody(body, ["userId", "eventId"]);
    return upsertWatchlist(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/watchlist/notify") {
    return notifyWatchlist(db, body);
  }
  if (req.method === "POST" && userProfileMatch) {
    requireBody(body, ["name"]);
    return updateDemoProfile(db, {
      userId: decodeURIComponent(userProfileMatch[1]),
      name: body.name
    });
  }

  if (req.method === "POST" && url.pathname === "/api/tickets/buy") {
    requireBody(body, ["userId", "ticketId"]);
    return publicPurchaseResult(buyPrimary(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/payments/bootpay/purchase") {
    requireBody(body, ["userId", "ticketId", "paymentMethod"]);
    const purchasable = assertTicketPurchasable(db, body.ticketId);
    const receipt = await confirmBootpayPayment(db, {
      ticketId: body.ticketId,
      userId: body.userId,
      paymentKey: String(body.paymentMethod || "").toUpperCase(),
      receiptId: body.receiptId,
      expectedAmount: purchasable.ticket.faceValue
    });
    let result;
    try {
      result = buyPrimary(db, {
        userId: body.userId,
        ticketId: body.ticketId,
        paymentMethod: body.paymentMethod,
        pgTransactionId: receipt.receiptId
      });
    } catch (error) {
      appendLedger(db, body.userId, "BOOTPAY_PAYMENT_NEEDS_REFUND", {
        ticketId: body.ticketId,
        receiptId: receipt.receiptId,
        amount: purchasable.ticket.faceValue,
        reason: error.code || "ALLOCATION_FAILED"
      });
      throw httpError(409, "PAYMENT_CAPTURED_ALLOCATION_FAILED", "결제는 완료되었으나 좌석 배정에 실패했습니다. 고객센터로 문의해주세요.", {
        ticketId: body.ticketId,
        receiptId: receipt.receiptId,
        reason: error.code || "ALLOCATION_FAILED"
      });
    }
    return { ...publicPurchaseResult(result), bootpay: receipt };
  }
  if (req.method === "POST" && url.pathname === "/api/resale/list") {
    requireBody(body, ["sellerId", "ticketId", "price"]);
    return publicResalePool(listForResale(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/join") {
    requireBody(body, ["buyerId", "poolId"]);
    return publicResalePool(joinPool(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/cancel") {
    requireBody(body, ["sellerId", "poolId"]);
    return publicResalePool(cancelResaleListing(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/draw") {
    requireBody(body, ["poolId"]);
    return publicResaleDrawResult(drawPool(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/purchase") {
    requireBody(body, ["buyerId", "poolId"]);
    return publicResaleDrawResult(purchaseResale(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/security/direct-transfer-attempt") {
    requireBody(body, ["actorId", "ticketId", "targetUserId"]);
    return publicDirectTransferResult(directTransferAttempt(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/devices/trust") {
    requireBody(body, ["userId", "deviceId", "biometricVerified"]);
    verifyAppAttestation(body, "TRUST_DEVICE", [body.userId, body.deviceId]);
    return trustDevice(db, { ...body, attestationVerified: true });
  }
  if (req.method === "POST" && url.pathname === "/api/tickets/qr") {
    requireBody(body, ["userId", "ticketId"]);
    if (String(body.channel || "WEB").toUpperCase() === "APP") {
      requireBody(body, ["deviceId", "appAttestation"]);
      verifyAppAttestation(body, "ISSUE_QR", [body.userId, body.deviceId, body.ticketId]);
      return issueQr(db, { ...body, attestationVerified: true });
    }
    return issueQr(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/tickets/virtual-qr") {
    requireBody(body, ["userId", "ticketId"]);
    return virtualQr(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/gate/verify") {
    requireBody(body, ["ticketId", "ownerId", "expiresAt", "nonce", "signature"]);
    return verifyQr(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/events/venue") {
    requireBody(body, ["eventId", "venueId"]);
    return updateEventVenue(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/events/sale") {
    requireBody(body, ["eventId", "title", "category", "startsAt", "venueId"]);
    return updateEventSale(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/events/create") {
    requireBody(body, ["title", "category", "startsAt", "venueId", "imageDataUrl"]);
    return createEventDraft(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/admin-accounts") {
    requireBody(body, ["username", "password", "roleKeys"]);
    return createAdminAccount(db, body, req.admin);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/admin-accounts/update") {
    requireBody(body, ["adminId", "roleKeys"]);
    return updateAdminAccount(db, body, req.admin);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/users/status") {
    requireBody(body, ["userId", "status"]);
    return updateUserStatus(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/users/statuses") {
    requireBody(body, ["updates"]);
    return updateUserStatuses(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/tickets/status") {
    requireBody(body, ["ticketId", "status"]);
    return updateTicketStatus(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/tickets/statuses") {
    requireBody(body, ["updates"]);
    return updateTicketStatuses(db, body);
  }
  const approveGroupBookingMatch = url.pathname.match(/^\/api\/admin\/group-booking\/requests\/([^/]+)\/approve$/);
  if (req.method === "POST" && approveGroupBookingMatch) {
    return approveGroupBookingRequest(db, {
      requestId: decodeURIComponent(approveGroupBookingMatch[1]),
      assignedCount: body.assignedCount,
      reviewNote: body.reviewNote
    }, req.admin);
  }
  const rejectGroupBookingMatch = url.pathname.match(/^\/api\/admin\/group-booking\/requests\/([^/]+)\/reject$/);
  if (req.method === "POST" && rejectGroupBookingMatch) {
    return rejectGroupBookingRequest(db, {
      requestId: decodeURIComponent(rejectGroupBookingMatch[1]),
      reviewNote: body.reviewNote
    }, req.admin);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/admission/hold") {
    requireBody(body, ["credentialId", "hold"]);
    return adminHoldAdmissionCredential(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/resale/cancel") {
    requireBody(body, ["poolId"]);
    return adminCancelResalePool(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/alerts/ack") {
    return acknowledgeOperatorAlerts(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/support/messages") {
    requireBody(body, ["threadId", "message"]);
    return addSupportMessage(db, { ...body, actorId: "ADMIN", role: "ADMIN" });
  }
  if (req.method === "POST" && url.pathname === "/api/admin/support/status") {
    requireBody(body, ["threadId", "status"]);
    return updateSupportStatus(db, body);
  }

  throw httpError(404, "NOT_FOUND", "요청한 API가 없습니다.");
}


  return { handleApi };
}
