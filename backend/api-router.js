export function createApiRouter({
  addSupportMessage,
  adminSummary,
  adminVenues,
  createSupportThread,
  directTransferAttempt,
  drawPool,
  httpError,
  issueQr,
  joinPool,
  listForResale,
  notifyWatchlist,
  publicDirectTransferResult,
  publicPurchaseResult,
  publicResaleDrawResult,
  publicResalePool,
  publicState,
  buyPrimary,
  seatMap,
  supportThreadForUser,
  trustDevice,
  updateEventSale,
  updateEventVenue,
  updateSupportStatus,
  updateTicketStatus,
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
  for await (const chunk of req) chunks.push(chunk);
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
  const userWatchlistMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/watchlist$/);
  const adminOnly = url.pathname.startsWith("/api/admin/") || url.pathname === "/api/admin/summary" || url.pathname === "/api/ledger";

  if (adminOnly && surface !== "admin") {
    throw httpError(404, "NOT_FOUND", "요청한 API가 없습니다.");
  }

  if (req.method === "GET" && url.pathname === "/api/state") return publicState(db);
  if (req.method === "GET" && url.pathname === "/api/ledger/verify") return verifyLedger(db);
  if (req.method === "GET" && url.pathname === "/api/ledger") return db.ledger.slice(-30).reverse();
  if (req.method === "GET" && url.pathname === "/api/admin/summary") return adminSummary(db);
  if (req.method === "GET" && url.pathname === "/api/admin/venues") return adminVenues(db);
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
  if (req.method === "POST" && url.pathname === "/api/watchlist") {
    requireBody(body, ["userId", "eventId"]);
    return upsertWatchlist(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/watchlist/notify") {
    return notifyWatchlist(db, body);
  }

  if (req.method === "POST" && url.pathname === "/api/tickets/buy") {
    requireBody(body, ["userId", "ticketId"]);
    return publicPurchaseResult(buyPrimary(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/list") {
    requireBody(body, ["sellerId", "ticketId", "price"]);
    return publicResalePool(listForResale(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/join") {
    requireBody(body, ["buyerId", "poolId"]);
    return publicResalePool(joinPool(db, body));
  }
  if (req.method === "POST" && url.pathname === "/api/resale/draw") {
    requireBody(body, ["poolId"]);
    return publicResaleDrawResult(drawPool(db, body));
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
    requireBody(body, ["eventId", "title", "category", "startsAt", "venueId", "prices"]);
    return updateEventSale(db, body);
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
