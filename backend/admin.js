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
  db.tickets = db.tickets.filter((ticket) => (
    ticket.eventId !== event.id
    || (
      activeZoneIds.has(ticket.zoneId)
      && activeDateIds.has(ticket.performanceDateId)
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
  account.roleKeys = roleKeys;
  account.ipAllowlist = ipAllowlist;
  account.active = payload.active !== false;
  account.updatedAt = now();
  appendLedger(db, "ADMIN", "ADMIN_ACCOUNT_UPDATED", { adminId: account.id, roleKeys: account.roleKeys, ipAllowlist: account.ipAllowlist, active: account.active });
  return adminAccountDto(account);
}

function authenticateAdminAccount(db, username, password, bootstrapAdmin) {
  const cleanUsername = String(username || "").trim().toLowerCase();
  const account = db.adminAccounts.find((item) => item.username === cleanUsername);
  if (account) {
    if (account.active === false || !passwordMatches(account, password)) return null;
    return account;
  }
  if (cleanUsername !== String(bootstrapAdmin.username || "").trim().toLowerCase() || String(password || "") !== String(bootstrapAdmin.password || "")) return null;
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
  ensureTicketsForEvent(db, event);
  appendLedger(db, "ADMIN", "EVENT_VENUE_UPDATED", {
    eventId: event.id,
    venueId: venue.id,
    venue: venue.name,
    mapType: venue.map.type
  });
  return { event, venue, seatMap: venueMapForEvent(db, event.id) };
}

function updateEventSale(db, payload) {
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

  event.title = input.title;
  event.category = input.category;
  event.saleState = input.saleState;
  event.saleNote = input.saleNote;
  event.discountRate = input.discountRate;
  event.venueId = venue.id;
  event.venue = venue.name;
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

function adminWorkspace(db, workspace, actor) {
  if (workspace === "overview") {
    return { stats: adminSummary(db).stats };
  }
  if (workspace === "catalog" || workspace === "sales") {
    return {
      events: clone(db.events),
      venues: db.venues.map(adminVenueRecord)
    };
  }
  if (workspace === "inventory") {
    return { tickets: db.tickets.map(adminTicket) };
  }
  if (workspace === "accounts") {
    return {
      users: db.users.map((user) => ({
        id: user.id,
        name: user.name,
        status: user.status,
        trustScore: user.trustScore
      }))
    };
  }
  if (workspace === "support") return { supportThreads: clone(db.supportThreads) };
  if (workspace === "resale") {
    return {
      resalePools: clone(db.resalePools),
      watchlist: clone(db.watchlist),
      notificationJobs: clone(db.notificationJobs),
      operatorAlerts: clone(db.operatorAlerts)
    };
  }
  if (workspace === "admission") return { admissionCredentials: clone(db.admissionCredentials) };
  if (workspace === "audit") {
    return {
      ledger: clone(db.ledger.slice(-12).reverse()),
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
    activeAdminAccount,
    adminAccountDto,
    adminSummary,
    adminVenues,
    adminWorkspace,
    adminVenueRecord,
    authenticateAdminAccount,
    createAdminAccount,
    createEventDraft,
    isAdminIpAllowed,
    resolveVenue,
    seatMap,
    updateEventSale,
    updateEventVenue,
    updateAdminAccount,
    updateTicketStatus,
    updateUserStatus,
    updateUserStatuses,
    venueMapForEvent
  };
}
