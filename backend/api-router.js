export function createApiRouter({
  addSupportMessage,
  adminSummary,
  adminVenues,
  adminWorkspace,
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
  buyPrimary,
  createAppAttestationNonce,
  seatMap,
  registerPushToken,
  startPortOneDanalVerification,
  supportThreadForUser,
  trustDevice,
  updateEventSale,
  updateEventVenue,
  updateAdminAccount,
  updateDemoProfile,
  updateSupportStatus,
  updateTicketStatus,
  updateUserStatus,
  updateUserStatuses,
  upsertWatchlist,
  userWatchlist,
  verifySessionToken,
  venueMapForEvent,
  verifyAppAttestation,
  verifyLedger,
  verifyQr,
  virtualQr
}) {
function requireBody(body, keys) {
  for (const key of keys) {
    if (body[key] === undefined || body[key] === "") {
      throw httpError(400, "MISSING_FIELD", `${key} 값이 필요합니다.`, { field: key });
    }
  }
}

function appConfig() {
  return {
    minSupportedVersion: process.env.TIG_APP_MIN_VERSION || "0.0.0",
    recommendedVersion: process.env.TIG_APP_RECOMMENDED_VERSION || process.env.TIG_APP_MIN_VERSION || "0.0.0",
    maintenanceMode: process.env.TIG_MAINTENANCE_MODE === "1",
    maintenanceMessage: process.env.TIG_MAINTENANCE_MESSAGE || "",
    appChannelRequired: ["/api/devices/trust", "/api/tickets/qr"]
  };
}

function bearerUserId(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return verifySessionToken(match[1]).userId;
  } catch {
    return null;
  }
}

function requireBearerUserMatch(tokenUserId, ownerUserId) {
  if (tokenUserId && tokenUserId !== ownerUserId) {
    throw httpError(403, "TOKEN_USER_MISMATCH", "세션 토큰 사용자와 요청 사용자가 일치하지 않습니다.", {
      tokenUserId,
      requestUserId: ownerUserId
    });
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
  const tokenUserId = bearerUserId(req);
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
    return {
      status: "UP",
      time: new Date().toISOString(),
      version: process.env.TIG_DEPLOY_SHA || "unknown"
    };
  }
  if (req.method === "GET" && url.pathname === "/api/app/config") return appConfig();
  if (req.method === "GET" && url.pathname === "/api/devices/attestation-nonce") {
    return createAppAttestationNonce(url.searchParams.get("purpose"));
  }
  if (req.method === "GET" && url.pathname === "/api/state") return publicState(db, { includeTickets: url.searchParams.get("include") === "tickets" });
  if (req.method === "GET" && url.pathname === "/api/catalog") {
    return publicCatalog(db, {
      limit: url.searchParams.get("limit"),
      cursor: url.searchParams.get("cursor")
    });
  }
  if (req.method === "GET" && url.pathname === "/api/payments/bootpay/config") return bootpayConfig();
  if (req.method === "GET" && url.pathname === "/api/auth/kakao/start") return socialAuthStart(req, "kakao");
  if (req.method === "GET" && url.pathname === "/api/auth/naver/start") return socialAuthStart(req, "naver");
  if (req.method === "GET" && url.pathname === "/api/auth/kakao/callback") return socialAuthCallback(db, req, "kakao", url.searchParams);
  if (req.method === "GET" && url.pathname === "/api/auth/naver/callback") return socialAuthCallback(db, req, "naver", url.searchParams);
  if (req.method === "GET" && url.pathname === "/api/auth/kakao/session") return socialAuthSession(db, req, "kakao");
  if (req.method === "GET" && url.pathname === "/api/auth/naver/session") return socialAuthSession(db, req, "naver");
  if (req.method === "GET" && url.pathname === "/api/ledger/verify") return verifyLedger(db);
  if (req.method === "GET" && url.pathname === "/api/ledger") return db.ledger.slice(-30).reverse();
  if (req.method === "GET" && url.pathname === "/api/admin/summary") return adminSummary(db);
  if (req.method === "GET" && url.pathname === "/api/admin/venues") return adminVenues(db);
  if (req.method === "GET" && adminWorkspaceMatch) return adminWorkspace(db, decodeURIComponent(adminWorkspaceMatch[1]), req.admin);
  if (req.method === "GET" && userSessionMatch) return demoSession(db, decodeURIComponent(userSessionMatch[1]));
  if (req.method === "GET" && userIdentityMatch) return publicIdentityStatus(db, decodeURIComponent(userIdentityMatch[1]));
  if (req.method === "GET" && userTicketsMatch) {
    const userId = decodeURIComponent(userTicketsMatch[1]);
    requireBearerUserMatch(tokenUserId, userId);
    return publicTicketsForUser(db, userId);
  }
  if (req.method === "GET" && userWatchlistMatch) {
    const userId = decodeURIComponent(userWatchlistMatch[1]);
    requireBearerUserMatch(tokenUserId, userId);
    return userWatchlist(db, userId);
  }
  if (req.method === "GET" && url.pathname === "/api/support/threads") {
    const userId = url.searchParams.get("userId");
    if (!userId) throw httpError(400, "MISSING_FIELD", "userId 값이 필요합니다.");
    requireBearerUserMatch(tokenUserId, userId);
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
    requireBearerUserMatch(tokenUserId, body.userId);
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
    requireBearerUserMatch(tokenUserId, body.userId);
    return startPortOneDanalVerification(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/identity/portone-danal/confirm") {
    requireBody(body, ["userId", "phone", "identityVerificationId"]);
    requireBearerUserMatch(tokenUserId, body.userId);
    return confirmPortOneDanalVerification(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/watchlist") {
    requireBody(body, ["userId", "eventId"]);
    requireBearerUserMatch(tokenUserId, body.userId);
    return upsertWatchlist(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/watchlist/notify") {
    return notifyWatchlist(db, body);
  }
  if (req.method === "POST" && userProfileMatch) {
    requireBody(body, ["name"]);
    requireBearerUserMatch(tokenUserId, decodeURIComponent(userProfileMatch[1]));
    return updateDemoProfile(db, {
      userId: decodeURIComponent(userProfileMatch[1]),
      name: body.name
    });
  }

  if (req.method === "POST" && url.pathname === "/api/tickets/buy") {
    requireBody(body, ["userId", "ticketId"]);
    requireBearerUserMatch(tokenUserId, body.userId);
    return publicPurchaseResult(buyPrimary(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/payments/bootpay/purchase") {
    requireBody(body, ["userId", "ticketId", "paymentMethod"]);
    requireBearerUserMatch(tokenUserId, body.userId);
    const receipt = await confirmBootpayPayment(db, {
      ticketId: body.ticketId,
      userId: body.userId,
      paymentKey: String(body.paymentMethod || "").toUpperCase(),
      receiptId: body.receiptId
    });
    const result = buyPrimary(db, {
      userId: body.userId,
      ticketId: body.ticketId,
      paymentMethod: body.paymentMethod,
      pgTransactionId: receipt.receiptId
    });
    return { ...publicPurchaseResult(result), bootpay: receipt };
  }
  if (req.method === "POST" && url.pathname === "/api/resale/list") {
    requireBody(body, ["sellerId", "ticketId", "price"]);
    requireBearerUserMatch(tokenUserId, body.sellerId);
    return publicResalePool(listForResale(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/join") {
    requireBody(body, ["buyerId", "poolId"]);
    requireBearerUserMatch(tokenUserId, body.buyerId);
    return publicResalePool(joinPool(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/cancel") {
    requireBody(body, ["sellerId", "poolId"]);
    requireBearerUserMatch(tokenUserId, body.sellerId);
    return publicResalePool(cancelResaleListing(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/draw") {
    requireBody(body, ["poolId"]);
    return publicResaleDrawResult(drawPool(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/purchase") {
    requireBody(body, ["buyerId", "poolId"]);
    requireBearerUserMatch(tokenUserId, body.buyerId);
    return publicResaleDrawResult(purchaseResale(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/security/direct-transfer-attempt") {
    requireBody(body, ["actorId", "ticketId", "targetUserId"]);
    requireBearerUserMatch(tokenUserId, body.actorId);
    return publicDirectTransferResult(directTransferAttempt(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/devices/trust") {
    requireBody(body, ["userId", "deviceId", "biometricVerified"]);
    requireBearerUserMatch(tokenUserId, body.userId);
    verifyAppAttestation(body, "TRUST_DEVICE", [body.userId, body.deviceId]);
    return trustDevice(db, { ...body, attestationVerified: true });
  }
  if (req.method === "POST" && url.pathname === "/api/devices/push-token") {
    requireBody(body, ["userId", "platform", "token"]);
    requireBearerUserMatch(tokenUserId, body.userId);
    return registerPushToken(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/tickets/qr") {
    requireBody(body, ["userId", "ticketId"]);
    requireBearerUserMatch(tokenUserId, body.userId);
    if (String(body.channel || "WEB").toUpperCase() === "APP") {
      requireBody(body, ["deviceId"]);
      verifyAppAttestation(body, "ISSUE_QR", [body.userId, body.deviceId, body.ticketId]);
      return issueQr(db, { ...body, attestationVerified: true });
    }
    return issueQr(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/tickets/virtual-qr") {
    requireBody(body, ["userId", "ticketId"]);
    requireBearerUserMatch(tokenUserId, body.userId);
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
