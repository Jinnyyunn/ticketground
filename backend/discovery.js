const DISCOVERY_VERSION = "1";
const OPEN_LEAD_TIME_MS = 30 * 24 * 60 * 60 * 1000;

const REGION_BY_ADDRESS_PREFIX = new Map([
  ["서울특별시", { slug: "seoul", name: "서울" }],
  ["부산광역시", { slug: "busan", name: "부산" }],
  ["대구광역시", { slug: "daegu", name: "대구" }],
  ["경기도", { slug: "gyeonggi", name: "경기" }],
  ["인천광역시", { slug: "incheon", name: "인천" }],
  ["광주광역시", { slug: "gwangju", name: "광주" }],
  ["대전광역시", { slug: "daejeon", name: "대전" }],
  ["울산광역시", { slug: "ulsan", name: "울산" }],
  ["세종특별자치시", { slug: "sejong", name: "세종" }],
  ["강원도", { slug: "gangwon", name: "강원" }],
  ["강원특별자치도", { slug: "gangwon", name: "강원" }],
  ["충청북도", { slug: "chungbuk", name: "충북" }],
  ["충청남도", { slug: "chungnam", name: "충남" }],
  ["전라북도", { slug: "jeonbuk", name: "전북" }],
  ["전북특별자치도", { slug: "jeonbuk", name: "전북" }],
  ["전라남도", { slug: "jeonnam", name: "전남" }],
  ["경상북도", { slug: "gyeongbuk", name: "경북" }],
  ["경상남도", { slug: "gyeongnam", name: "경남" }],
  ["제주도", { slug: "jeju", name: "제주" }],
  ["제주특별자치도", { slug: "jeju", name: "제주" }]
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
      const region = regionForAddress(venuesById.get(event.venueId)?.address);
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
    const slug = String(requestedSlug || "").trim();
    const canonicalSlug = normalizeArtistSlug(slug);
    if (!canonicalSlug || slug.length > 200 || /[\u0000-\u001f\u007f]/u.test(slug)) {
      throw httpError(400, "INVALID_ARTIST_SLUG", "아티스트 식별자를 확인해주세요.");
    }
    const currentEvents = catalog(db).events;
    const exactSlugEvents = currentEvents.filter(
      (event) => normalizeArtistSlug(event.artistSlug) === canonicalSlug
    );
    const normalizedCast = normalizeIdentity(slug);
    const events = exactSlugEvents.length
      ? exactSlugEvents
      : currentEvents.filter((event) =>
          (event.casts || []).some((cast) => normalizeIdentity(cast) === normalizedCast)
        );
    if (!events.length) {
      throw httpError(404, "ARTIST_NOT_FOUND", "아티스트 공연을 찾을 수 없습니다.");
    }
    const matchedCast = events
      .flatMap((event) => event.casts || [])
      .find((cast) => normalizeIdentity(cast) === normalizedCast);
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

function normalizeArtistSlug(value) {
  return String(value || "").trim().normalize("NFKC").toLocaleLowerCase("ko-KR");
}

function regionForAddress(address) {
  const prefix = String(address || "").trim().split(/\s+/, 1)[0];
  if (!prefix) return null;
  const known = REGION_BY_ADDRESS_PREFIX.get(prefix);
  if (known) return known;
  const slug = normalizeIdentity(prefix);
  return slug ? { slug, name: prefix } : null;
}
