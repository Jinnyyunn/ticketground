// Admin backend operations.
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { adminDto, isAdminIpAllowed, normalizeAdminIpAllowlist, roleCatalog } from "./admin-acl.js";
import { createAdminEventContentBackend } from "./admin-event-content.js";
import { createAdminSeatMapBackend } from "./admin-seatmaps.js";

export function createAdminBackend({
  adminTicket,
  appendLedger,
  clone,
  ensureTicketsForEvent,
  httpError,
  id,
  listGroupBookingRequests,
  mediaDir,
  money,
  now,
  seatLayoutForVenue,
  stableId,
  verifyLedger
}) {
  const {
    assertInventorySize,
    normalizeAdminEventInput,
    normalizeCreateEventContent,
    normalizeUpdateEventContent
  } = createAdminEventContentBackend({
    httpError,
    money,
    stableId
  });

  const {
    adminVenueRecord,
    resolveVenue,
    seatMap,
    venueMapForEvent
  } = createAdminSeatMapBackend({
    httpError,
    seatLayoutForVenue
  });

function imageExtension(buffer, mimeType) {
  if (mimeType === "image/png" && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (mimeType === "image/jpeg" && buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "jpg";
  if (mimeType === "image/webp" && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

async function storeEventImage(imageDataUrl) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(imageDataUrl || ""));
  if (!match) throw httpError(422, "INVALID_EVENT_IMAGE", "PNG, JPEG, WebP 포스터 파일만 등록할 수 있습니다.");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    throw httpError(422, "INVALID_EVENT_IMAGE", "포스터 파일은 5MB 이하로 등록해주세요.");
  }
  const extension = imageExtension(buffer, match[1]);
  if (!extension || !mediaDir?.directory || !mediaDir?.urlPrefix) {
    throw httpError(422, "INVALID_EVENT_IMAGE", "포스터 파일 형식을 확인해주세요.");
  }
  await mkdir(mediaDir.directory, { recursive: true });
  const fileName = `event-${id("poster")}.${extension}`;
  await writeFile(path.join(mediaDir.directory, fileName), buffer, { flag: "wx" });
  return `${mediaDir.urlPrefix}/${fileName}`;
}

function passwordRecord(password) {
  const value = String(password || "");
  if (value.length < 12) throw httpError(422, "WEAK_ADMIN_PASSWORD", "관리자 비밀번호는 12자 이상이어야 합니다.");
  const passwordSalt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto.scryptSync(value, passwordSalt, 64).toString("hex");
  return { passwordHash, passwordSalt };
}

function passwordMatches(account, password) {
  if (!account.passwordHash || !account.passwordSalt) return false;
  const expected = Buffer.from(account.passwordHash, "hex");
  const actual = Buffer.from(crypto.scryptSync(String(password || ""), account.passwordSalt, 64).toString("hex"), "hex");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function normalizeRoleKeys(roleKeys) {
  const values = Array.isArray(roleKeys) ? [...new Set(roleKeys.map((item) => String(item || "").trim()).filter(Boolean))] : [];
  if (!values.length || values.some((key) => !roleCatalog.some((role) => role.key === key))) {
    throw httpError(422, "INVALID_ADMIN_ROLE", "관리자 역할을 하나 이상 선택해주세요.");
  }
  return values;
}

function adminAccountDto(account) {
  return {
    ...adminDto(account),
    bootstrap: account.bootstrap === true,
    roleKeys: normalizeRoleKeys(account.roleKeys),
    active: account.active !== false,
    ipAllowlist: normalizeAdminIpAllowlist(account.ipAllowlist)
  };
}

function eventTicketCounts(db, eventId) {
  const tickets = db.tickets.filter((ticket) => ticket.eventId === eventId);
  return {
    ticketCount: tickets.length,
    soldCount: tickets.filter((ticket) => ticket.status !== "ON_SALE").length
  };
}

function eventPickerSummary(db, event) {
  const counts = eventTicketCounts(db, event.id);
  return {
    id: event.id,
    title: event.title,
    category: event.category,
    saleState: event.saleState,
    venue: event.venue,
    date: event.date,
    dates: event.dates,
    ticketCount: counts.ticketCount,
    soldCount: counts.soldCount
  };
}

function normalizePageOptions(options) {
  const page = Math.max(1, Number.parseInt(String(options.page || "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(options.limit || "50"), 10) || 50));
  return { page, limit };
}

function withinDateRange(value, { from, to }) {
  if (!from && !to) return true;
  if (!value) return false;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  const fromTime = from ? Date.parse(from) : null;
  const toTime = to ? Date.parse(to) : null;
  return (fromTime === null || time >= fromTime) && (toTime === null || time <= toTime);
}

function pageSlice(items, options) {
  const { page, limit } = normalizePageOptions(options);
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    page: {
      page,
      limit,
      total: items.length,
      hasNext: start + limit < items.length,
      hasPrevious: page > 1
    }
  };
}

function ticketEventMaps(db) {
  const eventsById = new Map(db.events.map((event) => [event.id, event]));
  const ticketsById = new Map(db.tickets.map((ticket) => [ticket.id, ticket]));
  return { eventsById, ticketsById };
}

function paymentTransactionDto(transaction, maps) {
  const ticket = maps.ticketsById.get(transaction.ticketId ?? transaction.ticketIds?.[0]);
  const event = ticket ? maps.eventsById.get(ticket.eventId) : null;
  return {
    ...transaction,
    eventId: event?.id || null,
    eventTitle: event?.title || null,
    seatLabel: transaction.ticketIds?.length > 1 ? `${ticket?.seatLabel || ""} 외 ${transaction.ticketIds.length - 1}건`.trim() : ticket?.seatLabel || null,
    platformFee: transaction.platformFee || 0,
    transferAmount: transaction.transferAmount || 0
  };
}

function supportMessageDto(message) {
  return {
    id: message.id,
    actorId: message.actorId,
    role: message.role || "CUSTOMER",
    body: message.body || message.message || "",
    at: message.at || null
  };
}

function supportThreadDto(thread) {
  const messages = (thread.messages || []).map(supportMessageDto);
  const lastMessage = messages.at(-1);
  return {
    ...clone(thread),
    category: thread.category || "GENERAL",
    priority: thread.priority || (thread.category === "URGENT" ? "URGENT" : "NORMAL"),
    relatedTicketId: thread.relatedTicketId || thread.ticketId || null,
    relatedBookingId: thread.relatedBookingId || thread.bookingId || null,
    messageCount: messages.length,
    lastMessagePreview: lastMessage?.body.slice(0, 120) || "",
    messages
  };
}

function filteredSupportThreads(db, options) {
  const status = options.status ? String(options.status).toUpperCase() : null;
  const category = options.category ? String(options.category).toUpperCase() : null;
  return db.supportThreads
    .map(supportThreadDto)
    .filter((thread) => (!status || thread.status === status) && (!category || thread.category === category))
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0));
}

function adminUserDto(user) {
  return {
    id: user.id,
    name: user.name,
    status: user.status,
    trustScore: user.trustScore,
    sanctions: clone(user.sanctions || [])
  };
}

function filteredAdminUsers(db, options) {
  const search = String(options.search || "").trim().toLowerCase();
  return db.users
    .filter((user) => !search || user.id.toLowerCase().includes(search) || String(user.name || "").toLowerCase().includes(search))
    .map(adminUserDto);
}

function admissionCredentialDto(credential) {
  return {
    ...clone(credential),
    adminHold: credential.adminHold === true,
    adminHoldReason: credential.adminHoldReason || null,
    adminHoldUpdatedAt: credential.adminHoldUpdatedAt || null
  };
}

function qrIssueLogDto(log) {
  return {
    ...clone(log),
    credentialId: log.credentialId || log.admissionCredentialId || null
  };
}

function filteredPaymentTransactions(db, options) {
  const maps = ticketEventMaps(db);
  return db.paymentTransactions
    .map((transaction) => paymentTransactionDto(transaction, maps))
    .filter((transaction) => (
      (!options.eventId || transaction.eventId === options.eventId)
      && (!options.method || transaction.method === options.method)
      && (!options.status || transaction.status === options.status)
      && withinDateRange(transaction.createdAt, { from: options.from, to: options.to })
    ))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

function paymentSummary(transactions) {
  return transactions.reduce((summary, transaction) => ({
    count: summary.count + 1,
    totalAmount: summary.totalAmount + (transaction.amount || 0),
    totalFees: summary.totalFees + (transaction.platformFee || 0),
    totalSettlements: summary.totalSettlements + (transaction.transferAmount || 0)
  }), { count: 0, totalAmount: 0, totalFees: 0, totalSettlements: 0 });
}

function filteredLedgerEntries(db, options) {
  return db.ledger
    .filter((entry) => (
      (!options.action || entry.action === options.action)
      && (!options.actorId || entry.actorId === options.actorId)
      && withinDateRange(entry.at, { from: options.from, to: options.to })
    ))
    .sort((left, right) => String(right.at).localeCompare(String(left.at)));
}

function csvCell(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function ledgerCsv(entries) {
  const rows = [["timestamp", "actor", "action", "payload"], ...entries.map((entry) => [
    entry.at,
    entry.actorId,
    entry.action,
    entry.payload
  ])];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function zoneSellThroughSummary(tickets, event) {
  return event.zones.map((zone) => {
    const zoneTickets = tickets.filter((ticket) => ticket.zoneId === zone.id);
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      totalCount: zoneTickets.length,
      availableCount: zoneTickets.filter((ticket) => ticket.status === "ON_SALE").length,
      soldCount: zoneTickets.filter((ticket) => ticket.ownerId || ticket.status === "OWNED" || ticket.status === "IN_RESALE_POOL").length,
      heldCount: zoneTickets.filter((ticket) => ticket.status === "ADMIN_HOLD").length
    };
  });
}

function firstEditableEvent(db, eventId) {
  if (eventId) {
    const selected = db.events.find((event) => event.id === eventId);
    if (!selected) throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
    return selected;
  }
  return db.events.find((event) => Array.isArray(event.prices) && event.prices.length > 0) || db.events[0] || null;
}

function scheduleFromStartsAt(startsAt) {
  const date = String(startsAt || "").slice(0, 10);
  const time = String(startsAt || "").slice(11, 16) || "19:30";
  return [{ label: "1회차", date, times: [time] }];
}

function assertAssignableRoles(actor, roleKeys) {
  const actorPermissions = new Set(adminDto(actor).permissions);
  const requestedPermissions = roleKeys.flatMap((key) => roleCatalog.find((role) => role.key === key)?.permissions || []);
  if (requestedPermissions.some((permission) => !actorPermissions.has(permission))) {
    throw httpError(403, "ADMIN_ROLE_ESCALATION", "본인에게 없는 권한을 다른 관리자에게 부여할 수 없습니다.");
  }
}

async function createEventDraft(db, payload) {
  const input = normalizeAdminEventInput(payload);
  const venue = resolveVenue(db, input.venueId);
  if (!venue) throw httpError(404, "VENUE_NOT_FOUND", "공연장을 찾을 수 없습니다.");
  const eventId = stableId("event", input.title, input.startsAt, venue.id);
  if (db.events.some((event) => event.id === eventId)) {
    throw httpError(409, "EVENT_ALREADY_EXISTS", "같은 공연 초안이 이미 있습니다.");
  }
  if (!payload.imageDataUrl) throw httpError(400, "MISSING_FIELD", "포스터 이미지를 등록해주세요.");
  const content = normalizeCreateEventContent(payload, {
    eventId,
    events: db.events,
    startsAt: input.startsAt
  });
  assertInventorySize(content.zones, content.dates);
  const image = await storeEventImage(payload.imageDataUrl);
  const event = {
    id: eventId,
    category: input.category,
    title: input.title,
    venueId: venue.id,
    venue: venue.name,
    date: input.startsAt,
    organizer: input.organizer,
    image,
    saleState: input.saleState,
    saleNote: input.saleNote || "관리자 초안",
    discountRate: input.discountRate,
    rating: "0.0",
    ...content
  };
  db.events.push(event);
  const beforeTickets = db.tickets.length;
  ensureTicketsForEvent(db, event);
  const ticketsCreated = db.tickets.length - beforeTickets;
  appendLedger(db, "ADMIN", "EVENT_DRAFT_CREATED", {
    eventId: event.id,
    title: event.title,
    venueId: venue.id,
    ticketsCreated
  });
  return { event: clone(event), venue, ticketsCreated, seatMap: venueMapForEvent(db, event.id) };
}

function isTransactionalTicket(ticket) {
  return Boolean(ticket.ownerId) || ticket.status !== "ON_SALE";
}

function activeSeatKeysForEvent(event) {
  const layoutSeats = seatLayoutForVenue(event.venueId);
  const layoutZoneIds = new Set(layoutSeats.map((seat) => seat.zoneId));
  const activeSeats = layoutSeats
    .filter((seat) => event.zones.some((zone) => zone.id === seat.zoneId))
    .map((seat) => [seat.zoneId, seat.seatLabel].join(":"));
  const generatedSeats = event.zones
    .filter((zone) => !layoutZoneIds.has(zone.id))
    .flatMap((zone) => {
      const seatCount = Number.isInteger(zone.seatCount) && zone.seatCount > 0 ? zone.seatCount : 12;
      return Array.from({ length: seatCount }, (_, index) => [zone.id, `${zone.name}-${String(index + 1).padStart(2, "0")}`].join(":"));
    });
  return new Set([...activeSeats, ...generatedSeats]);
}

function assertTicketsCanUseInventory(db, event, nextZones, nextDates) {
  const nextZoneIds = new Set(nextZones.map((zone) => zone.id));
  const nextDateIds = new Set(nextDates.map((date) => date.id));
  const blockedZoneTicket = db.tickets.find((ticket) => (
    ticket.eventId === event.id
    && !nextZoneIds.has(ticket.zoneId)
    && isTransactionalTicket(ticket)
  ));
  if (blockedZoneTicket) {
    throw httpError(409, "EVENT_ZONE_IN_USE", "이미 소유 또는 거래 중인 티켓이 있는 좌석 등급은 제거할 수 없습니다.");
  }
  const blockedDateTicket = db.tickets.find((ticket) => (
    ticket.eventId === event.id
    && !nextDateIds.has(ticket.performanceDateId)
    && isTransactionalTicket(ticket)
  ));
  if (blockedDateTicket) {
    throw httpError(409, "EVENT_SCHEDULE_IN_USE", "이미 소유 또는 거래 중인 티켓이 있는 공연 회차는 제거할 수 없습니다.");
  }
}

function removeStaleOpenTickets(db, event) {
  const activeZoneIds = new Set(event.zones.map((zone) => zone.id));
  const activeDateIds = new Set((event.dates || []).map((date) => date.id));
  const activeSeatKeys = activeSeatKeysForEvent(event);
  db.tickets = db.tickets.filter((ticket) => (
    ticket.eventId !== event.id
    || (
      activeZoneIds.has(ticket.zoneId)
      && activeDateIds.has(ticket.performanceDateId)
      && activeSeatKeys.has([ticket.zoneId, ticket.seatLabel].join(":"))
    )
    || isTransactionalTicket(ticket)
  ));
}

function createAdminAccount(db, payload, actor) {
  const username = String(payload.username || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
    throw httpError(422, "INVALID_ADMIN_USERNAME", "관리자 아이디는 영문 소문자, 숫자, . _ - 로 3~64자여야 합니다.");
  }
  const bootstrapUsername = String(actor?.bootstrap ? actor.username : actor?.bootstrapAdmin?.username || "").trim().toLowerCase();
  if (db.adminAccounts.some((account) => account.username.toLowerCase() === username) || bootstrapUsername === username) {
    throw httpError(409, "ADMIN_ACCOUNT_EXISTS", "이미 등록된 관리자 아이디입니다.");
  }
  let ipAllowlist;
  try {
    ipAllowlist = normalizeAdminIpAllowlist(payload.ipAllowlist);
  } catch (error) {
    throw httpError(422, "INVALID_ADMIN_IP_ACL", error.message);
  }
  const roleKeys = normalizeRoleKeys(payload.roleKeys);
  assertAssignableRoles(actor, roleKeys);
  const account = {
    id: id("admin"),
    username,
    ...passwordRecord(payload.password),
    roleKeys,
    ipAllowlist,
    active: true,
    createdAt: now(),
    updatedAt: now()
  };
  db.adminAccounts.push(account);
  appendLedger(db, "ADMIN", "ADMIN_ACCOUNT_CREATED", { adminId: account.id, username: account.username, roleKeys: account.roleKeys, ipAllowlist: account.ipAllowlist });
  return adminAccountDto(account);
}

function updateAdminAccount(db, payload, actor) {
  const account = db.adminAccounts.find((item) => item.id === payload.adminId);
  if (!account) throw httpError(404, "ADMIN_ACCOUNT_NOT_FOUND", "관리자 계정을 찾을 수 없습니다.");
  if (account.id === actor.id) throw httpError(403, "ADMIN_SELF_UPDATE_DENIED", "본인 관리자 계정의 역할과 ACL은 다른 관리자에게 요청해주세요.");
  const roleKeys = normalizeRoleKeys(payload.roleKeys);
  assertAssignableRoles(actor, roleKeys);
  let ipAllowlist;
  try {
    ipAllowlist = Object.hasOwn(payload, "ipAllowlist") ? normalizeAdminIpAllowlist(payload.ipAllowlist) : normalizeAdminIpAllowlist(account.ipAllowlist);
  } catch (error) {
    throw httpError(422, "INVALID_ADMIN_IP_ACL", error.message);
  }
  const passwordUpdated = Object.hasOwn(payload, "password") && String(payload.password || "").length > 0;
  const nextPassword = passwordUpdated ? passwordRecord(payload.password) : null;
  account.roleKeys = roleKeys;
  account.ipAllowlist = ipAllowlist;
  account.active = payload.active !== false;
  if (nextPassword) Object.assign(account, nextPassword);
  account.updatedAt = now();
  appendLedger(db, "ADMIN", "ADMIN_ACCOUNT_UPDATED", { adminId: account.id, roleKeys: account.roleKeys, ipAllowlist: account.ipAllowlist, active: account.active, passwordUpdated });
  return adminAccountDto(account);
}

function timingSafeStringMatches(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function authenticateAdminAccount(db, username, password, bootstrapAdmin) {
  const cleanUsername = String(username || "").trim().toLowerCase();
  const account = db.adminAccounts.find((item) => item.username === cleanUsername);
  if (account) {
    if (account.active === false || !passwordMatches(account, password)) return null;
    return account;
  }
  if (cleanUsername !== String(bootstrapAdmin.username || "").trim().toLowerCase() || !timingSafeStringMatches(password, bootstrapAdmin.password)) return null;
  return { id: "bootstrap-admin", username: bootstrapAdmin.username, roleKeys: bootstrapAdmin.roleKeys, ipAllowlist: bootstrapAdmin.ipAllowlist || [], active: true, bootstrap: true };
}

function activeAdminAccount(db, adminId) {
  if (adminId === "bootstrap-admin") return null;
  return db.adminAccounts.find((account) => account.id === adminId && account.active !== false) || null;
}

function updateEventVenue(db, { eventId, venueId }) {
  const event = db.events.find((item) => item.id === eventId);
  if (!event) throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
  const venue = resolveVenue(db, venueId);
  if (!venue) throw httpError(404, "VENUE_NOT_FOUND", "공연장을 찾을 수 없습니다.");
  event.venueId = venue.id;
  event.venue = venue.name;
  removeStaleOpenTickets(db, event);
  ensureTicketsForEvent(db, event);
  appendLedger(db, "ADMIN", "EVENT_VENUE_UPDATED", {
    eventId: event.id,
    venueId: venue.id,
    venue: venue.name,
    mapType: venue.map.type
  });
  return { event, venue, seatMap: venueMapForEvent(db, event.id) };
}

async function updateEventSale(db, payload) {
  const { eventId } = payload;
  const event = db.events.find((item) => item.id === eventId);
  if (!event) throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
  const input = normalizeAdminEventInput(payload, event);
  const venue = resolveVenue(db, input.venueId || event.venueId);
  const content = normalizeUpdateEventContent(payload, {
    event,
    eventId: event.id,
    events: db.events,
    startsAt: input.startsAt
  });
  const nextZones = content.zones || event.zones;
  const nextDates = content.dates || (event.dates?.length
    ? event.dates.map((date, index) => (index === 0 ? { ...date, startsAt: input.startsAt, label: date.label || "1회차" } : date))
    : [{ id: stableId("perf", event.id, input.startsAt), startsAt: input.startsAt, label: "1회차" }]);
  assertInventorySize(nextZones, nextDates);
  assertTicketsCanUseInventory(db, event, nextZones, nextDates);
  const nextImage = payload.imageDataUrl ? await storeEventImage(payload.imageDataUrl) : null;

  event.title = input.title;
  event.category = input.category;
  event.saleState = input.saleState;
  event.saleNote = input.saleNote;
  event.discountRate = input.discountRate;
  event.venueId = venue.id;
  event.venue = venue.name;
  if (nextImage) event.image = nextImage;
  Object.assign(event, content);
  if (!content.date) event.date = input.startsAt;
  if (!content.dates) {
    event.dates ||= [];
    if (!event.dates.length) {
      event.dates.push({ id: stableId("perf", event.id, input.startsAt), startsAt: input.startsAt, label: "1회차" });
    } else {
      event.dates[0].startsAt = input.startsAt;
      event.dates[0].label ||= "1회차";
    }
    event.schedules = scheduleFromStartsAt(input.startsAt);
  }
  removeStaleOpenTickets(db, event);

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
    startsAt: input.startsAt,
    venueId: venue.id,
    repricedTickets,
    prices: Object.fromEntries(event.zones.map((zone) => [zone.id, zone.faceValue]))
  });
  return { event, venue, repricedTickets, seatMap: venueMapForEvent(db, event.id) };
}

function adminVenues(db) {
  const event = firstEditableEvent(db);
  return {
    venues: db.venues.map(adminVenueRecord),
    eventSummaries: db.events.map((item) => eventPickerSummary(db, item)),
    events: event ? [clone(event)] : [],
    event
  };
}

function adminSummary(db) {
  const ledgerCheck = verifyLedger(db);
  const openPools = db.resalePools.filter((pool) => pool.status === "OPEN");
  const watchUsers = db.users.filter((user) => user.status === "WATCHLIST" || user.trustScore < 50);
  const openSupportThreads = db.supportThreads.filter((thread) => thread.status !== "CLOSED");
  const today = now().slice(0, 10);
  const todayPayments = db.paymentTransactions.filter((transaction) => String(transaction.createdAt || "").startsWith(today));
  const allPaymentSummary = paymentSummary(db.paymentTransactions.map((transaction) => ({
    ...transaction,
    platformFee: transaction.platformFee || 0,
    transferAmount: transaction.transferAmount || 0
  })));
  const todayPaymentSummary = paymentSummary(todayPayments.map((transaction) => ({
    ...transaction,
    platformFee: transaction.platformFee || 0,
    transferAmount: transaction.transferAmount || 0
  })));
  return {
    stats: {
      totalTickets: db.tickets.length,
      onSaleTickets: db.tickets.filter((ticket) => ticket.status === "ON_SALE").length,
      ownedTickets: db.tickets.filter((ticket) => ticket.status === "OWNED").length,
      totalPaymentAmount: allPaymentSummary.totalAmount,
      totalPaymentFees: allPaymentSummary.totalFees,
      totalSettlements: allPaymentSummary.totalSettlements,
      todayPaymentCount: todayPaymentSummary.count,
      todayPaymentAmount: todayPaymentSummary.totalAmount,
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

function adminWorkspace(db, workspace, actor, options = {}) {
  if (workspace === "overview") {
    return { stats: adminSummary(db).stats };
  }
  if (workspace === "catalog" || workspace === "sales") {
    const event = firstEditableEvent(db, options.eventId);
    return {
      eventSummaries: db.events.map((item) => eventPickerSummary(db, item)),
      events: event ? [clone(event)] : [],
      venues: db.venues.map(adminVenueRecord)
    };
  }
  if (workspace === "inventory") {
    const event = firstEditableEvent(db, options.eventId);
    if (!event) {
      return {
        eventSummaries: [],
        events: [],
        filters: { eventId: null, performanceDateId: null, zoneId: null },
        page: { page: 1, limit: 50, total: 0, hasNext: false, hasPrevious: false },
        tickets: [],
        zoneSummary: []
      };
    }
    const performanceDateId = options.performanceDateId || undefined;
    const zoneId = options.zoneId || undefined;
    if (performanceDateId && !event.dates?.some((date) => date.id === performanceDateId)) {
      throw httpError(404, "EVENT_DATE_NOT_FOUND", "예매 날짜를 찾을 수 없습니다.");
    }
    if (zoneId && !event.zones.some((zone) => zone.id === zoneId)) {
      throw httpError(404, "ZONE_NOT_FOUND", "구역을 찾을 수 없습니다.");
    }
    const { page, limit } = normalizePageOptions(options);
    const eventTickets = db.tickets.filter((ticket) => ticket.eventId === event.id);
    const filteredTickets = eventTickets.filter((ticket) => (
      (!performanceDateId || ticket.performanceDateId === performanceDateId)
      && (!zoneId || ticket.zoneId === zoneId)
    ));
    const start = (page - 1) * limit;
    return {
      eventSummaries: db.events.map((item) => eventPickerSummary(db, item)),
      events: [clone(event)],
      filters: {
        eventId: event.id,
        performanceDateId: performanceDateId || null,
        zoneId: zoneId || null
      },
      page: {
        page,
        limit,
        total: filteredTickets.length,
        hasNext: start + limit < filteredTickets.length,
        hasPrevious: page > 1
      },
      tickets: filteredTickets.slice(start, start + limit).map(adminTicket),
      zoneSummary: zoneSellThroughSummary(eventTickets, event)
    };
  }
  if (workspace === "finance") {
    const transactions = filteredPaymentTransactions(db, options);
    const paged = pageSlice(transactions, options);
    return {
      eventSummaries: db.events.map((item) => eventPickerSummary(db, item)),
      filters: {
        eventId: options.eventId || null,
        from: options.from || null,
        method: options.method || null,
        status: options.status || null,
        to: options.to || null
      },
      page: paged.page,
      summary: paymentSummary(transactions),
      transactions: clone(paged.items)
    };
  }
  if (workspace === "accounts") {
    return {
      filters: { search: options.search || null },
      users: filteredAdminUsers(db, options)
    };
  }
  if (workspace === "support") {
    return {
      filters: {
        category: options.category || null,
        status: options.status || null
      },
      supportThreads: filteredSupportThreads(db, options)
    };
  }
  if (workspace === "resale") {
    const usersById = new Map(db.users.map((user) => [user.id, user]));
    const ticketsById = new Map(db.tickets.map((ticket) => [ticket.id, ticket]));
    const eventsById = new Map(db.events.map((event) => [event.id, event]));
    return {
      resalePools: db.resalePools.map((pool) => {
        const event = eventsById.get(pool.eventId);
        const ticket = ticketsById.get(pool.ticketId);
        const zone = event?.zones.find((item) => item.id === pool.zoneId);
        const seller = usersById.get(pool.sellerId);
        return {
          ...clone(pool),
          eventTitle: event?.title || pool.eventId,
          seatLabel: ticket?.seatLabel || pool.ticketId,
          sellerName: seller?.name || pool.sellerId,
          zoneName: zone?.name || pool.zoneId
        };
      }),
      watchlist: clone(db.watchlist),
      notificationJobs: clone(db.notificationJobs),
      operatorAlerts: clone(db.operatorAlerts)
    };
  }
  if (workspace === "group-booking") {
    return listGroupBookingRequests(db, options);
  }
  if (workspace === "admission") {
    const paged = pageSlice(db.qrIssueLogs.map(qrIssueLogDto).reverse(), options);
    return {
      admissionCredentials: db.admissionCredentials.map(admissionCredentialDto),
      page: paged.page,
      qrIssueLogs: paged.items
    };
  }
  if (workspace === "audit") {
    const entries = filteredLedgerEntries(db, options);
    const paged = pageSlice(entries, options);
    return {
      filters: {
        action: options.action || null,
        actorId: options.actorId || null,
        from: options.from || null,
        to: options.to || null
      },
      ledger: clone(paged.items),
      page: paged.page,
      ledgerCheck: verifyLedger(db)
    };
  }
  if (workspace === "acl") {
    const adminAccounts = db.adminAccounts.map(adminAccountDto);
    const bootstrapAccount = actor?.bootstrap ? actor : actor?.bootstrapAdmin;
    if (bootstrapAccount && !adminAccounts.some((account) => account.username.toLowerCase() === bootstrapAccount.username.toLowerCase())) {
      adminAccounts.unshift(adminAccountDto({ ...bootstrapAccount, bootstrap: true }));
    }
    return { adminAccounts };
  }
  throw httpError(404, "ADMIN_WORKSPACE_NOT_FOUND", "요청한 운영 작업공간이 없습니다.");
}

function assertUserStatusUpdate(db, { userId, status }, index = null) {
  const allowed = ["ACTIVE", "WATCHLIST", "BANNED"];
  const detail = index === null ? { userId } : { userId, index };
  if (!allowed.includes(status)) {
    throw httpError(422, "INVALID_USER_STATUS", "지원하지 않는 계정 상태입니다.", detail);
  }
  const user = db.users.find((item) => item.id === userId);
  if (!user) throw httpError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.", detail);
  return { user, status };
}

function applyUserStatusUpdate(db, { user, status, reason }) {
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

function updateUserStatus(db, payload) {
  return applyUserStatusUpdate(db, {
    ...assertUserStatusUpdate(db, payload),
    reason: payload.reason
  });
}

function updateUserStatuses(db, { updates, reason }) {
  if (!Array.isArray(updates) || !updates.length) {
    throw httpError(400, "MISSING_FIELD", "수정할 계정 상태를 선택해주세요.");
  }
  const validated = updates.map((item, index) => assertUserStatusUpdate(db, item, index));
  return validated.map((item) => applyUserStatusUpdate(db, {
    ...item,
    reason: reason || "운영 콘솔 일괄 상태 변경"
  }));
}

function adminHoldAdmissionCredential(db, { credentialId, hold, reason }) {
  const credential = db.admissionCredentials.find((item) => item.id === credentialId);
  if (!credential) throw httpError(404, "ADMISSION_CREDENTIAL_NOT_FOUND", "입장 자격을 찾을 수 없습니다.");
  const activeHold = hold === true || hold === "true";
  const cleanReason = String(reason || "").trim() || (activeHold ? "운영자 입장 QR 보류" : "운영자 입장 QR 보류 해제");
  credential.adminHold = activeHold;
  credential.adminHoldReason = cleanReason.slice(0, 160);
  credential.adminHoldUpdatedAt = now();
  credential.updatedAt = credential.adminHoldUpdatedAt;
  appendLedger(db, "ADMIN", activeHold ? "ADMISSION_CREDENTIAL_HELD" : "ADMISSION_CREDENTIAL_RELEASED", {
    credentialId: credential.id,
    ticketId: credential.ticketId,
    userId: credential.userId,
    reason: credential.adminHoldReason
  });
  return admissionCredentialDto(credential);
}

function updateTicketStatus(db, { ticketId, status }) {
  const ticket = assertTicketStatusUpdate(db, { ticketId, status });
  ticket.status = status;
  appendLedger(db, "ADMIN", "TICKET_STATUS_UPDATED", {
    ticketId: ticket.id,
    status,
    policy: "operator-inventory-control"
  });
  return ticket;
}

function assertTicketStatusUpdate(db, { ticketId, status }, index = null) {
  const allowed = ["ON_SALE", "ADMIN_HOLD"];
  const detail = index === null ? { ticketId } : { ticketId, index };
  if (!allowed.includes(status)) {
    throw httpError(422, "INVALID_TICKET_STATUS", "지원하지 않는 티켓 상태입니다.", detail);
  }
  const ticket = db.tickets.find((item) => item.id === ticketId);
  if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.", detail);
  if (ticket.ownerId || !["ON_SALE", "ADMIN_HOLD"].includes(ticket.status)) {
    throw httpError(409, "TICKET_LOCKED", "소유자 또는 거래 상태가 있는 티켓은 재고 상태만 변경할 수 없습니다.", detail);
  }
  return ticket;
}

function updateTicketStatuses(db, { updates }) {
  if (!Array.isArray(updates) || !updates.length) {
    throw httpError(400, "MISSING_FIELD", "수정할 티켓 상태를 선택해주세요.");
  }
  const validated = updates.map((item, index) => ({
    ticket: assertTicketStatusUpdate(db, item, index),
    status: item.status
  }));
  for (const item of validated) {
    item.ticket.status = item.status;
    appendLedger(db, "ADMIN", "TICKET_STATUS_UPDATED", {
      ticketId: item.ticket.id,
      status: item.status,
      policy: "operator-inventory-control-batch"
    });
  }
  return validated.map((item) => item.ticket);
}

function adminCancelResalePool(db, { poolId, reason }) {
  const pool = db.resalePools.find((item) => item.id === poolId);
  if (!pool) throw httpError(404, "POOL_NOT_FOUND", "재판매 풀을 찾을 수 없습니다.", { poolId });
  if (pool.status !== "OPEN") throw httpError(409, "POOL_CLOSED", "이미 종료된 풀입니다.", { poolId });
  const ticket = db.tickets.find((item) => item.id === pool.ticketId);
  if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.", { ticketId: pool.ticketId, poolId });

  const cancelReason = String(reason || "").trim() || "관리자 강제 취소";
  ticket.status = "OWNED";
  pool.status = "CANCELED";
  pool.canceledAt = now();
  pool.cancelReason = cancelReason;
  appendLedger(db, "ADMIN", "ADMIN_RESALE_POOL_CANCELED", {
    poolId: pool.id,
    ticketId: ticket.id,
    reason: cancelReason,
    policy: "admin-force-cancel-open-resale-pool"
  });
  return pool;
}

function acknowledgeOperatorAlerts(db, { alertId, alertIds }) {
  const ids = Array.isArray(alertIds) ? alertIds : [alertId].filter(Boolean);
  const uniqueIds = [...new Set(ids.map((item) => String(item || "").trim()).filter(Boolean))];
  if (!uniqueIds.length) throw httpError(400, "MISSING_FIELD", "확인할 운영 알림을 선택해주세요.");
  const alerts = uniqueIds.map((idValue) => {
    const alert = db.operatorAlerts.find((item) => item.id === idValue);
    if (!alert) throw httpError(404, "ALERT_NOT_FOUND", "운영 알림을 찾을 수 없습니다.", { alertId: idValue });
    return alert;
  });
  for (const alert of alerts) {
    alert.status = "ACKED";
    alert.ackedAt = now();
  }
  appendLedger(db, "ADMIN", "OPERATOR_ALERT_ACKED", {
    alertIds: alerts.map((alert) => alert.id),
    policy: "operator-alert-acknowledgement"
  });
  return { acknowledgedAlertIds: alerts.map((alert) => alert.id) };
}



  return {
    adminHoldAdmissionCredential,
    activeAdminAccount,
    adminAccountDto,
    adminCancelResalePool,
    adminVenues,
    adminWorkspace,
    adminLedgerCsv: (db, options = {}) => ledgerCsv(filteredLedgerEntries(db, options)),
    adminVenueRecord,
    authenticateAdminAccount,
    createAdminAccount,
    createEventDraft,
    acknowledgeOperatorAlerts,
    isAdminIpAllowed,
    resolveVenue,
    seatMap,
    updateEventSale,
    updateEventVenue,
    updateAdminAccount,
    updateTicketStatus,
    updateTicketStatuses,
    updateUserStatus,
    updateUserStatuses,
    venueMapForEvent
  };
}
