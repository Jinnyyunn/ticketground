// JSON DB normalization and seed construction for catalog data.
import { defaultCheckoutNotice } from "./admin-event-content.js";

// "Tig 티켓" 브랜드 분리(양도=CLEAN, 일반판매=Tig) 이후에도 이미 저장된 db.json은
// legacy-show-seed-data.js의 새 문구를 자동으로 받지 못한다 - 시드는 최초 생성 시에만
// 쓰이고 이후엔 event.notices가 이미 채워져 있어 백필되지 않기 때문. 알려진 구 문구만
// 정확히 치환한다(부분 문자열 치환은 조사(은/는) 불일치를 만들 수 있어 피한다).
const STALE_NOTICE_REPLACEMENTS = new Map([
  ["Tig 공식 양도 티켓 정책은 공연별 공지에 따라 제한될 수 있습니다.", "CLEAN 티켓 공식 양도 정책은 공연별 공지에 따라 제한될 수 있습니다."],
  ["공식 양도와 취소 정책은 클린티켓 기준을 따릅니다.", "공식 양도와 취소 정책은 CLEAN 티켓 기준을 따릅니다."],
  ["Tig 공식 양도 티켓은 정가 범위 안에서만 등록할 수 있습니다.", "CLEAN 티켓 공식 양도는 정가 범위 안에서만 등록할 수 있습니다."]
]);

export function createCatalogPersistence({
  appendLedger,
  clone,
  ensureAdmissionCredential,
  ensureTicketsForEvent,
  eventBlueprints,
  now,
  primaryDate,
  stableId,
  syncEventVenue,
  venueBlueprints
}) {
function normalizeDb(db) {
  let changed = false;
  db.users ||= [];
  db.events ||= [];
  db.tickets ||= [];
  db.resalePools ||= [];
  db.supportThreads ||= [];
  db.watchlist ||= [];
  db.notificationJobs ||= [];
  db.identityVerifications ||= [];
  db.admissionCredentials ||= [];
  db.trustedDevices ||= [];
  db.qrIssueLogs ||= [];
  db.operatorAlerts ||= [];
  db.paymentTransactions ||= [];
  db.groupBookingRequests ||= [];
  db.sellerApplications ||= [];
  db.sellerAccounts ||= [];
  db.adminAccounts ||= [];
  db.nativeSessions ||= [];
  db.idempotencyRecords ||= [];
  db.bookingQueues ||= [];
  db.seatHolds ||= [];
  db.reservationDrafts ||= [];
  db.bookingInventoryRevision ||= 1;
  db.deviceChallenges ||= [];
  db.deviceRegistrations ||= [];
  db.notificationPreferences ||= [];
  db.mobileQrTokens ||= [];
  db.ledger ||= [];
  db.queueEntries ||= [];
  db.seatHolds ||= [];
  db.reservationDrafts ||= [];
  db.gateSessions ||= [];
  for (const key of ["cancellationRequests", "pushTokens", "mobileMutationReceipts", "apiMutationReceipts", "appAttestChallenges", "mobileReleasePolicies", "mobilePushCampaigns"]) {
    if (!Array.isArray(db[key])) {
      db[key] = [];
      changed = true;
    }
  }
  if (!db.mobileMaintenance || typeof db.mobileMaintenance !== "object") {
    db.mobileMaintenance = { enabled: false, title: "서비스 정상 운영 중", message: "", startsAt: null, endsAt: null, updatedAt: null, updatedBy: null };
    changed = true;
  }

  if (!db.venues?.length) {
    db.venues = venueBlueprints();
    changed = true;
  } else {
    for (const venue of venueBlueprints()) {
      const existing = db.venues.find((item) => item.id === venue.id);
      if (!existing) {
        db.venues.push(venue);
        changed = true;
      } else {
        const before = JSON.stringify(existing);
        existing.name = venue.name;
        existing.address = venue.address;
        existing.map = venue.map;
        if (JSON.stringify(existing) !== before) changed = true;
      }
    }
  }

  for (const blueprint of eventBlueprints()) {
    const existing = db.events.find((event) => event.id === blueprint.id);
    if (!existing) {
      db.events.push(clone(blueprint));
      changed = true;
      continue;
    }
    const before = JSON.stringify(existing);
    existing.category ||= blueprint.category;
    existing.image ||= blueprint.image;
    existing.badge ||= blueprint.badge;
    existing.saleState ||= blueprint.saleState || "ON_SALE";
    existing.saleNote ||= blueprint.saleNote || "";
    existing.discountRate ??= blueprint.discountRate || 0;
    existing.durationMinutes ||= blueprint.durationMinutes;
    existing.ageLimit ||= blueprint.ageLimit;
    existing.rating ||= blueprint.rating;
    existing.organizer ||= blueprint.organizer;
    existing.zones ||= clone(blueprint.zones);
    if (existing.id === "event_kpop_001" && (!existing.venueId || existing.venue === "KSPO Dome")) {
      existing.venueId = "venue_jamsil_olympic";
      existing.venue = "잠실 올림픽 주 경기장";
    }
    existing.venueId ||= blueprint.venueId;
    existing.venue ||= blueprint.venue;
    if (!existing.dates?.length) {
      existing.dates = clone(blueprint.dates || [{ id: stableId("perf", existing.id, existing.date), startsAt: existing.date, label: "1회차" }]);
    }
    existing.date = existing.dates[0]?.startsAt || existing.date || blueprint.date;
    syncEventVenue(db, existing);
    if (JSON.stringify(existing) !== before) changed = true;
  }

  for (const event of db.events) {
    const before = JSON.stringify(event);
    event.slug ||= `event-${event.id}`;
    event.checkoutNotice ||= defaultCheckoutNotice;
    event.sellerAccountId ??= null;
    event.publishStatus ||= "PUBLISHED";
    if (Array.isArray(event.notices)) {
      event.notices = event.notices.map((notice) => STALE_NOTICE_REPLACEMENTS.get(notice) || notice);
    }
    primaryDate(event);
    syncEventVenue(db, event);
    if (JSON.stringify(event) !== before) changed = true;
    if (ensureTicketsForEvent(db, event)) changed = true;
  }

  for (const ticket of db.tickets) {
    const event = db.events.find((item) => item.id === ticket.eventId) || db.events[0];
    if (!event) continue;
    const performanceDate = primaryDate(event);
    const zone = event.zones.find((item) => item.id === ticket.zoneId) || event.zones[0];
    if (!zone) continue;
    const before = JSON.stringify(ticket);
    ticket.eventId ||= event.id;
    ticket.performanceDateId ||= performanceDate.id;
    ticket.zoneId = zone.id;
    ticket.faceValue ||= zone.faceValue;
    ticket.minPrice ||= Math.ceil(ticket.faceValue * 0.5);
    ticket.maxPrice ||= Math.ceil(ticket.faceValue * (1 + zone.resaleFeeRate));
    ticket.maxTransferCount ||= zone.maxTransferCount;
    ticket.transferCount ||= 0;
    ticket.currentQr ||= null;
    ticket.virtualQr ||= null;
    ticket.issuedAt ||= now();
    if (ticket.ownerId && !ticket.admissionCredentialId) {
      const owner = db.users.find((item) => item.id === ticket.ownerId);
      if (owner) ensureAdmissionCredential(db, { user: owner, ticket, event, performanceDate });
    }
    if (JSON.stringify(ticket) !== before) changed = true;
  }

  for (const user of db.users) {
    const before = JSON.stringify(user.identityVerification || null);
    user.identityVerification ||= null;
    if (JSON.stringify(user.identityVerification) !== before) changed = true;
    if (user.profileConfirmedAt === undefined) {
      user.profileConfirmedAt = now();
      changed = true;
    }
  }

  for (const pool of db.resalePools) {
    const ticket = db.tickets.find((item) => item.id === pool.ticketId);
    if (ticket && !pool.performanceDateId) {
      pool.performanceDateId = ticket.performanceDateId;
      changed = true;
    }
  }

  if (changed) {
    appendLedger(db, "SYSTEM", "DATA_MIGRATION", {
      version: "booking-date-seat-map-v1",
      events: db.events.length,
      venues: db.venues.length,
      tickets: db.tickets.length
    });
  }
  return changed;
}

function seedDb() {
  const db = {
    users: [
      { id: "user_fan_a", name: "민서", balance: 180000, status: "ACTIVE", trustScore: 92, sanctions: [], profileConfirmedAt: now() },
      { id: "user_fan_b", name: "지후", balance: 135000, status: "ACTIVE", trustScore: 88, sanctions: [], profileConfirmedAt: now() },
      { id: "user_seller", name: "하린", balance: 30000, status: "ACTIVE", trustScore: 95, sanctions: [], profileConfirmedAt: now() },
      { id: "user_scalper", name: "의심 계정", balance: 500000, status: "WATCHLIST", trustScore: 34, sanctions: [], profileConfirmedAt: now() }
    ],
    venues: venueBlueprints(),
    events: eventBlueprints(),
    tickets: [],
    resalePools: [],
    supportThreads: [],
    watchlist: [],
    notificationJobs: [],
    identityVerifications: [],
    admissionCredentials: [],
    trustedDevices: [],
    qrIssueLogs: [],
    operatorAlerts: [],
    paymentTransactions: [],
    groupBookingRequests: [],
    sellerApplications: [],
    sellerAccounts: [],
    adminAccounts: [],
    nativeSessions: [],
    queueEntries: [],
    seatHolds: [],
    reservationDrafts: [],
    gateSessions: [],
    cancellationRequests: [],
    pushTokens: [],
    mobileMutationReceipts: [],
    apiMutationReceipts: [],
    appAttestChallenges: [],
    mobileReleasePolicies: [],
    mobilePushCampaigns: [],
    mobileMaintenance: { enabled: false, title: "서비스 정상 운영 중", message: "", startsAt: null, endsAt: null, updatedAt: null, updatedBy: null },
    ledger: []
  };
  for (const event of db.events) {
    event.slug ||= `event-${event.id}`;
    event.sellerAccountId ??= null;
    event.publishStatus ||= "PUBLISHED";
    ensureTicketsForEvent(db, event);
  }
  appendLedger(db, "SYSTEM", "BOOTSTRAP", { message: "Initial event, venue map and ticket minting snapshot" });
  return db;
}

  return { normalizeDb, seedDb };
}
