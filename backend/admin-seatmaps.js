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
      mapId: "jamsil-indoor",
      mapTitle: "잠실 실내체육관 도면",
      mapImage: "/admin-assets/jamsil-indoor.svg",
      description: "원형 실내 공연장 좌석 배치도입니다."
    },
    venue_jamsil_olympic: {
      category: "sports",
      mapId: "jamsil-main-stadium",
      mapTitle: "잠실 올림픽주경기장 도면",
      mapImage: "/admin-assets/jamsil-main-stadium.svg",
      description: "대형 경기장형 관람석 배치도입니다."
    },
    venue_nanjipark: {
      category: "festival",
      mapId: "jamsil-aux-field",
      mapTitle: "잠실 보조 경기장 도면",
      mapImage: "/admin-assets/jamsil-aux-field.svg",
      description: "야외 페스티벌형 스탠딩 및 피크닉 구역 배치도입니다."
    },
    venue_bluesquare: {
      category: "musical",
      mapId: "blue-square-theater",
      mapTitle: "블루스퀘어 좌석도",
      mapImage: "/좌석 도면/블루스퀘어/블루스퀘어 1층.png",
      description: "블루스퀘어 1층·2층·3층 도면 기반 극장형 좌석 배치도입니다."
    }
  };
  return {
    id: venue.id,
    name: venue.name,
    category: mapByVenue[venue.id]?.category || venue.map?.type || "concert",
    mapId: mapByVenue[venue.id]?.mapId || venue.map?.type || venue.id,
    mapTitle: mapByVenue[venue.id]?.mapTitle || venue.map?.imageSource || `${venue.name} 도면`,
    mapImage: mapByVenue[venue.id]?.mapImage || venue.map?.imageUrl || "/admin-assets/jamsil-main-stadium.svg",
    description: mapByVenue[venue.id]?.description || venue.map?.helper || `${venue.name} 좌석 배치도입니다.`
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

function seatMap(db, { category, venueId, eventId }) {
  const event = db.events.find((item) => item.id === eventId) || db.events[0];
  const venue = venueId ? resolveVenue(db, venueId) : resolveVenue(db, event.venueId);
  const adminVenue = adminVenueRecord(venue);
  const zones = event.zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    price: zone.faceValue,
    available: db.tickets.filter((ticket) =>
      ticket.eventId === event.id && ticket.zoneId === zone.id && ticket.status === "ON_SALE"
    ).length
  }));
  const eventTickets = db.tickets.filter((ticket) => ticket.eventId === event.id);
  const seats = eventTickets.map((ticket, index) => {
    const zone = event.zones.find((item) => item.id === ticket.zoneId);
    const angle = (index / Math.max(eventTickets.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const radius = ticket.zoneId === "zone_vip" ? 28 : ticket.zoneId === "zone_r" ? 35 : 42;
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
        x: Number((50 + Math.cos(angle) * radius).toFixed(1)),
        y: Number((52 + Math.sin(angle) * radius * 0.82).toFixed(1)),
        width: 5.4,
        height: 7.2,
        rotate: Math.round((angle * 180) / Math.PI + 90),
        shape: "actual-map"
      }
    };
  });
  return {
    category: category || adminVenue.category,
    date: event.dates?.[0]?.startsAt || event.date,
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
