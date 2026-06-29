// JSON DB normalization and seed construction for catalog data.
export function createCatalogPersistence({
  appendLedger,
  clone,
  ensureAdmissionCredential,
  ensureTicketsForEvent,
  eventBlueprints,
  eventZone,
  primaryDate,
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
  db.admissionCredentials ||= [];
  db.trustedDevices ||= [];
  db.qrIssueLogs ||= [];
  db.operatorAlerts ||= [];
  db.paymentTransactions ||= [];
  db.ledger ||= [];

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
    primaryDate(event);
    syncEventVenue(db, event);
    if (ensureTicketsForEvent(db, event)) changed = true;
  }

  for (const ticket of db.tickets) {
    const event = db.events.find((item) => item.id === ticket.eventId) || db.events[0];
    if (!event) continue;
    const performanceDate = primaryDate(event);
    const { zone } = eventZone(db, event.id, ticket.zoneId || event.zones[0].id);
    const before = JSON.stringify(ticket);
    ticket.eventId ||= event.id;
    ticket.performanceDateId ||= performanceDate.id;
    ticket.zoneId ||= zone.id;
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
      { id: "user_fan_a", name: "민서", balance: 180000, status: "ACTIVE", trustScore: 92, sanctions: [] },
      { id: "user_fan_b", name: "지후", balance: 135000, status: "ACTIVE", trustScore: 88, sanctions: [] },
      { id: "user_seller", name: "하린", balance: 30000, status: "ACTIVE", trustScore: 95, sanctions: [] },
      { id: "user_scalper", name: "의심 계정", balance: 500000, status: "WATCHLIST", trustScore: 34, sanctions: [] }
    ],
    venues: venueBlueprints(),
    events: eventBlueprints(),
    tickets: [],
    resalePools: [],
    supportThreads: [],
    watchlist: [],
    notificationJobs: [],
    admissionCredentials: [],
    trustedDevices: [],
    qrIssueLogs: [],
    operatorAlerts: [],
    paymentTransactions: [],
    ledger: []
  };
  for (const event of db.events) ensureTicketsForEvent(db, event);
  appendLedger(db, "SYSTEM", "BOOTSTRAP", { message: "Initial event, venue map and ticket minting snapshot" });
  return db;
}

  return { normalizeDb, seedDb };
}
