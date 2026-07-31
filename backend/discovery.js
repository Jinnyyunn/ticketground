const DISCOVERY_VERSION = "1";
const OPEN_LEAD_TIME_MS = 30 * 24 * 60 * 60 * 1000;

const REGION_BY_ADDRESS_PREFIX = new Map([
  ["서울특별시", { slug: "seoul", name: "서울" }],
  ["경기도", { slug: "gyeonggi", name: "경기" }],
  ["인천광역시", { slug: "incheon", name: "인천" }],
  ["경상남도", { slug: "gyeongnam", name: "경남" }]
]);

export function createDiscoveryBackend({ httpError, publicCatalog }) {
  function catalog(db) {
    return publicCatalog(db);
  }

  function publicRegions(db) {
    const currentCatalog = catalog(db);
    const venuesById = new Map(currentCatalog.venues.map((venue) => [venue.id, venue]));
    const regionsBySlug = new Map();
    for (const event of currentCatalog.events) {
      const addressPrefix = venuesById.get(event.venueId)?.address?.split(/\s+/, 1)[0];
      const region = REGION_BY_ADDRESS_PREFIX.get(addressPrefix);
      if (!region) continue;
      const existing = regionsBySlug.get(region.slug) || { ...region, events: [] };
      existing.events.push(event);
      regionsBySlug.set(region.slug, existing);
    }
    return {
      version: DISCOVERY_VERSION,
      regions: [...regionsBySlug.values()]
        .map((region) => ({ ...region, eventCount: region.events.length }))
        .sort((left, right) => left.name.localeCompare(right.name, "ko"))
    };
  }

  function publicArtist(db, requestedSlug) {
    const slug = String(requestedSlug || "").trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw httpError(400, "INVALID_ARTIST_SLUG", "아티스트 식별자를 확인해주세요.");
    }
    const normalizedSlug = normalizeIdentity(slug);
    const events = catalog(db).events.filter((event) => {
      const identities = [event.artistSlug, ...(event.casts || [])]
        .filter(Boolean)
        .map(normalizeIdentity);
      return identities.includes(normalizedSlug);
    });
    if (!events.length) {
      throw httpError(404, "ARTIST_NOT_FOUND", "아티스트 공연을 찾을 수 없습니다.");
    }
    const matchedCast = events
      .flatMap((event) => event.casts || [])
      .find((cast) => normalizeIdentity(cast) === normalizedSlug);
    return {
      version: DISCOVERY_VERSION,
      artist: {
        slug,
        name: matchedCast || events[0].shortTitle || events[0].title
      },
      events
    };
  }

  function publicOpenCalendar(db) {
    const entries = catalog(db).events
      .map((event) => {
        const startsAt = event.dates?.[0]?.startsAt || event.date;
        const startsAtMs = Date.parse(startsAt);
        if (!Number.isFinite(startsAtMs)) return null;
        return {
          opensAt: new Date(startsAtMs - OPEN_LEAD_TIME_MS).toISOString(),
          saleState: event.saleState,
          event
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.opensAt.localeCompare(right.opensAt));
    return { version: DISCOVERY_VERSION, entries };
  }

  return { publicArtist, publicOpenCalendar, publicRegions };
}

function normalizeIdentity(value) {
  return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
