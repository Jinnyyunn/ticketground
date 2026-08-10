// Venue and seat-map admin helpers.
export function createAdminSeatMapBackend({ httpError, seatLayoutForVenue }) {
function venueMapForEvent(db, eventId) {
  const event = db.events.find((item) => item.id === eventId);
  if (!event) throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
  const venue = db.venues.find((item) => item.id === event.venueId);
  if (!venue) throw httpError(404, "VENUE_NOT_FOUND", "공연장 정보를 찾을 수 없습니다.");
  return {
    eventId: event.id,
    venueId: venue.id,
    venue: venue.name,
    address: venue.address,
    type: venue.map.type,
    imageUrl: venue.map.imageUrl,
    imageSource: venue.map.imageSource,
    stage: venue.map.stage,
    helper: venue.map.helper,
    labels: venue.map.labels,
    seats: seatLayoutForVenue(venue.id)
  };
}

function adminVenueRecord(venue) {
  const mapByVenue = {
    venue_kspo_dome: {
      category: "concert",
      mapId: "kspo-dome-arena",
      mapTitle: "KSPO Dome 좌석도",
      mapImage: "/assets/generic-arena-floor.svg",
      description: "원형 실내 공연장 좌석 배치 개략도입니다. 실제 도면과 다를 수 있습니다."
    },
    venue_jamsil_olympic: {
      category: "sports",
      mapId: "jamsil-main-stadium",
      mapTitle: "잠실 올림픽주경기장 도면",
      mapImage: "/assets/jamsil-olympic-main-stadium.svg",
      description: "대형 경기장형 관람석 배치도입니다."
    },
    venue_nanjipark: {
      category: "concert",
      mapId: "nanjipark-festival-field",
      mapTitle: "난지한강공원 좌석도",
      mapImage: "/assets/generic-arena-floor.svg",
      description: "야외 페스티벌형 스탠딩 및 피크닉 구역 배치 개략도입니다. 실제 도면과 다를 수 있습니다."
    },
    venue_bluesquare: {
      category: "musical",
      mapId: "blue-square-theater",
      mapTitle: "블루스퀘어 좌석도",
      mapImage: "/assets/seatmaps/bluesquare-floor-1.png",
      description: "블루스퀘어 1층·2층·3층 도면 기반 극장형 좌석 배치도입니다."
    }
  };
  // Venues without a dedicated entry above (the 17 legacy-catalog venues in
  // catalog-data.js) fall back by map.type instead of all sharing the
  // Olympic-stadium image regardless of whether they're actually a theater.
  // Both fallbacks use venue-neutral schematics rather than the two real
  // photos above (bluesquare-floor-1.png, jamsil-olympic-main-stadium.svg) —
  // those depict one specific venue's actual seating geometry (row counts,
  // gate numbers, field shape), and reusing either under a different venue's
  // name would misrepresent that venue's real layout.
  const mapByType = {
    theater: {
      category: "musical",
      mapId: "theater-floor",
      mapTitle: `${venue.name} 좌석도`,
      mapImage: "/assets/generic-theater-floor.svg",
      description: `${venue.name} 극장형 좌석 배치 개략도입니다. 실제 도면과 다를 수 있습니다.`
    },
    arena: {
      category: "concert",
      mapId: "arena-floor",
      mapTitle: `${venue.name} 도면`,
      mapImage: "/assets/generic-arena-floor.svg",
      description: `${venue.name} 좌석 배치 개략도입니다. 실제 도면과 다를 수 있습니다.`
    }
  };
  const entry = mapByVenue[venue.id] || mapByType[venue.map?.type];
  return {
    id: venue.id,
    name: venue.name,
    category: entry?.category || venue.map?.type || "concert",
    mapId: entry?.mapId || venue.map?.type || venue.id,
    mapTitle: entry?.mapTitle || venue.map?.imageSource || `${venue.name} 도면`,
    mapImage: entry?.mapImage || venue.map?.imageUrl || "/assets/jamsil-olympic-main-stadium.svg",
    description: entry?.description || venue.map?.helper || `${venue.name} 좌석 배치도입니다.`
  };
}

function resolveVenue(db, venueId) {
  const legacyMap = {
    "jamsil-indoor": "venue_kspo_dome",
    "jamsil-main-stadium": "venue_jamsil_olympic",
    "jamsil-aux-field": "venue_nanjipark"
  };
  const idValue = legacyMap[venueId] || venueId;
  const venue = db.venues.find((item) => item.id === idValue);
  if (!venue) throw httpError(404, "VENUE_NOT_FOUND", "공연장을 찾을 수 없습니다.");
  return venue;
}

function seatMap(db, { category, venueId, eventId, performanceDateId }) {
  const event = eventId ? db.events.find((item) => item.id === eventId) : db.events[0];
  if (!event) throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
  if (!performanceDateId) {
    throw httpError(400, "MISSING_FIELD", "performanceDateId 값이 필요합니다.");
  }
  const performanceDate = event.dates?.find((item) => item.id === performanceDateId);
  if (!performanceDate) {
    throw httpError(404, "EVENT_DATE_NOT_FOUND", "예매 날짜를 찾을 수 없습니다.");
  }
  const venue = venueId ? resolveVenue(db, venueId) : resolveVenue(db, event.venueId);
  const adminVenue = adminVenueRecord(venue);
  const layoutSeats = seatLayoutForVenue(venue.id);
  const layoutByTicket = new Map(layoutSeats.map((seat) => [`${seat.zoneId}\u0000${seat.seatLabel}`, seat]));
  const zones = event.zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    price: zone.faceValue,
    available: db.tickets.filter((ticket) =>
      ticket.eventId === event.id
      && ticket.performanceDateId === performanceDate.id
      && ticket.zoneId === zone.id
      && ticket.status === "ON_SALE"
    ).length
  }));
  const eventTickets = db.tickets.filter((ticket) =>
    ticket.eventId === event.id && ticket.performanceDateId === performanceDate.id
  );
  const fallbackRowOffsets = new Map();
  let nextFallbackRow = 110;
  for (const zone of event.zones) {
    const fallbackCount = eventTickets.filter((ticket) =>
      ticket.zoneId === zone.id && !layoutByTicket.has(`${ticket.zoneId}\u0000${ticket.seatLabel}`)
    ).length;
    fallbackRowOffsets.set(zone.id, nextFallbackRow);
    nextFallbackRow += Math.max(1, Math.ceil(fallbackCount / 18)) * 5 + 5;
  }
  const fallbackIndexes = new Map();
  const seats = eventTickets.map((ticket) => {
    const zone = event.zones.find((item) => item.id === ticket.zoneId);
    const layoutSeat = layoutByTicket.get(`${ticket.zoneId}\u0000${ticket.seatLabel}`);
    const fallbackIndex = fallbackIndexes.get(ticket.zoneId) || 0;
    if (!layoutSeat) fallbackIndexes.set(ticket.zoneId, fallbackIndex + 1);
    const fallbackColumn = fallbackIndex % 18;
    const fallbackRow = Math.floor(fallbackIndex / 18);
    return {
      id: ticket.id,
      label: ticket.seatLabel.replace(/^.*-/, ""),
      displayCode: ticket.seatLabel.replace(/^.*-/, ""),
      zoneId: ticket.zoneId,
      zoneName: zone?.name || ticket.zoneId,
      price: ticket.faceValue,
      status: ticket.status,
      available: ticket.status === "ON_SALE",
      mapPosition: {
        x: layoutSeat?.x ?? Number((8 + fallbackColumn * (84 / 17)).toFixed(2)),
        y: layoutSeat?.y ?? (fallbackRowOffsets.get(ticket.zoneId) || 110) + fallbackRow * 5,
        width: 5.4,
        height: 7.2,
        rotate: 0,
        shape: layoutSeat ? "actual-map" : "generated-grid"
      }
    };
  });
  return {
    category: category || adminVenue.category,
    date: performanceDate.startsAt,
    event: {
      id: event.id,
      title: event.title,
      venueId: venue.id,
      venue: venue.name,
      originalVenue: venue.name
    },
    map: {
      id: adminVenue.mapId,
      venue: venue.name,
      title: adminVenue.mapTitle,
      image: adminVenue.mapImage,
      description: adminVenue.description
    },
    zones,
    seats
  };
}

  return { adminVenueRecord, resolveVenue, seatMap, venueMapForEvent };
}
