import { consumeNativeAuthHandoff } from "./native-auth-handoff.js";
import { publicSessionUser } from "./session-user.js";

export function createApiRouter({
  addSupportMessage,
  addPrincipalSupportMessage,
  adminHoldAdmissionCredential,
  acknowledgeOperatorAlerts,
  adminCancelResalePool,
  adminLedgerCsv,
  adminVenues,
  adminWorkspace,
  appendLedger,
  authorizeGate,
  assertTicketPurchasable,
  bootpayConfig,
  challenge,
  confirmBootpayPayment,
  createDraft,
  createHold,
  createAdminAccount,
  cancelResaleListing,
  createSupportThread,
  createPrincipalSupportThread,
  createEventDraft,
  demoSession,
  draft,
  directTransferAttempt,
  drawPool,
  deleteWatchlist,
  googleSession,
  googleNativeSession,
  httpError,
  completeNiceVerificationFromCallback,
  mockCompleteNiceVerification,
  issueQr,
  issueNativeSession,
  issueMobileQr,
  joinQueue,
  joinPool,
  listForResale,
  listMobileTickets,
  notifyWatchlist,
  nativeLogout,
  nativeSession,
  purchaseResale,
  putPushToken,
  putSettings,
  putWatchlist,
  putWatchlistNotification,
  profile,
  queue,
  publicCatalog,
  publicArtist,
  publicOpenCalendar,
  publicRegions,
  publicSupport,
  publicDirectTransferResult,
  publicPurchaseResult,
  publicResaleDrawResult,
  publicResalePool,
  publicState,
  publicTicketsForUser,
  publicIdentityStatus,
  socialAuthCallback,
  socialAuthPreflight,
  socialAuthSession,
  socialAuthStart,
  settings,
  approveGroupBookingRequest,
  buyPrimary,
  rejectGroupBookingRequest,
  reservationDetail,
  reservations,
  releaseHold,
  renewHold,
  revokeDevice,
  revokeMobileQr,
  revokePushToken,
  requireIdempotencyKey,
  requireNativePrincipal,
  seatMap,
  seats,
  startNiceVerification,
  submitGroupBookingRequest,
  supportThreadForUser,
  supportThreadDetail,
  supportThreads,
  testPayload,
  trust,
  trustDevice,
  updateEventSale,
  updateEventVenue,
  updateAdminAccount,
  updateDemoProfile,
  updateProfile,
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
  verifyMobileQrAtGate,
  virtualQr,
  watchlist
}) {
function requireBody(body, keys) {
  for (const key of keys) {
    if (body[key] === undefined || body[key] === "") {
      throw httpError(400, "MISSING_FIELD", `${key} 값이 필요합니다.`);
    }
  }
}

function resolvePurchaseUserId(db, req, body) {
  if (req.headers.authorization) {
    return requireNativePrincipal(db, req).userId;
  }
  return body.userId;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
}

function niceCallbackHtml(message) {
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><body style="font-family:sans-serif;padding:24px;text-align:center;">`
    + `<p>${escapeHtml(message)}</p>`
    + `<script>setTimeout(function(){ window.close(); }, 900);</script>`
    + `</body></html>`;
}

function decodeArtistSlug(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw httpError(400, "INVALID_ARTIST_SLUG", "아티스트 식별자를 확인해주세요.");
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
  const body = ["PATCH", "POST", "PUT"].includes(req.method) ? await parseBody(req) : {};
  const seatMapMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/seat-map$/);
  const userSessionMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/session$/);
  const userProfileMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/profile$/);
  const userIdentityMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/identity$/);
  const userTicketsMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/tickets$/);
  const userWatchlistMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/watchlist$/);
  const artistDiscoveryMatch = url.pathname.match(/^\/api\/discovery\/v1\/artists\/([^/]+)$/);
  const adminWorkspaceMatch = url.pathname.match(/^\/api\/admin\/workspaces\/([^/]+)$/);
  const principalSupportThreadMatch = url.pathname.match(/^\/api\/me\/support\/threads\/([^/]+)$/);
  const principalSupportMessageMatch = url.pathname.match(/^\/api\/me\/support\/threads\/([^/]+)\/messages$/);
  const principalReservationMatch = url.pathname.match(/^\/api\/me\/reservations\/([^/]+)$/);
  const principalWatchlistItemMatch = url.pathname.match(/^\/api\/me\/watchlist\/([^/]+)$/);
  const principalWatchlistNotificationMatch = url.pathname.match(/^\/api\/me\/watchlist\/([^/]+)\/notification$/);
  const bookingQueueMatch = url.pathname.match(/^\/api\/me\/booking\/queues\/([^/]+)$/);
  const bookingSeatsMatch = url.pathname.match(/^\/api\/me\/booking\/events\/([^/]+)\/performances\/([^/]+)\/seats$/);
  const bookingHoldMatch = url.pathname.match(/^\/api\/me\/booking\/holds\/([^/]+)$/);
  const bookingHoldRenewMatch = url.pathname.match(/^\/api\/me\/booking\/holds\/([^/]+)\/renew$/);
  const bookingDraftMatch = url.pathname.match(/^\/api\/me\/booking\/drafts\/([^/]+)$/);
  const principalDeviceMatch = url.pathname.match(/^\/api\/me\/devices\/([^/]+)$/);
  const principalPushTokenMatch = url.pathname.match(/^\/api\/me\/devices\/([^/]+)\/push-token$/);
  const principalTestPayloadMatch = url.pathname.match(/^\/api\/me\/devices\/([^/]+)\/test-payload$/);
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
  if (req.method === "GET" && url.pathname === "/api/discovery/v1/regions") return publicRegions(db);
  if (req.method === "GET" && url.pathname === "/api/discovery/v1/contract") {
    return {
      version: "1",
      endpoints: ["regions", "artists", "open-calendar"]
    };
  }
  if (req.method === "GET" && url.pathname === "/api/native/v1/contract") {
    return {
      version: "1",
      endpoints: [
        "profile",
        "reservations",
        "watchlist",
        "support",
        "booking",
        "devices",
        "mobile-ticket-qr"
      ]
    };
  }
  if (req.method === "GET" && artistDiscoveryMatch) {
    return publicArtist(db, decodeArtistSlug(artistDiscoveryMatch[1]));
  }
  if (req.method === "GET" && url.pathname === "/api/discovery/v1/open-calendar") {
    return publicOpenCalendar(db);
  }
  if (req.method === "GET" && url.pathname === "/api/payments/bootpay/config") return bootpayConfig();
  if (req.method === "POST" && url.pathname === "/api/group-booking/requests") return submitGroupBookingRequest(db, body);
  if (req.method === "GET" && url.pathname === "/api/auth/kakao/start") return socialAuthStart(req, "kakao");
  if (req.method === "GET" && url.pathname === "/api/auth/naver/start") return socialAuthStart(req, "naver");
  if (req.method === "GET" && url.pathname === "/api/auth/kakao/preflight") return socialAuthPreflight(req, "kakao");
  if (req.method === "GET" && url.pathname === "/api/auth/naver/preflight") return socialAuthPreflight(req, "naver");
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
  if (req.method === "GET" && userIdentityMatch) {
    const requestedUserId = decodeURIComponent(userIdentityMatch[1]);
    const sessionUserId = requireNativePrincipal(db, req).userId;
    if (sessionUserId !== requestedUserId) {
      throw httpError(403, "NOT_OWNER", "본인의 본인인증 상태만 조회할 수 있습니다.");
    }
    return publicIdentityStatus(db, requestedUserId);
  }
  if (req.method === "GET" && userTicketsMatch) return publicTicketsForUser(db, decodeURIComponent(userTicketsMatch[1]));
  if (req.method === "GET" && userWatchlistMatch) return userWatchlist(db, decodeURIComponent(userWatchlistMatch[1]));
  if (req.method === "GET" && url.pathname === "/api/me/profile") {
    return profile(db, requireNativePrincipal(db, req));
  }
  if (req.method === "PATCH" && url.pathname === "/api/me/profile") {
    return updateProfile(
      db,
      requireNativePrincipal(db, req),
      requireIdempotencyKey(req),
      body
    );
  }
  if (req.method === "GET" && url.pathname === "/api/me/reservations") {
    return reservations(db, requireNativePrincipal(db, req));
  }
  if (req.method === "GET" && principalReservationMatch) {
    return reservationDetail(
      db,
      requireNativePrincipal(db, req),
      decodeURIComponent(principalReservationMatch[1])
    );
  }
  if (req.method === "GET" && url.pathname === "/api/me/watchlist") {
    return watchlist(db, requireNativePrincipal(db, req));
  }
  if (req.method === "GET" && bookingQueueMatch) {
    return queue(db, requireNativePrincipal(db, req), decodeURIComponent(bookingQueueMatch[1]));
  }
  if (req.method === "GET" && bookingSeatsMatch) {
    const queueId = url.searchParams.get("queueId");
    if (!queueId) throw httpError(400, "MISSING_FIELD", "queueId 값이 필요합니다.");
    return seats(db, requireNativePrincipal(db, req), {
      eventId: decodeURIComponent(bookingSeatsMatch[1]),
      performanceId: decodeURIComponent(bookingSeatsMatch[2]),
      queueId
    });
  }
  if (req.method === "GET" && bookingDraftMatch) {
    return draft(db, requireNativePrincipal(db, req), decodeURIComponent(bookingDraftMatch[1]));
  }
  if (req.method === "GET" && url.pathname === "/api/me/notification-settings") {
    return settings(db, requireNativePrincipal(db, req));
  }
  if (req.method === "PUT" && principalWatchlistNotificationMatch) {
    return putWatchlistNotification(
      db,
      requireNativePrincipal(db, req),
      decodeURIComponent(principalWatchlistNotificationMatch[1]),
      requireIdempotencyKey(req),
      body
    );
  }
  if (req.method === "PUT" && principalWatchlistItemMatch) {
    return putWatchlist(
      db,
      requireNativePrincipal(db, req),
      decodeURIComponent(principalWatchlistItemMatch[1]),
      requireIdempotencyKey(req),
      body
    );
  }
  if (req.method === "DELETE" && principalWatchlistItemMatch) {
    return deleteWatchlist(
      db,
      requireNativePrincipal(db, req),
      decodeURIComponent(principalWatchlistItemMatch[1]),
      requireIdempotencyKey(req)
    );
  }
  if (req.method === "GET" && url.pathname === "/api/support/v1/public") return publicSupport();
  if (req.method === "GET" && url.pathname === "/api/me/support/threads") {
    return supportThreads(db, requireNativePrincipal(db, req));
  }
  if (req.method === "GET" && principalSupportThreadMatch) {
    return supportThreadDetail(
      db,
      requireNativePrincipal(db, req),
      decodeURIComponent(principalSupportThreadMatch[1])
    );
  }
  if (req.method === "GET" && url.pathname === "/api/support/threads") {
    const userId = url.searchParams.get("userId");
    if (!userId) throw httpError(400, "MISSING_FIELD", "userId 값이 필요합니다.");
    return supportThreadForUser(db, userId);
  }
  if (req.method === "GET" && url.pathname === "/api/seat-map") {
    return seatMap(db, {
      category: url.searchParams.get("category"),
      venueId: url.searchParams.get("venueId"),
      eventId: url.searchParams.get("eventId"),
      performanceDateId: url.searchParams.get("performanceDateId")
    });
  }
  if (req.method === "GET" && seatMapMatch) return venueMapForEvent(db, decodeURIComponent(seatMapMatch[1]));

  if (req.method === "POST" && url.pathname === "/api/support/threads") {
    requireBody(body, ["userId", "message"]);
    return createSupportThread(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/me/support/threads") {
    requireBody(body, ["message"]);
    return createPrincipalSupportThread(
      db,
      requireNativePrincipal(db, req),
      requireIdempotencyKey(req),
      body
    );
  }
  if (req.method === "POST" && url.pathname === "/api/me/booking/queues") {
    const principal = requireNativePrincipal(db, req);
    requireBody(body, ["eventId", "performanceId"]);
    return joinQueue(db, principal, requireIdempotencyKey(req), body);
  }
  if (req.method === "POST" && url.pathname === "/api/me/devices/challenges") {
    const principal = requireNativePrincipal(db, req);
    requireBody(body, ["deviceId"]);
    return challenge(db, principal, requireIdempotencyKey(req), body);
  }
  if (req.method === "POST" && url.pathname === "/api/me/devices/trust") {
    const principal = requireNativePrincipal(db, req);
    requireBody(body, ["challengeId", "deviceId", "counter", "proof"]);
    return trust(db, principal, requireIdempotencyKey(req), body);
  }
  if (req.method === "PUT" && principalPushTokenMatch) {
    const principal = requireNativePrincipal(db, req);
    requireBody(body, ["token"]);
    return putPushToken(db, principal, decodeURIComponent(principalPushTokenMatch[1]), requireIdempotencyKey(req), body);
  }
  if (req.method === "DELETE" && principalPushTokenMatch) {
    return revokePushToken(db, requireNativePrincipal(db, req), decodeURIComponent(principalPushTokenMatch[1]), requireIdempotencyKey(req));
  }
  if (req.method === "DELETE" && principalDeviceMatch) {
    return revokeDevice(db, requireNativePrincipal(db, req), decodeURIComponent(principalDeviceMatch[1]), requireIdempotencyKey(req));
  }
  if (req.method === "PUT" && url.pathname === "/api/me/notification-settings") {
    const principal = requireNativePrincipal(db, req);
    requireBody(body, ["watchlistOpen", "reservationUpdates"]);
    return putSettings(db, principal, requireIdempotencyKey(req), body);
  }
  if (req.method === "POST" && principalTestPayloadMatch) {
    return testPayload(db, requireNativePrincipal(db, req), decodeURIComponent(principalTestPayloadMatch[1]));
  }
  if (req.method === "POST" && url.pathname === "/api/me/booking/holds") {
    const principal = requireNativePrincipal(db, req);
    requireBody(body, ["queueId", "ticketId", "revision"]);
    return createHold(db, principal, requireIdempotencyKey(req), body);
  }
  if (req.method === "POST" && bookingHoldRenewMatch) {
    return renewHold(
      db,
      requireNativePrincipal(db, req),
      decodeURIComponent(bookingHoldRenewMatch[1]),
      requireIdempotencyKey(req)
    );
  }
  if (req.method === "DELETE" && bookingHoldMatch) {
    return releaseHold(
      db,
      requireNativePrincipal(db, req),
      decodeURIComponent(bookingHoldMatch[1]),
      requireIdempotencyKey(req)
    );
  }
  if (req.method === "POST" && url.pathname === "/api/me/booking/drafts") {
    const principal = requireNativePrincipal(db, req);
    requireBody(body, ["holdId"]);
    return createDraft(db, principal, requireIdempotencyKey(req), body);
  }
  if (req.method === "POST" && principalSupportMessageMatch) {
    requireBody(body, ["message"]);
    return addPrincipalSupportMessage(
      db,
      requireNativePrincipal(db, req),
      decodeURIComponent(principalSupportMessageMatch[1]),
      requireIdempotencyKey(req),
      body
    );
  }
  if (req.method === "POST" && url.pathname === "/api/support/messages") {
    requireBody(body, ["threadId", "actorId", "message"]);
    return addSupportMessage(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/auth/google") {
    requireBody(body, ["credential"]);
    return googleSession(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/auth/google/native") {
    requireBody(body, ["credential"]);
    return googleNativeSession(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/auth/native/handoff") {
    requireBody(body, ["provider", "code"]);
    const userId = consumeNativeAuthHandoff(
      db,
      body.provider,
      body.code,
      () => process.env.TIG_NOW || new Date().toISOString(),
    );
    const user = userId ? db.users.find((item) => item.id === userId) : null;
    if (!user) {
      throw httpError(401, "NATIVE_HANDOFF_INVALID", "앱 로그인 연결 정보를 확인할 수 없습니다.");
    }
    return { user: publicSessionUser(user), session: issueNativeSession(db, user.id) };
  }
  if (req.method === "GET" && url.pathname === "/api/auth/native/session") {
    return nativeSession(db, req);
  }
  if (req.method === "POST" && url.pathname === "/api/auth/native/logout") {
    return nativeLogout(db, req);
  }
  if (req.method === "POST" && url.pathname === "/api/identity/nice/start") {
    return startNiceVerification(db, { ...body, userId: resolvePurchaseUserId(db, req, body) });
  }
  if (req.method === "GET" && url.pathname === "/api/identity/nice/callback") {
    let message = "본인인증이 완료되었습니다. 창을 닫아주세요.";
    try {
      await completeNiceVerificationFromCallback(db, {
        identityVerificationId: url.searchParams.get("rid") || "",
        webTransactionId: url.searchParams.get("web_transaction_id") || ""
      });
    } catch (error) {
      message = error.message || "본인인증에 실패했습니다. 창을 닫고 다시 시도해주세요.";
    }
    return { rawBody: niceCallbackHtml(message), responseHeaders: { "Content-Type": "text/html; charset=utf-8" } };
  }
  if (req.method === "POST" && url.pathname === "/api/identity/nice/mock-complete") {
    requireBody(body, ["userId", "identityVerificationId", "phone"]);
    return mockCompleteNiceVerification(db, { ...body, userId: resolvePurchaseUserId(db, req, body) });
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
    authorizeGate(req.headers["x-tig-gate-key"]);
    return verifyQr(db, body);
  }
  if (req.method === "GET" && url.pathname === "/api/me/tickets") {
    return listMobileTickets(db, requireNativePrincipal(db, req));
  }
  const mobileQrMatch = url.pathname.match(/^\/api\/me\/tickets\/([^/]+)\/qr$/);
  if (mobileQrMatch && req.method === "POST") {
    return issueMobileQr(db, requireNativePrincipal(db, req), requireIdempotencyKey(req), decodeURIComponent(mobileQrMatch[1]), body);
  }
  if (mobileQrMatch && req.method === "DELETE") {
    return revokeMobileQr(db, requireNativePrincipal(db, req), requireIdempotencyKey(req), decodeURIComponent(mobileQrMatch[1]));
  }
  if (req.method === "POST" && url.pathname === "/api/gate/v1/verify") {
    requireBody(body, ["token"]);
    return verifyMobileQrAtGate(db, req.headers["x-tig-gate-key"], body.token);
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
