import { consumeNativeAuthHandoff } from "./native-auth-handoff.js";
import { publicSessionUser } from "./session-user.js";
import {
  clearSellerSessionCookie,
  createSellerSessionToken,
  recordSellerLoginAttempt,
  requireSellerSession,
  sellerSessionCookie
} from "./seller-session.js";

export function createApiRouter({
  accountTicketsForUser,
  addSupportMessage,
  addSupportMessageForPrincipal,
  authenticateNativeSession,
  adminHoldAdmissionCredential,
  acknowledgeOperatorAlerts,
  adminCancelResalePool,
  adminLedgerCsv,
  adminVenues,
  adminWorkspace,
  appendLedger,
  assertTicketPurchasable,
  authenticateSellerAccount,
  bootpayConfig,
  changeSellerPassword,
  confirmBootpayPayment,
  cancelTosspaymentsPayment,
  confirmTosspaymentsPayment,
  createAdminAccount,
  cancelResaleListing,
  createReservationDraft,
  createSeatHold,
  createSupportThread,
  createSupportThreadForPrincipal,
  createEventDraft,
  cancelReservationDraft,
  createSellerEvent,
  currentTimeMs,
  demoSession,
  directTransferAttempt,
  drawPool,
  enterQueue,
  extendSeatHold,
  findIdempotentPurchase,
  getQueueEntry,
  getReservationDraft,
  getSeatHold,
  googleSession,
  googleNativeSession,
  hmac,
  httpError,
  isDev,
  confirmPortOneDanalVerification,
  SERVICE_FEE_PER_SEAT,
  issueQr,
  issueNativeSession,
  issueSellerAccount,
  joinPool,
  leaveQueue,
  listForResale,
  listSellerEvents,
  notifyWatchlist,
  nativeLogout,
  nativeSession,
  optionalAuthenticateNativeSession,
  purchaseResale,
  readBusinessRegistrationFile,
  releaseSeatHold,
  publicCatalog,
  publicSupportContent,
  publicArtist,
  publicOpenCalendar,
  publicRegions,
  publicDirectTransferResult,
  publicPurchaseResult,
  publicResaleDrawResult,
  publicResalePool,
  publicState,
  removeWatchlistForPrincipal,
  publicTicketsForUser,
  publicIdentityStatus,
  approveSellerApplication,
  rejectSellerApplication,
  reviewSellerEvent,
  sellerAccountDto,
  sellerSession,
  submitSellerApplication,
  socialAuthCallback,
  socialAuthPreflight,
  socialAuthSession,
  socialAuthStart,
  approveGroupBookingRequest,
  buyPrimary,
  rejectGroupBookingRequest,
  seatMap,
  startPortOneDanalVerification,
  submitGroupBookingRequest,
  supportThreadForUser,
  supportThreadsForPrincipal,
  isWebhookSignatureValid,
  tosspaymentsConfig,
  trustDevice,
  updateEventSale,
  updateEventVenue,
  updateAdminAccount,
  updateDemoProfile,
  updateSellerEvent,
  updateSupportStatus,
  updateSellerApplicationChecklist,
  updateTicketStatus,
  updateTicketStatuses,
  updateUserStatus,
  updateUserStatuses,
  upsertWatchlist,
  upsertWatchlistForPrincipal,
  userWatchlist,
  userWatchlistForPrincipal,
  venueMapForEvent,
  verifyAppAttestation,
  verifyLedger,
  verifyQr,
  virtualQr
}) {
function isSecureRequest(req) {
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  return proto === "https" || req.socket?.encrypted === true;
}

function requestIp(req) {
  const address = req.socket.remoteAddress || "";
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

function setCookieHeaders(...cookies) {
  return { "Set-Cookie": cookies.filter(Boolean) };
}
function requireBody(body, keys) {
  for (const key of keys) {
    if (body[key] === undefined || body[key] === "") {
      throw httpError(400, "MISSING_FIELD", `${key} 값이 필요합니다.`);
    }
  }
}

function decodeArtistSlug(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw httpError(400, "INVALID_ARTIST_SLUG", "아티스트 식별자를 확인해주세요.");
  }
}

function decodeEventId(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw httpError(400, "INVALID_EVENT_ID", "공연 식별자를 확인해주세요.");
  }
}

function requireDemoUserAPI() {
  const enabled = process.env.TIG_DEMO_PROFILE_API === "1"
    || (process.env.NODE_ENV !== "production" && process.env.TIG_NEXT_DEV === "1");
  if (!enabled) throw httpError(404, "NOT_FOUND", "요청한 API가 없습니다.");
}

function requireDemoSupportAPI() {
  const enabled = process.env.TIG_DEMO_SUPPORT_API === "1"
    || (process.env.NODE_ENV !== "production" && process.env.TIG_NEXT_DEV === "1");
  if (!enabled) throw httpError(404, "NOT_FOUND", "요청한 API가 없습니다.");
}

function requireDemoWatchlistAPI() {
  const enabled = process.env.TIG_DEMO_WATCHLIST_API === "1"
    || (process.env.NODE_ENV !== "production" && process.env.TIG_NEXT_DEV === "1");
  if (!enabled) throw httpError(404, "NOT_FOUND", "요청한 API가 없습니다.");
}

function parseIdempotencyKey(req) {
  const value = String(req.headers["x-idempotency-key"] || "").trim();
  if (!value) return null;
  if (value.length > 200) {
    throw httpError(400, "IDEMPOTENCY_KEY_REQUIRED", "유효한 재시도 키가 필요합니다.");
  }
  return value;
}

function requireIdempotencyKey(req) {
  const value = parseIdempotencyKey(req);
  if (!value) throw httpError(400, "IDEMPOTENCY_KEY_REQUIRED", "유효한 재시도 키가 필요합니다.");
  return value;
}

// 로그인 세션이 있으면 그 세션의 사용자로만 동작하고 클라이언트가 보낸
// id 필드는 무시한다. 세션이 아예 없을 때만(비로그인 데모) 그 필드를
// 그대로 신뢰한다 — 로그인한 사용자를 다른 사용자로 사칭하는 걸 막기 위함.
function resolveActorId(db, req, fallbackId) {
  const session = optionalAuthenticateNativeSession(db, req);
  return session ? session.user.id : fallbackId;
}

function resolvePurchaseUserId(db, req, body) {
  return resolveActorId(db, req, body.userId);
}

async function parseBody(req, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      throw httpError(413, "REQUEST_TOO_LARGE", "요청 본문이 너무 큽니다.");
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return { raw: "", parsed: {} };
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return { raw, parsed: JSON.parse(raw) };
  } catch {
    throw httpError(400, "BAD_JSON", "JSON 본문을 확인해주세요.");
  }
}

async function handleApi(req, res, db, surface) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  // The seller-application submission carries two independently-allowed
  // 5MB files (business registration doc + poster) as base64, which
  // inflates ~4/3x past the default cap - give that one route more room.
  // The seller dashboard's own event create/update carries one 5MB poster,
  // same reasoning.
  const largeBodyRoutes = new Set(["/api/seller-applications", "/api/seller/events/create", "/api/seller/events/update"]);
  const maxBodyBytes = largeBodyRoutes.has(url.pathname) ? 16 * 1024 * 1024 : 8 * 1024 * 1024;
  const { raw: rawBody, parsed: body } = ["POST", "PUT", "PATCH"].includes(req.method) ? await parseBody(req, maxBodyBytes) : { raw: "", parsed: {} };
  const sellerSessionResult = sellerSession(db, req);
  const seatMapMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/seat-map$/);
  const userSessionMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/session$/);
  const userProfileMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/profile$/);
  const userIdentityMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/identity$/);
  const userTicketsMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/tickets$/);
  const userWatchlistMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/watchlist$/);
  const principalWatchlistMatch = url.pathname.match(/^\/api\/me\/watchlist\/([^/]+)$/);
  const queueEntryMatch = url.pathname.match(/^\/api\/me\/queue-entries\/([^/]+)$/);
  const seatHoldMatch = url.pathname.match(/^\/api\/me\/seat-holds\/([^/]+)$/);
  const seatHoldExtendMatch = url.pathname.match(/^\/api\/me\/seat-holds\/([^/]+)\/extend$/);
  const reservationDraftMatch = url.pathname.match(/^\/api\/me\/reservation-drafts\/([^/]+)$/);
  const artistDiscoveryMatch = url.pathname.match(/^\/api\/discovery\/v1\/artists\/([^/]+)$/);
  const adminWorkspaceMatch = url.pathname.match(/^\/api\/admin\/workspaces\/([^/]+)$/);
  const adminOnly = url.pathname.startsWith("/api/admin/") || url.pathname === "/api/admin/summary" || url.pathname.startsWith("/api/ledger");

  if (adminOnly && surface !== "admin") {
    throw httpError(404, "NOT_FOUND", "요청한 API가 없습니다.");
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    return { status: "UP", version: "78b3c7c", capabilities: ["native-account-v1", "native-support-v1", "native-watchlist-v1", "native-booking-holds-v1"] };
  }
  if (req.method === "GET" && url.pathname === "/api/support/public") return publicSupportContent();
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
  if (req.method === "GET" && artistDiscoveryMatch) {
    return publicArtist(db, decodeArtistSlug(artistDiscoveryMatch[1]));
  }
  if (req.method === "GET" && url.pathname === "/api/discovery/v1/open-calendar") {
    return publicOpenCalendar(db);
  }
  if (req.method === "GET" && (url.pathname === "/api/me" || url.pathname === "/api/me/profile")) {
    return publicSessionUser(authenticateNativeSession(db, req).user);
  }
  if (req.method === "GET" && url.pathname === "/api/me/tickets") {
    return accountTicketsForUser(db, authenticateNativeSession(db, req).user.id);
  }
  if (req.method === "GET" && url.pathname === "/api/me/watchlist") {
    return userWatchlistForPrincipal(db, authenticateNativeSession(db, req).user.id);
  }
  if (req.method === "PUT" && principalWatchlistMatch) {
    return upsertWatchlistForPrincipal(
      db,
      authenticateNativeSession(db, req).user.id,
      decodeEventId(principalWatchlistMatch[1]),
      body
    );
  }
  if (req.method === "DELETE" && principalWatchlistMatch) {
    return removeWatchlistForPrincipal(
      db,
      authenticateNativeSession(db, req).user.id,
      decodeEventId(principalWatchlistMatch[1])
    );
  }
  if (req.method === "POST" && url.pathname === "/api/me/queue-entries") {
    requireBody(body, ["performanceDateId"]);
    return enterQueue(db, {
      userId: authenticateNativeSession(db, req).user.id,
      performanceDateId: body.performanceDateId
    });
  }
  if (req.method === "GET" && queueEntryMatch) {
    return getQueueEntry(db, {
      userId: authenticateNativeSession(db, req).user.id,
      entryId: queueEntryMatch[1]
    });
  }
  if (req.method === "DELETE" && queueEntryMatch) {
    return leaveQueue(db, {
      userId: authenticateNativeSession(db, req).user.id,
      entryId: queueEntryMatch[1]
    });
  }
  if (req.method === "POST" && url.pathname === "/api/me/seat-holds") {
    requireBody(body, ["performanceDateId", "ticketIds"]);
    return createSeatHold(db, {
      userId: authenticateNativeSession(db, req).user.id,
      performanceDateId: body.performanceDateId,
      ticketIds: body.ticketIds,
      idempotencyKey: requireIdempotencyKey(req)
    });
  }
  if (req.method === "GET" && seatHoldMatch && !seatHoldExtendMatch) {
    return getSeatHold(db, {
      userId: authenticateNativeSession(db, req).user.id,
      holdId: seatHoldMatch[1]
    });
  }
  if (req.method === "PATCH" && seatHoldExtendMatch) {
    return extendSeatHold(db, {
      userId: authenticateNativeSession(db, req).user.id,
      holdId: seatHoldExtendMatch[1]
    });
  }
  if (req.method === "DELETE" && seatHoldMatch) {
    return releaseSeatHold(db, {
      userId: authenticateNativeSession(db, req).user.id,
      holdId: seatHoldMatch[1]
    });
  }
  if (req.method === "POST" && url.pathname === "/api/me/reservation-drafts") {
    requireBody(body, ["holdId"]);
    return createReservationDraft(db, {
      userId: authenticateNativeSession(db, req).user.id,
      holdId: body.holdId,
      idempotencyKey: requireIdempotencyKey(req)
    });
  }
  if (req.method === "GET" && reservationDraftMatch) {
    return getReservationDraft(db, {
      userId: authenticateNativeSession(db, req).user.id,
      draftId: reservationDraftMatch[1]
    });
  }
  if (req.method === "DELETE" && reservationDraftMatch) {
    return cancelReservationDraft(db, {
      userId: authenticateNativeSession(db, req).user.id,
      draftId: reservationDraftMatch[1]
    });
  }
  if (req.method === "PATCH" && url.pathname === "/api/me/profile") {
    requireBody(body, ["name"]);
    return updateDemoProfile(db, {
      userId: authenticateNativeSession(db, req).user.id,
      name: body.name
    });
  }
  if (req.method === "GET" && url.pathname === "/api/me/support/threads") {
    return supportThreadsForPrincipal(db, authenticateNativeSession(db, req).user.id);
  }
  if (req.method === "POST" && url.pathname === "/api/me/support/threads") {
    requireBody(body, ["message"]);
    return createSupportThreadForPrincipal(
      db,
      authenticateNativeSession(db, req).user.id,
      body,
      requireIdempotencyKey(req)
    );
  }
  if (req.method === "POST" && url.pathname === "/api/me/support/messages") {
    requireBody(body, ["threadId", "message"]);
    return addSupportMessageForPrincipal(
      db,
      authenticateNativeSession(db, req).user.id,
      body,
      requireIdempotencyKey(req)
    );
  }
  if (req.method === "GET" && url.pathname === "/api/payments/bootpay/config") return bootpayConfig();
  if (req.method === "GET" && url.pathname === "/api/payments/tosspayments/config") return tosspaymentsConfig();
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
  const groupBookingFileMatch = url.pathname.match(/^\/api\/admin\/group-booking\/requests\/([^/]+)\/business-registration-file$/);
  if (req.method === "GET" && groupBookingFileMatch) {
    const file = await readBusinessRegistrationFile(db, decodeURIComponent(groupBookingFileMatch[1]));
    return {
      rawBody: file.buffer,
      responseHeaders: {
        "Content-Disposition": `inline; filename="${file.fileName}"`,
        "Content-Type": file.mimeType
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
      sourceApplicationId: url.searchParams.get("sourceApplicationId") || undefined,
      to: url.searchParams.get("to") || undefined,
      zoneId: url.searchParams.get("zoneId") || undefined,
      limit: url.searchParams.get("limit") || undefined,
      page: url.searchParams.get("page") || undefined
    });
  }
  if (req.method === "GET" && userSessionMatch) {
    requireDemoUserAPI();
    return demoSession(db, decodeURIComponent(userSessionMatch[1]));
  }
  if (req.method === "GET" && userIdentityMatch) {
    const requestedUserId = decodeURIComponent(userIdentityMatch[1]);
    const sessionUserId = authenticateNativeSession(db, req).user.id;
    if (sessionUserId !== requestedUserId) {
      throw httpError(403, "NOT_OWNER", "본인의 본인인증 상태만 조회할 수 있습니다.");
    }
    return publicIdentityStatus(db, requestedUserId);
  }
  if (req.method === "GET" && userTicketsMatch) {
    requireDemoUserAPI();
    return publicTicketsForUser(db, decodeURIComponent(userTicketsMatch[1]));
  }
  if (req.method === "GET" && userWatchlistMatch) {
    requireDemoWatchlistAPI();
    return userWatchlist(db, decodeURIComponent(userWatchlistMatch[1]));
  }
  if (req.method === "GET" && url.pathname === "/api/support/threads") {
    requireDemoSupportAPI();
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
    requireDemoSupportAPI();
    requireBody(body, ["userId", "message"]);
    return createSupportThread(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/support/messages") {
    requireDemoSupportAPI();
    requireBody(body, ["threadId", "actorId", "message"]);
    return addSupportMessage(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/seller-applications") {
    return submitSellerApplication(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/seller/login") {
    const loginAttempt = recordSellerLoginAttempt(requestIp(req));
    if (loginAttempt.limited) {
      throw httpError(429, "RATE_LIMITED", "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.", { retryAfterSeconds: loginAttempt.retryAfterSeconds });
    }
    requireBody(body, ["username", "password"]);
    const account = authenticateSellerAccount(db, body.username, body.password);
    if (!account) throw httpError(401, "SELLER_LOGIN_FAILED", "아이디 또는 비밀번호가 일치하지 않습니다.");
    const { token, csrf } = createSellerSessionToken({ hmac, currentTimeMs, sellerId: account.id });
    return {
      responseHeaders: setCookieHeaders(sellerSessionCookie(token, isSecureRequest(req) || !isDev)),
      responseBody: { ...sellerAccountDto(account), csrf }
    };
  }
  if (req.method === "POST" && url.pathname === "/api/seller/logout") {
    return {
      responseHeaders: setCookieHeaders(clearSellerSessionCookie(isSecureRequest(req) || !isDev)),
      responseBody: { loggedOut: true }
    };
  }
  if (req.method === "GET" && url.pathname === "/api/seller/session") {
    requireSellerSession(sellerSessionResult, req, httpError);
    return { ...sellerAccountDto(sellerSessionResult.account), csrf: sellerSessionResult.csrf };
  }
  if (req.method === "POST" && url.pathname === "/api/seller/change-password") {
    const session = requireSellerSession(sellerSessionResult, req, httpError);
    requireBody(body, ["currentPassword", "nextPassword"]);
    return changeSellerPassword(db, {
      sellerId: session.account.id,
      currentPassword: body.currentPassword,
      nextPassword: body.nextPassword
    });
  }
  if (req.method === "GET" && url.pathname === "/api/seller/events") {
    const session = requireSellerSession(sellerSessionResult, req, httpError);
    return listSellerEvents(db, session.account.id);
  }
  if (req.method === "POST" && url.pathname === "/api/seller/events/create") {
    const session = requireSellerSession(sellerSessionResult, req, httpError);
    requireBody(body, ["title", "category", "startsAt", "venueId", "imageDataUrl"]);
    return createSellerEvent(db, body, session.account);
  }
  if (req.method === "POST" && url.pathname === "/api/seller/events/update") {
    const session = requireSellerSession(sellerSessionResult, req, httpError);
    requireBody(body, ["eventId", "title", "category", "startsAt", "venueId"]);
    return updateSellerEvent(db, body, session.account);
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
  if (req.method === "POST" && url.pathname === "/api/identity/portone-danal/start") {
    requireBody(body, ["userId", "phone"]);
    return startPortOneDanalVerification(db, { ...body, userId: resolvePurchaseUserId(db, req, body) });
  }
  if (req.method === "POST" && url.pathname === "/api/identity/portone-danal/confirm") {
    requireBody(body, ["userId", "phone", "identityVerificationId"]);
    return confirmPortOneDanalVerification(db, { ...body, userId: resolvePurchaseUserId(db, req, body) });
  }
  if (req.method === "POST" && url.pathname === "/api/watchlist") {
    requireDemoWatchlistAPI();
    requireBody(body, ["userId", "eventId"]);
    return upsertWatchlist(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/watchlist/notify") {
    requireDemoWatchlistAPI();
    return notifyWatchlist(db, body);
  }
  if (req.method === "POST" && userProfileMatch) {
    requireDemoUserAPI();
    requireBody(body, ["name"]);
    return updateDemoProfile(db, {
      userId: decodeURIComponent(userProfileMatch[1]),
      name: body.name
    });
  }

  if (req.method === "POST" && url.pathname === "/api/tickets/buy") {
    requireBody(body, ["userId", "ticketId"]);
    return publicPurchaseResult(buyPrimary(db, {
      ...body,
      userId: resolvePurchaseUserId(db, req, body),
      idempotencyKey: parseIdempotencyKey(req)
    }));
  }
  if (req.method === "POST" && url.pathname === "/api/payments/bootpay/purchase") {
    requireBody(body, ["userId", "ticketId", "paymentMethod"]);
    const purchaseUserId = resolvePurchaseUserId(db, req, body);
    const purchasable = assertTicketPurchasable(db, body.ticketId);
    const receipt = await confirmBootpayPayment(db, {
      ticketId: body.ticketId,
      userId: purchaseUserId,
      paymentKey: String(body.paymentMethod || "").toUpperCase(),
      receiptId: body.receiptId,
      expectedAmount: purchasable.ticket.faceValue
    });
    let result;
    try {
      result = buyPrimary(db, {
        userId: purchaseUserId,
        ticketId: body.ticketId,
        paymentMethod: body.paymentMethod,
        pgTransactionId: receipt.receiptId
      });
    } catch (error) {
      appendLedger(db, purchaseUserId, "BOOTPAY_PAYMENT_NEEDS_REFUND", {
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
  if (req.method === "POST" && url.pathname === "/api/payments/tosspayments/purchase") {
    requireBody(body, ["userId", "ticketId", "paymentMethod", "tossPaymentKey"]);
    const idempotencyKey = requireIdempotencyKey(req);
    const purchaseUserId = resolvePurchaseUserId(db, req, body);

    // A retry with the same idempotency key must not re-confirm payment with
    // TossPayments: that would cost a second API call for nothing, and would
    // fail outright once the ticket is already OWNED from the first attempt.
    const replay = findIdempotentPurchase(db, purchaseUserId, idempotencyKey, {
      ticketId: body.ticketId,
      paymentMethod: body.paymentMethod
    });
    if (replay) {
      const replayedResult = buyPrimary(db, {
        userId: purchaseUserId,
        ticketId: body.ticketId,
        paymentMethod: body.paymentMethod,
        idempotencyKey
      });
      return { ...publicPurchaseResult(replayedResult), tosspayments: { tossPaymentKey: replay.pgTransactionId, replayed: true } };
    }

    const purchasable = assertTicketPurchasable(db, body.ticketId);
    const receipt = await confirmTosspaymentsPayment(db, {
      ticketId: body.ticketId,
      userId: purchaseUserId,
      paymentKey: String(body.paymentMethod || "").toUpperCase(),
      tossPaymentKey: body.tossPaymentKey,
      orderId: body.ticketId,
      // The TossPayments widget always charges faceValue + one seat's
      // service fee (checkout-panel.tsx trustedTotalAmount) - the server
      // must expect that same total, not faceValue alone, or every real
      // (non-mock) purchase fails TOSSPAYMENTS_AMOUNT_MISMATCH.
      expectedAmount: purchasable.ticket.faceValue + SERVICE_FEE_PER_SEAT
    });
    let result;
    try {
      result = buyPrimary(db, {
        userId: purchaseUserId,
        ticketId: body.ticketId,
        paymentMethod: body.paymentMethod,
        pgTransactionId: receipt.tossPaymentKey,
        idempotencyKey
      });
    } catch (error) {
      appendLedger(db, purchaseUserId, "TOSSPAYMENTS_PAYMENT_NEEDS_REFUND", {
        ticketId: body.ticketId,
        tossPaymentKey: receipt.tossPaymentKey,
        amount: purchasable.ticket.faceValue,
        reason: error.code || "ALLOCATION_FAILED"
      });
      throw httpError(409, "PAYMENT_CAPTURED_ALLOCATION_FAILED", "결제는 완료되었으나 좌석 배정에 실패했습니다. 고객센터로 문의해주세요.", {
        ticketId: body.ticketId,
        tossPaymentKey: receipt.tossPaymentKey,
        reason: error.code || "ALLOCATION_FAILED"
      });
    }
    return { ...publicPurchaseResult(result), tosspayments: receipt };
  }
  if (req.method === "POST" && url.pathname === "/api/admin/payments/tosspayments/cancel") {
    requireBody(body, ["tossPaymentKey", "cancelReason"]);
    const transaction = db.paymentTransactions.find((item) => item.pgTransactionId === body.tossPaymentKey);
    if (!transaction) {
      throw httpError(404, "TOSSPAYMENTS_TRANSACTION_NOT_FOUND", "결제 내역을 찾을 수 없습니다.");
    }
    // Payment-side refund only - this intentionally does not touch ticket
    // ownership/status/inventory. Whether (and how) a refunded ticket should
    // be released back to inventory is an undecided product policy question,
    // not something to guess at here; an admin can already reach
    // updateTicketStatus separately if they need to release the seat.
    const result = await cancelTosspaymentsPayment({
      tossPaymentKey: body.tossPaymentKey,
      cancelReason: body.cancelReason,
      cancelAmount: body.cancelAmount,
      refundReceiveAccount: body.refundReceiveAccount,
      taxFreeAmount: body.taxFreeAmount
    });
    appendLedger(db, req.admin.id, "TOSSPAYMENTS_ADMIN_CANCEL", {
      tossPaymentKey: body.tossPaymentKey,
      ticketId: transaction.ticketId,
      userId: transaction.userId,
      cancelReason: body.cancelReason,
      cancelAmount: body.cancelAmount ?? transaction.amount,
      mock: result.mock === true
    });
    return { tossPaymentKey: body.tossPaymentKey, status: result.status, cancels: result.cancels, mock: result.mock };
  }
  if (req.method === "POST" && url.pathname === "/api/webhooks/tosspayments") {
    // Toss can't send a session/Bearer credential, so this route is
    // intentionally unauthenticated. That's exactly why it must never be
    // trusted the way an authenticated route is: PAYMENT_STATUS_CHANGED (the
    // event actually relevant to reconciliation) carries no signature at all
    // per TossPayments' own docs - only payout.changed/seller.changed do,
    // neither of which this integration uses. This handler only ever writes
    // a reconciliation ledger entry; it must never call buyPrimary or mutate
    // ticket/payment state, signed or not.
    const signatureHeader = req.headers["tosspayments-webhook-signature"];
    const transmissionTime = req.headers["tosspayments-webhook-transmission-time"];
    const signed = typeof signatureHeader === "string"
      ? isWebhookSignatureValid(signatureHeader, { payload: rawBody, transmissionTime })
      : false;
    if (typeof signatureHeader === "string" && !signed) {
      // A signature was present but did not verify - unlike the "no
      // signature at all" case (expected for PAYMENT_STATUS_CHANGED), this
      // is someone presenting a signature that doesn't check out, so it's
      // rejected outright rather than merely logged as unverified.
      throw httpError(401, "TOSSPAYMENTS_WEBHOOK_SIGNATURE_INVALID", "웹훅 서명을 확인할 수 없습니다.");
    }
    const eventType = typeof body.eventType === "string" ? body.eventType : "UNKNOWN";
    const tossPaymentKey = body.data?.paymentKey;
    const transaction = typeof tossPaymentKey === "string"
      ? db.paymentTransactions.find((item) => item.pgTransactionId === tossPaymentKey)
      : undefined;
    appendLedger(db, "TOSSPAYMENTS_WEBHOOK", "TOSSPAYMENTS_WEBHOOK_RECEIVED", {
      eventType,
      tossPaymentKey: tossPaymentKey ?? null,
      status: body.data?.status ?? null,
      signed,
      matchedTicketId: transaction?.ticketId ?? null
    });
    return { received: true };
  }
  if (req.method === "POST" && url.pathname === "/api/resale/list") {
    requireBody(body, ["sellerId", "ticketId", "price"]);
    return publicResalePool(listForResale(db, { ...body, sellerId: resolveActorId(db, req, body.sellerId) }));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/join") {
    requireBody(body, ["buyerId", "poolId"]);
    return publicResalePool(joinPool(db, { ...body, buyerId: resolveActorId(db, req, body.buyerId) }));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/cancel") {
    requireBody(body, ["sellerId", "poolId"]);
    return publicResalePool(cancelResaleListing(db, { ...body, sellerId: resolveActorId(db, req, body.sellerId) }));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/draw") {
    requireBody(body, ["poolId"]);
    return publicResaleDrawResult(drawPool(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/purchase") {
    requireBody(body, ["buyerId", "poolId"]);
    return publicResaleDrawResult(purchaseResale(db, { ...body, buyerId: resolveActorId(db, req, body.buyerId) }));
  }
  if (req.method === "POST" && url.pathname === "/api/security/direct-transfer-attempt") {
    requireBody(body, ["actorId", "ticketId", "targetUserId"]);
    return publicDirectTransferResult(directTransferAttempt(db, { ...body, actorId: resolveActorId(db, req, body.actorId) }));
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
  const sellerApplicationActionMatch = url.pathname.match(/^\/api\/admin\/seller-applications\/([^/]+)\/(checklist|approve|reject)$/);
  if (req.method === "POST" && sellerApplicationActionMatch) {
    const applicationId = decodeURIComponent(sellerApplicationActionMatch[1]);
    const action = sellerApplicationActionMatch[2];
    if (action === "checklist") {
      const checklistPayload = { applicationId };
      for (const key of ["bizNumberVerified", "contactPhoneVerified", "eventAuthenticityChecked"]) {
        if (Object.hasOwn(body, key)) checklistPayload[key] = body[key];
      }
      return updateSellerApplicationChecklist(db, checklistPayload, req.admin);
    }
    if (action === "approve") {
      return approveSellerApplication(db, { applicationId, reviewNote: body.reviewNote }, req.admin);
    }
    return rejectSellerApplication(db, { applicationId, reviewNote: body.reviewNote }, req.admin);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/seller-accounts/issue") {
    requireBody(body, ["applicationId", "username"]);
    return issueSellerAccount(db, body, req.admin);
  }
  const sellerEventReviewMatch = url.pathname.match(/^\/api\/admin\/seller-events\/([^/]+)\/(publish|reject)$/);
  if (req.method === "POST" && sellerEventReviewMatch) {
    const eventId = decodeURIComponent(sellerEventReviewMatch[1]);
    const action = sellerEventReviewMatch[2];
    return reviewSellerEvent(db, { eventId, action, reviewNote: body.reviewNote }, req.admin);
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
