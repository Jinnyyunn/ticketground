// Catalog persistence and event-ticket normalization helpers.
import { eventBlueprints, venueBlueprints } from "./catalog-data.js";
import { seatLayoutForVenue } from "./seat-layouts.js";
import { createCatalogPersistence } from "./catalog-persistence.js";

export function createCatalogBackend({
  appendLedger,
  clone,
  ensureAdmissionCredential,
  httpError,
  now,
  stableId
}) {


function primaryDate(event) {
  if (!event.dates?.length) {
    event.dates = [{ id: stableId("perf", event.id, event.date || now()), startsAt: event.date || now(), label: "1회차" }];
  }
  return event.dates[0];
}

function ticketIdFor(event, performanceDateId, seat) {
  return stableId("ticket", event.id, performanceDateId, seat.zoneId, seat.seatLabel);
}

function eventZone(db, eventId, zoneId) {
  const event = db.events.find((item) => item.id === eventId);
  if (!event) throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
  const zone = event.zones.find((item) => item.id === zoneId);
  if (!zone) throw httpError(404, "ZONE_NOT_FOUND", "구역을 찾을 수 없습니다.");
  return { event, zone };
}

function eventDate(event, performanceDateId) {
  const performanceDate = event.dates?.find((item) => item.id === performanceDateId);
  if (!performanceDate) throw httpError(404, "EVENT_DATE_NOT_FOUND", "예매 날짜를 찾을 수 없습니다.");
  return performanceDate;
}

function eventSaleState(event) {
  const allowed = ["ON_SALE", "OPEN_SOON", "DISCOUNT_SOON", "ADMIN_HOLD"];
  return allowed.includes(event.saleState) ? event.saleState : "ON_SALE";
}

function isEventBookable(event) {
  return eventSaleState(event) === "ON_SALE";
}

function minZonePrice(event) {
  return Math.min(...event.zones.map((zone) => zone.faceValue));
}

function saleSummary(event) {
  const labels = {
    ON_SALE: "예매 가능",
    OPEN_SOON: "오픈 예정",
    DISCOUNT_SOON: "할인 예정",
    ADMIN_HOLD: "판매 보류"
  };
  const state = eventSaleState(event);
  const discountRate = Number(event.discountRate || 0);
  const basePrice = minZonePrice(event);
  return {
    state,
    label: labels[state],
    note: event.saleNote || labels[state],
    discountRate,
    displayPrice: discountRate > 0 ? Math.max(0, Math.round(basePrice * (100 - discountRate) / 100)) : basePrice,
    basePrice,
    bookable: state === "ON_SALE"
  };
}

function ensureTicketsForEvent(db, event) {
  let changed = false;
  const seats = seatLayoutForVenue(event.venueId);
  for (const performanceDate of event.dates || [primaryDate(event)]) {
    for (const seat of seats) {
      const { zone } = eventZone(db, event.id, seat.zoneId);
      const existing = db.tickets.find((ticket) =>
        ticket.eventId === event.id
        && ticket.performanceDateId === performanceDate.id
        && ticket.zoneId === seat.zoneId
        && ticket.seatLabel === seat.seatLabel
      );
      if (existing) continue;
      db.tickets.push({
        id: ticketIdFor(event, performanceDate.id, seat),
        eventId: event.id,
        performanceDateId: performanceDate.id,
        zoneId: seat.zoneId,
        seatLabel: seat.seatLabel,
        ownerId: null,
        status: "ON_SALE",
        faceValue: zone.faceValue,
        minPrice: Math.ceil(zone.faceValue * 0.5),
        maxPrice: Math.ceil(zone.faceValue * (1 + zone.resaleFeeRate)),
        transferCount: 0,
        maxTransferCount: zone.maxTransferCount,
        currentQr: null,
        issuedAt: now()
      });
      changed = true;
    }
  }
  return changed;
}

function syncEventVenue(db, event) {
  const venue = db.venues.find((item) => item.id === event.venueId)
    || db.venues.find((item) => item.name === event.venue)
    || db.venues[0];
  event.venueId = venue.id;
  event.venue = venue.name;
}



  const { normalizeDb, seedDb } = createCatalogPersistence({
    appendLedger,
    clone,
    ensureAdmissionCredential,
    ensureTicketsForEvent,
    eventBlueprints,
    eventZone,
    primaryDate,
    syncEventVenue,
    venueBlueprints
  });

  return {
    ensureTicketsForEvent,
    eventDate,
    eventZone,
    isEventBookable,
    normalizeDb,
    primaryDate,
    saleSummary,
    seatLayoutForVenue,
    seedDb
  };
}
