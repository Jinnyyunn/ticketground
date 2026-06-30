// Admin backend operations.
import { createAdminSeatMapBackend } from "./admin-seatmaps.js";

export function createAdminBackend({
  adminTicket,
  appendLedger,
  ensureTicketsForEvent,
  httpError,
  id,
  money,
  now,
  seatLayoutForVenue,
  stableId,
  verifyLedger
}) {
  const {
    adminVenueRecord,
    resolveVenue,
    seatMap,
    venueMapForEvent
  } = createAdminSeatMapBackend({
    httpError,
    seatLayoutForVenue
  });

function updateEventVenue(db, { eventId, venueId }) {
  const event = db.events.find((item) => item.id === eventId);
  if (!event) throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
  const venue = resolveVenue(db, venueId);
  if (!venue) throw httpError(404, "VENUE_NOT_FOUND", "공연장을 찾을 수 없습니다.");
  event.venueId = venue.id;
  event.venue = venue.name;
  ensureTicketsForEvent(db, event);
  appendLedger(db, "ADMIN", "EVENT_VENUE_UPDATED", {
    eventId: event.id,
    venueId: venue.id,
    venue: venue.name,
    mapType: venue.map.type
  });
  return { event, venue, seatMap: venueMapForEvent(db, event.id) };
}

function updateEventSale(db, { eventId, title, category, startsAt, venueId, prices, saleState, saleNote, discountRate }) {
  const event = db.events.find((item) => item.id === eventId);
  if (!event) throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
  const venue = resolveVenue(db, venueId || event.venueId);
  const allowedCategories = ["concert", "festival", "musical", "sports"];
  const allowedSaleStates = ["ON_SALE", "OPEN_SOON", "DISCOUNT_SOON", "ADMIN_HOLD"];
  const nextCategory = String(category || event.category || "concert");
  if (!allowedCategories.includes(nextCategory)) {
    throw httpError(422, "INVALID_EVENT_CATEGORY", "지원하지 않는 행사 유형입니다.");
  }
  const nextSaleState = String(saleState || event.saleState || "ON_SALE");
  if (!allowedSaleStates.includes(nextSaleState)) {
    throw httpError(422, "INVALID_SALE_STATE", "지원하지 않는 판매 상태입니다.");
  }
  const cleanTitle = String(title || "").trim();
  if (!cleanTitle) throw httpError(400, "MISSING_FIELD", "행사명을 입력해주세요.");
  const parsedDate = Date.parse(startsAt);
  if (!startsAt || Number.isNaN(parsedDate)) {
    throw httpError(422, "INVALID_EVENT_DATE", "개최 날짜와 시간을 확인해주세요.");
  }

  const priceMap = prices && typeof prices === "object" ? prices : {};
  const updatedZones = event.zones.map((zone) => {
    const nextPrice = money(priceMap[zone.id] ?? zone.faceValue);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      throw httpError(422, "INVALID_ZONE_PRICE", `${zone.name} 가격을 확인해주세요.`);
    }
    return { ...zone, faceValue: nextPrice };
  });

  event.title = cleanTitle;
  event.category = nextCategory;
  event.saleState = nextSaleState;
  event.saleNote = String(saleNote || "").trim().slice(0, 80);
  event.discountRate = Math.max(0, Math.min(90, Number(discountRate || 0)));
  event.venueId = venue.id;
  event.venue = venue.name;
  event.date = startsAt;
  event.dates ||= [];
  if (!event.dates.length) {
    event.dates.push({ id: stableId("perf", event.id, startsAt), startsAt, label: "1회차" });
  } else {
    event.dates[0].startsAt = startsAt;
    event.dates[0].label ||= "1회차";
  }
  event.zones = updatedZones;

  let repricedTickets = 0;
  for (const ticket of db.tickets) {
    if (ticket.eventId !== event.id) continue;
    if (ticket.ownerId || !["ON_SALE", "ADMIN_HOLD"].includes(ticket.status)) continue;
    const zone = event.zones.find((item) => item.id === ticket.zoneId);
    if (!zone) continue;
    ticket.faceValue = zone.faceValue;
    ticket.minPrice = Math.ceil(zone.faceValue * 0.5);
    ticket.maxPrice = Math.ceil(zone.faceValue * (1 + zone.resaleFeeRate));
    ticket.maxTransferCount = zone.maxTransferCount;
    repricedTickets += 1;
  }
  ensureTicketsForEvent(db, event);

  appendLedger(db, "ADMIN", "EVENT_SALE_UPDATED", {
    eventId: event.id,
    title: event.title,
    category: event.category,
    saleState: event.saleState,
    saleNote: event.saleNote,
    discountRate: event.discountRate,
    startsAt,
    venueId: venue.id,
    repricedTickets,
    prices: Object.fromEntries(event.zones.map((zone) => [zone.id, zone.faceValue]))
  });
  return { event, venue, repricedTickets, seatMap: venueMapForEvent(db, event.id) };
}

function adminVenues(db) {
  const event = db.events[0];
  return {
    venues: db.venues.map(adminVenueRecord),
    events: db.events,
    event
  };
}

function adminSummary(db) {
  const ledgerCheck = verifyLedger(db);
  const openPools = db.resalePools.filter((pool) => pool.status === "OPEN");
  const watchUsers = db.users.filter((user) => user.status === "WATCHLIST" || user.trustScore < 50);
  const openSupportThreads = db.supportThreads.filter((thread) => thread.status !== "CLOSED");
  return {
    stats: {
      totalTickets: db.tickets.length,
      onSaleTickets: db.tickets.filter((ticket) => ticket.status === "ON_SALE").length,
      ownedTickets: db.tickets.filter((ticket) => ticket.status === "OWNED").length,
      resalePools: openPools.length,
      supportOpen: openSupportThreads.length,
      watchUsers: watchUsers.length,
      watchlistEntries: db.watchlist.length,
      notificationJobs: db.notificationJobs.length,
      admissionCredentials: db.admissionCredentials.length,
      trustedDevices: db.trustedDevices.length,
      operatorAlerts: db.operatorAlerts.filter((alert) => alert.status !== "ACKED").length,
      ledgerEntries: db.ledger.length,
      ledgerVerified: ledgerCheck.ok
    },
    event: db.events[0],
    users: db.users,
    tickets: db.tickets.map(adminTicket),
    resalePools: db.resalePools,
    supportThreads: db.supportThreads,
    watchlist: db.watchlist,
    notificationJobs: db.notificationJobs,
    operatorAlerts: db.operatorAlerts,
    admissionCredentials: db.admissionCredentials,
    ledger: db.ledger.slice(-12).reverse(),
    ledgerCheck
  };
}

function updateUserStatus(db, { userId, status, reason }) {
  const allowed = ["ACTIVE", "WATCHLIST", "BANNED"];
  if (!allowed.includes(status)) {
    throw httpError(422, "INVALID_USER_STATUS", "지원하지 않는 계정 상태입니다.");
  }
  const user = db.users.find((item) => item.id === userId);
  if (!user) throw httpError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
  user.status = status;
  if (status === "WATCHLIST") user.trustScore = Math.min(user.trustScore, 39);
  if (status === "BANNED") user.trustScore = Math.min(user.trustScore, 10);
  user.sanctions.push({
    id: id("sanction"),
    reason: reason || `운영자 계정 상태 변경: ${status}`,
    penalty: `status-${status.toLowerCase()}`,
    at: now()
  });
  appendLedger(db, "ADMIN", "USER_STATUS_UPDATED", {
    userId: user.id,
    status,
    reason: reason || "operator-review"
  });
  return user;
}

function updateUserStatuses(db, { updates, reason }) {
  if (!Array.isArray(updates) || !updates.length) {
    throw httpError(400, "MISSING_FIELD", "수정할 계정 상태를 선택해주세요.");
  }
  return updates.map((item) => updateUserStatus(db, {
    userId: item.userId,
    status: item.status,
    reason: reason || "운영 콘솔 일괄 상태 변경"
  }));
}

function updateTicketStatus(db, { ticketId, status }) {
  const allowed = ["ON_SALE", "ADMIN_HOLD"];
  if (!allowed.includes(status)) {
    throw httpError(422, "INVALID_TICKET_STATUS", "지원하지 않는 티켓 상태입니다.");
  }
  const ticket = db.tickets.find((item) => item.id === ticketId);
  if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
  if (ticket.ownerId || !["ON_SALE", "ADMIN_HOLD"].includes(ticket.status)) {
    throw httpError(409, "TICKET_LOCKED", "소유자 또는 거래 상태가 있는 티켓은 재고 상태만 변경할 수 없습니다.");
  }
  ticket.status = status;
  appendLedger(db, "ADMIN", "TICKET_STATUS_UPDATED", {
    ticketId: ticket.id,
    status,
    policy: "operator-inventory-control"
  });
  return ticket;
}



  return {
    adminSummary,
    adminVenues,
    adminVenueRecord,
    resolveVenue,
    seatMap,
    updateEventSale,
    updateEventVenue,
    updateTicketStatus,
    updateUserStatus,
    updateUserStatuses,
    venueMapForEvent
  };
}
