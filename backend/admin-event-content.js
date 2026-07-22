export const allowedCategories = ["musical", "concert", "theater", "classic", "sports", "exhibition", "children"];

const allowedSaleStates = ["ON_SALE", "OPEN_SOON", "DISCOUNT_SOON", "ADMIN_HOLD", "CLOSED"];
const legacyCategoryAliases = { festival: "concert" };
const maxArrayItems = {
  casts: 80,
  notices: 20,
  prices: 20,
  schedules: 30,
  timesPerSchedule: 6,
  performances: 60,
  ticketCandidates: 10000
};
const maxFaceValue = 10000000;
const minZoneSeatCount = 1;
const maxZoneSeatCount = 2000;
const defaultZones = [
  { id: "zone_vip", name: "VIP", faceValue: 154000, resaleFeeRate: 0.08, maxTransferCount: 1, seatCount: 12 },
  { id: "zone_r", name: "R석", faceValue: 121000, resaleFeeRate: 0.07, maxTransferCount: 1, seatCount: 12 },
  { id: "zone_s", name: "S석", faceValue: 99000, resaleFeeRate: 0.06, maxTransferCount: 1, seatCount: 12 }
];
const clearableTextKeys = ["shortTitle", "period", "runtime", "artistSlug", "summary"];
export const defaultCheckoutNotice = "티켓 예매 및 결제 전 포트원 다날 휴대폰 본인인증이 필요합니다.";

export function createAdminEventContentBackend({ httpError, money, stableId }) {
  function hasOwn(payload, key) {
    return Object.hasOwn(payload, key);
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function cleanText(value, maxLength) {
    return String(value || "").trim().slice(0, maxLength);
  }

  function optionalText(payload, key, maxLength) {
    if (!hasOwn(payload, key)) return undefined;
    const value = cleanText(payload[key], maxLength);
    return value || undefined;
  }

  function requiredText(value, code, message, maxLength = 120) {
    const clean = cleanText(value, maxLength);
    if (!clean) throw httpError(400, code, message);
    return clean;
  }

  function normalizeCategory(value, fallback = "concert") {
    const rawCategory = String(value || fallback);
    const category = legacyCategoryAliases[rawCategory] || rawCategory;
    if (!allowedCategories.includes(category)) {
      throw httpError(422, "INVALID_EVENT_CATEGORY", "지원하지 않는 행사 유형입니다.");
    }
    return category;
  }

  function normalizeSaleState(value, fallback = "OPEN_SOON") {
    const saleState = String(value || fallback);
    if (!allowedSaleStates.includes(saleState)) {
      throw httpError(422, "INVALID_SALE_STATE", "지원하지 않는 판매 상태입니다.");
    }
    return saleState;
  }

  function normalizeDiscountRate(value) {
    const discountRate = Number(value || 0);
    return Number.isFinite(discountRate) ? Math.max(0, Math.min(90, discountRate)) : 0;
  }

  function isCalendarDate(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day
    );
  }

  function normalizeStartsAt(value) {
    const startsAt = String(value || "");
    if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
      throw httpError(422, "INVALID_EVENT_DATE", "개최 날짜와 시간을 확인해주세요.");
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(startsAt);
    if (match && !isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
      throw httpError(422, "INVALID_EVENT_DATE", "개최 날짜와 시간을 확인해주세요.");
    }
    return startsAt;
  }

  function normalizeAdminEventInput(payload, fallback = {}) {
    const title = requiredText(payload.title ?? fallback.title, "MISSING_FIELD", "행사명을 입력해주세요.");
    return {
      category: normalizeCategory(payload.category ?? fallback.category),
      checkoutNotice: cleanText(payload.checkoutNotice ?? fallback.checkoutNotice ?? "", 200) || defaultCheckoutNotice,
      discountRate: normalizeDiscountRate(payload.discountRate ?? fallback.discountRate),
      organizer: cleanText(payload.organizer ?? fallback.organizer ?? "Ticketground Admin", 80) || "Ticketground Admin",
      saleNote: cleanText(payload.saleNote ?? fallback.saleNote ?? "", 80),
      saleState: normalizeSaleState(payload.saleState ?? fallback.saleState),
      startsAt: normalizeStartsAt(payload.startsAt ?? fallback.date),
      title,
      venueId: payload.venueId ?? fallback.venueId
    };
  }

  function normalizeEventSlug(value, events, currentEventId) {
    const slug = cleanText(value, 120);
    if (!/^[A-Za-z0-9-]+$/.test(slug)) {
      throw httpError(422, "INVALID_EVENT_SLUG", "슬러그는 영문, 숫자, 하이픈만 사용할 수 있습니다.");
    }
    if (events.some((event) => event.id !== currentEventId && event.slug === slug)) {
      throw httpError(409, "EVENT_SLUG_EXISTS", "이미 사용 중인 공연 슬러그입니다.");
    }
    return slug;
  }

  function zoneSlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function resaleFeeRateForIndex(index) {
    if (index === 0) return 0.08;
    if (index === 1) return 0.07;
    return 0.06;
  }

  function priceRowsFromZones(zones) {
    return zones.map((zone) => ({
      grade: zone.name.replace(/석$/, ""),
      seat: zone.name,
      price: zone.faceValue
    }));
  }

  function requiredStringField(record, key, code, message, maxLength) {
    if (typeof record[key] !== "string") throw httpError(422, code, message);
    return requiredText(record[key], code, message, maxLength);
  }

  function normalizeFaceValue(value, label) {
    const faceValue = money(value);
    if (!Number.isFinite(faceValue) || faceValue <= 0 || faceValue > maxFaceValue) {
      throw httpError(422, "INVALID_ZONE_PRICE", `${label} 가격을 확인해주세요.`);
    }
    return faceValue;
  }

  function normalizeSeatCount(value, fallback = 12) {
    const seatCount = Number(value ?? fallback);
    if (!Number.isInteger(seatCount) || seatCount < minZoneSeatCount || seatCount > maxZoneSeatCount) {
      throw httpError(422, "INVALID_ZONE_SEAT_COUNT", "구역별 판매 좌석 수는 1~2000 사이로 입력해주세요.");
    }
    return seatCount;
  }

  function canonicalPriceRow(price) {
    if (!isPlainObject(price)) throw httpError(422, "INVALID_ZONE_PRICE", "좌석 가격 정보를 확인해주세요.");
    const grade = requiredStringField(price, "grade", "INVALID_ZONE_GRADE", "좌석 등급을 확인해주세요.", 40);
    const seat = requiredStringField(price, "seat", "INVALID_ZONE_SEAT", "좌석명을 확인해주세요.", 60);
    return {
      grade,
      seat,
      price: normalizeFaceValue(price.price, seat),
      seatCount: normalizeSeatCount(price.seatCount)
    };
  }

  function zoneIdForPrice(price, duplicateGrades) {
    const slug = zoneSlug(price.grade);
    if (!slug) throw httpError(422, "INVALID_ZONE_GRADE", "좌석 등급은 영문 또는 숫자를 포함해야 합니다.");
    if (duplicateGrades.get(price.grade) === 1) return `zone_${slug}`;
    const seatSlug = zoneSlug(price.seat);
    const identity = seatSlug || stableId("zone", price.grade, price.seat).replace(/^zone_/, "");
    return `zone_${slug}-${identity}`;
  }

  function zoneFromPrice(price, index, duplicateGrades, seenZoneIds) {
    const id = zoneIdForPrice(price, duplicateGrades);
    if (seenZoneIds.has(id)) throw httpError(422, "DUPLICATE_ZONE_GRADE", "중복된 좌석 등급과 좌석명이 있습니다.");
    seenZoneIds.add(id);
    return {
      price,
      id,
      name: price.seat,
      faceValue: price.price,
      resaleFeeRate: resaleFeeRateForIndex(index),
      maxTransferCount: 1,
      seatCount: price.seatCount
    };
  }

  function zonesFromPriceArray(prices) {
    if (!prices.length) throw httpError(422, "INVALID_ZONE_PRICE", "좌석 가격을 하나 이상 입력해주세요.");
    if (prices.length > maxArrayItems.prices) {
      throw httpError(422, "EVENT_INVENTORY_TOO_LARGE", "좌석 등급은 20개 이하로 등록해주세요.");
    }
    const parsedPrices = prices.map(canonicalPriceRow);
    const duplicateGrades = parsedPrices.reduce((acc, price) => {
      acc.set(price.grade, (acc.get(price.grade) || 0) + 1);
      return acc;
    }, new Map());
    const seenZoneIds = new Set();
    const zones = parsedPrices.map((price, index) => zoneFromPrice(price, index, duplicateGrades, seenZoneIds));
    return {
      prices: parsedPrices.map((price) => ({ grade: price.grade, seat: price.seat, price: price.price })),
      zones: zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        faceValue: zone.faceValue,
        resaleFeeRate: zone.resaleFeeRate,
        maxTransferCount: zone.maxTransferCount,
        seatCount: zone.seatCount
      }))
    };
  }

  function zonesFromLegacyPriceMap(prices, existingZones, seatCounts) {
    const priceMap = prices && typeof prices === "object" && !Array.isArray(prices) ? prices : {};
    const seatCountMap = seatCounts && typeof seatCounts === "object" && !Array.isArray(seatCounts) ? seatCounts : {};
    const zones = (existingZones || defaultZones).map((zone) => ({
      ...zone,
      faceValue: normalizeFaceValue(priceMap[zone.id] ?? zone.faceValue, zone.name),
      seatCount: normalizeSeatCount(seatCountMap[zone.id] ?? zone.seatCount)
    }));
    return { prices: priceRowsFromZones(zones), zones };
  }

  function normalizePrices(prices, existingZones, seatCounts) {
    if (Array.isArray(prices)) return zonesFromPriceArray(prices);
    return zonesFromLegacyPriceMap(prices, existingZones, seatCounts);
  }

  function normalizeScheduleDate(value) {
    const text = cleanText(value, 20);
    const match = /^(\d{4})[.-](\d{2})[.-](\d{2})$/.exec(text);
    if (!match) throw httpError(422, "INVALID_EVENT_SCHEDULE", "공연 일정을 확인해주세요.");
    const date = `${match[1]}-${match[2]}-${match[3]}`;
    if (!isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
      throw httpError(422, "INVALID_EVENT_SCHEDULE", "공연 일정을 확인해주세요.");
    }
    return date;
  }

  function normalizeScheduleTime(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(cleanText(value, 10));
    if (!match) throw httpError(422, "INVALID_EVENT_SCHEDULE", "공연 시간을 확인해주세요.");
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) throw httpError(422, "INVALID_EVENT_SCHEDULE", "공연 시간을 확인해주세요.");
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function normalizeSchedules(schedules) {
    if (!Array.isArray(schedules) || !schedules.length) {
      throw httpError(422, "INVALID_EVENT_SCHEDULE", "공연 일정을 하나 이상 입력해주세요.");
    }
    if (schedules.length > maxArrayItems.schedules) {
      throw httpError(422, "EVENT_INVENTORY_TOO_LARGE", "공연 일정은 30개 이하로 등록해주세요.");
    }

    const seenDateTimes = new Set();
    const normalized = [];
    let performanceCount = 0;
    for (const schedule of schedules) {
      if (!isPlainObject(schedule)) throw httpError(422, "INVALID_EVENT_SCHEDULE", "공연 일정을 확인해주세요.");
      const label = requiredStringField(schedule, "label", "INVALID_EVENT_SCHEDULE", "공연 회차명을 확인해주세요.", 60);
      const date = requiredStringField(schedule, "date", "INVALID_EVENT_SCHEDULE", "공연 일정을 확인해주세요.", 20);
      const canonicalDate = normalizeScheduleDate(date);
      if (!Array.isArray(schedule.times) || !schedule.times.length) {
        throw httpError(422, "INVALID_EVENT_SCHEDULE", "공연 시간을 하나 이상 입력해주세요.");
      }
      if (schedule.times.length > maxArrayItems.timesPerSchedule) {
        throw httpError(422, "EVENT_INVENTORY_TOO_LARGE", "회차별 공연 시간은 6개 이하로 등록해주세요.");
      }

      const times = [];
      for (const rawTime of schedule.times) {
        if (typeof rawTime !== "string") throw httpError(422, "INVALID_EVENT_SCHEDULE", "공연 시간을 확인해주세요.");
        const time = normalizeScheduleTime(rawTime);
        const key = `${canonicalDate}T${time}`;
        if (seenDateTimes.has(key)) continue;
        seenDateTimes.add(key);
        times.push(time);
      }
      if (!times.length) continue;

      performanceCount += times.length;
      if (performanceCount > maxArrayItems.performances) {
        throw httpError(422, "EVENT_INVENTORY_TOO_LARGE", "공연 회차는 60개 이하로 등록해주세요.");
      }
      normalized.push({ label, date, times });
    }
    if (!normalized.length) throw httpError(422, "INVALID_EVENT_SCHEDULE", "공연 일정을 하나 이상 입력해주세요.");
    return normalized;
  }

  function datesFromSchedules(eventId, schedules) {
    return schedules.flatMap((schedule) => {
      const date = normalizeScheduleDate(schedule.date);
      return schedule.times.map((time) => ({
        id: stableId("perf", eventId, date, time),
        startsAt: `${date}T${time}:00+09:00`,
        label: schedule.times.length === 1 ? schedule.label : `${schedule.label} ${time}`
      }));
    });
  }

  function defaultDate(eventId, startsAt) {
    return [{ id: stableId("perf", eventId, startsAt), startsAt, label: "1회차" }];
  }

  function durationMinutesFromRuntime(runtime, fallback = 120) {
    const match = /(\d+)/.exec(String(runtime || ""));
    const value = match ? Number(match[1]) : Number(fallback);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 120;
  }

  function normalizePinnedRank(value) {
    if (value === null) return null;
    const rank = Number(value);
    if (!Number.isInteger(rank) || rank < 1 || rank > 10) {
      throw httpError(422, "INVALID_PINNED_RANK", "고정 랭킹은 1~10 사이로 입력해주세요.");
    }
    return rank;
  }

  function arrayOfText(payload, key, maxLength) {
    if (!hasOwn(payload, key)) return undefined;
    if (!Array.isArray(payload[key])) throw httpError(422, "INVALID_EVENT_CONTENT", `${key} 값을 확인해주세요.`);
    if (payload[key].length > maxArrayItems[key]) {
      throw httpError(422, "INVALID_EVENT_CONTENT", `${key} 항목이 너무 많습니다.`);
    }
    return payload[key].map((value) => {
      if (typeof value !== "string") throw httpError(422, "INVALID_EVENT_CONTENT", `${key} 값을 확인해주세요.`);
      return cleanText(value, maxLength);
    }).filter(Boolean);
  }

  function assertInventorySize(zones, dates) {
    if (!zones || !dates) return;
    const projectedCandidates = zones.reduce((sum, zone) => sum + normalizeSeatCount(zone.seatCount), 0) * dates.length;
    if (projectedCandidates > maxArrayItems.ticketCandidates) {
      throw httpError(422, "EVENT_INVENTORY_TOO_LARGE", "좌석 등급과 공연 회차가 너무 많습니다.");
    }
  }

  function normalizeContent(payload, { event, eventId, events, startsAt }) {
    const content = {};
    for (const key of clearableTextKeys) {
      const value = optionalText(payload, key, key === "summary" ? 400 : 120);
      if (hasOwn(payload, key)) content[key] = value;
    }

    content.badge = hasOwn(payload, "badge") ? cleanText(payload.badge, 40) || undefined : event?.badge || undefined;
    content.ageLimit = hasOwn(payload, "ageLimit") ? cleanText(payload.ageLimit, 60) || "전체 관람" : event?.ageLimit || "전체 관람";
    if (hasOwn(payload, "runtime")) {
      content.durationMinutes = durationMinutesFromRuntime(content.runtime, event?.durationMinutes || 120);
    } else if (!event) {
      content.durationMinutes = 120;
    }

    if (hasOwn(payload, "slug")) {
      content.slug = normalizeEventSlug(payload.slug, events, event?.id);
    } else if (!event) {
      content.slug = `admin-${eventId}`;
    }
    if (hasOwn(payload, "prices") || hasOwn(payload, "seatCounts") || !event) {
      Object.assign(content, normalizePrices(payload.prices, event?.zones, payload.seatCounts));
    }
    if (hasOwn(payload, "schedules")) {
      const schedules = normalizeSchedules(payload.schedules);
      content.schedules = schedules;
      content.dates = datesFromSchedules(eventId, schedules);
      content.date = content.dates[0].startsAt;
    } else if (!event) {
      content.dates = defaultDate(eventId, startsAt);
      content.date = startsAt;
    }

    const casts = arrayOfText(payload, "casts", 60);
    const notices = arrayOfText(payload, "notices", 160);
    if (casts) content.casts = casts;
    if (notices) content.notices = notices;
    if (hasOwn(payload, "pinnedRank")) content.pinnedRank = normalizePinnedRank(payload.pinnedRank);
    if (content.zones && content.dates) assertInventorySize(content.zones, content.dates);
    return content;
  }

  return {
    allowedCategories,
    allowedSaleStates,
    assertInventorySize,
    normalizeAdminEventInput,
    normalizeCreateEventContent: (payload, context) => normalizeContent(payload, context),
    normalizeUpdateEventContent: (payload, context) => normalizeContent(payload, context)
  };
}
