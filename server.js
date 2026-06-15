import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const adminDir = path.join(__dirname, "admin");
const seatMapDir = path.join(__dirname, "좌석 도면");
const jamsilOlympicSeatMapDir = path.join(seatMapDir, "잠실 올림픽 경기장");
const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "db.json");
const PORT = Number(process.env.PORT || 4173);
const ADMIN_PORT = Number(process.env.ADMIN_PORT || 50084);
const SECRET = process.env.TIG_SECRET || "local-dev-secret-change-me";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

const PAYMENT_METHODS = {
  BALANCE: { label: "충전금", requiresBalance: true, status: "PAID" },
  CREDIT_CARD: { label: "신용카드", requiresBalance: false, status: "PAID" },
  BANK_TRANSFER: { label: "계좌이체", requiresBalance: false, status: "PAID" },
  BANK_DEPOSIT: { label: "무통장 입금", requiresBalance: false, status: "WAITING_DEPOSIT" },
  MOBILE: { label: "휴대폰 결제", requiresBalance: false, status: "PAID" }
};

const JAMSIL_OLYMPIC_STADIUM_IMAGE = "/assets/jamsil-olympic-main-stadium.svg";

function now() {
  return new Date().toISOString();
}

function money(value) {
  return Math.round(Number(value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resolvePaymentMethod(paymentMethod = "BALANCE") {
  const key = String(paymentMethod || "BALANCE").toUpperCase();
  const method = PAYMENT_METHODS[key];
  if (!method) throw httpError(422, "UNSUPPORTED_PAYMENT_METHOD", "지원하지 않는 결제수단입니다.");
  return { key, ...method };
}

function hash(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hmac(input) {
  return crypto.createHmac("sha256", SECRET).update(input).digest("hex");
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
}

function stableId(prefix, ...parts) {
  return `${prefix}_${hash(parts.join(":")) .slice(0, 12)}`;
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = sortJson(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function zoneBlueprints(overrides = {}) {
  return [
    { id: "zone_vip", name: "VIP", faceValue: overrides.vip ?? 154000, resaleFeeRate: 0.08, maxTransferCount: 1 },
    { id: "zone_r", name: "R석", faceValue: overrides.r ?? 121000, resaleFeeRate: 0.07, maxTransferCount: 1 },
    { id: "zone_s", name: "S석", faceValue: overrides.s ?? 99000, resaleFeeRate: 0.06, maxTransferCount: 1 }
  ];
}

function venueBlueprints() {
  return [
    {
      id: "venue_jamsil_olympic",
      name: "잠실 올림픽 주 경기장",
      address: "서울특별시 송파구 올림픽로 25",
      map: {
        type: "olympic-stadium",
        imageUrl: JAMSIL_OLYMPIC_STADIUM_IMAGE,
        imageSource: "서울종합운동장 좌석 도면",
        stage: "MAIN STAGE / FIELD",
        helper: "잠실 올림픽 주 경기장 도면 기반 좌석 선택",
        labels: [
          { text: "VIP FLOOR", x: 50, y: 63 },
          { text: "R 1층 좌측", x: 24, y: 48 },
          { text: "R 1층 우측", x: 76, y: 48 },
          { text: "S 상단 관람석", x: 50, y: 24 }
        ]
      }
    },
    {
      id: "venue_kspo_dome",
      name: "KSPO Dome",
      address: "서울특별시 송파구 올림픽로 424",
      map: {
        type: "arena",
        imageUrl: "",
        imageSource: "Ticketground 기본 아레나 도면",
        stage: "CENTER STAGE",
        helper: "콘서트형 아레나 좌석 배치도",
        labels: [
          { text: "VIP FLOOR", x: 50, y: 37 },
          { text: "R SIDE", x: 25, y: 58 },
          { text: "S UPPER", x: 75, y: 70 }
        ]
      }
    },
    {
      id: "venue_bluesquare",
      name: "블루스퀘어",
      address: "서울특별시 용산구 이태원로 294",
      map: {
        type: "theater",
        imageUrl: "",
        imageSource: "Ticketground 기본 극장 도면",
        stage: "PROSCENIUM STAGE",
        helper: "뮤지컬형 극장 좌석 배치도",
        labels: [
          { text: "VIP ORCHESTRA", x: 50, y: 40 },
          { text: "R MEZZANINE", x: 50, y: 58 },
          { text: "S BALCONY", x: 50, y: 75 }
        ]
      }
    },
    {
      id: "venue_nanjipark",
      name: "난지한강공원",
      address: "서울특별시 마포구 한강난지로 162",
      map: {
        type: "festival",
        imageUrl: "",
        imageSource: "Ticketground 기본 페스티벌 도면",
        stage: "MAIN STAGE",
        helper: "페스티벌형 스탠딩/지정석 혼합 배치도",
        labels: [
          { text: "FRONT PASS", x: 50, y: 36 },
          { text: "PICNIC R", x: 32, y: 61 },
          { text: "LAWN S", x: 68, y: 72 }
        ]
      }
    }
  ];
}

function eventBlueprints() {
  return [
    {
      id: "event_kpop_001",
      category: "concert",
      title: "TIG Live: Neon Stage",
      venueId: "venue_jamsil_olympic",
      venue: "잠실 올림픽 주 경기장",
      date: "2026-09-19T19:00:00+09:00",
      dates: [
        { id: "perf_kpop_20260919_1900", startsAt: "2026-09-19T19:00:00+09:00", label: "1회차" },
        { id: "perf_kpop_20260920_1800", startsAt: "2026-09-20T18:00:00+09:00", label: "2회차" }
      ],
      organizer: "TIG Entertainment",
      image: "/assets/neon-stage-hero.png",
      badge: "K-POP · 단독 판매",
      durationMinutes: 120,
      ageLimit: "8세 이상",
      rating: "4.8",
      zones: zoneBlueprints()
    },
    {
      id: "event_musical_001",
      category: "musical",
      title: "Midnight Sonata",
      venueId: "venue_bluesquare",
      venue: "블루스퀘어",
      date: "2026-11-02T19:30:00+09:00",
      dates: [
        { id: "perf_musical_20261102_1930", startsAt: "2026-11-02T19:30:00+09:00", label: "월요일" },
        { id: "perf_musical_20261103_1930", startsAt: "2026-11-03T19:30:00+09:00", label: "화요일" },
        { id: "perf_musical_20261107_1500", startsAt: "2026-11-07T15:00:00+09:00", label: "토요일 낮" }
      ],
      organizer: "Blue Stage Company",
      image: "/assets/neon-stage-hero.png",
      badge: "뮤지컬 · VIP/R/S",
      durationMinutes: 145,
      ageLimit: "12세 이상",
      rating: "4.7",
      zones: zoneBlueprints({ vip: 132000, r: 110000, s: 88000 })
    },
    {
      id: "event_sports_001",
      category: "sports",
      title: "Seoul Tigers vs Busan Waves",
      venueId: "venue_jamsil_olympic",
      venue: "잠실 올림픽 주 경기장",
      date: "2026-08-14T18:30:00+09:00",
      dates: [
        { id: "perf_sports_20260814_1830", startsAt: "2026-08-14T18:30:00+09:00", label: "금요일 경기" },
        { id: "perf_sports_20260815_1700", startsAt: "2026-08-15T17:00:00+09:00", label: "토요일 경기" }
      ],
      organizer: "Seoul Tigers",
      image: "/assets/neon-stage-hero.png",
      badge: "스포츠 · 공식 판매",
      durationMinutes: 180,
      ageLimit: "전체 관람",
      rating: "4.6",
      zones: zoneBlueprints({ vip: 88000, r: 66000, s: 44000 })
    },
    {
      id: "event_festival_001",
      category: "festival",
      title: "Tig Summer Beat Festival",
      venueId: "venue_nanjipark",
      venue: "난지한강공원",
      date: "2026-07-25T14:00:00+09:00",
      dates: [
        { id: "perf_festival_20260725_1400", startsAt: "2026-07-25T14:00:00+09:00", label: "1일권" },
        { id: "perf_festival_20260726_1400", startsAt: "2026-07-26T14:00:00+09:00", label: "2일차" }
      ],
      organizer: "TIG Festival",
      image: "/assets/neon-stage-hero.png",
      badge: "페스티벌 · 1일권/양일권",
      durationMinutes: 420,
      ageLimit: "전체 관람",
      rating: "4.5",
      zones: zoneBlueprints({ vip: 119000, r: 89000, s: 69000 })
    }
  ];
}

function addSeat(seats, zoneId, prefix, number, x, y, section) {
  seats.push({
    zoneId,
    seatLabel: `${prefix}-${String(number).padStart(2, "0")}`,
    number,
    x: Number(x.toFixed(2)),
    y: Number(y.toFixed(2)),
    section
  });
}

function addGridSeats(seats, zoneId, prefix, startNumber, rows, cols, startX, startY, gapX, gapY, section) {
  let number = startNumber;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      addSeat(seats, zoneId, prefix, number, startX + col * gapX, startY + row * gapY, section);
      number += 1;
    }
  }
  return number;
}

function buildOlympicMainSeats() {
  const seats = [];
  addGridSeats(seats, "zone_vip", "VIP", 1, 3, 8, 34, 58, 4.6, 5.2, "필드 중앙 VIP");
  addGridSeats(seats, "zone_r", "R석", 1, 4, 5, 17, 38, 4.1, 6.1, "1층 좌측 R");
  addGridSeats(seats, "zone_r", "R석", 21, 4, 5, 66, 38, 4.1, 6.1, "1층 우측 R");
  addGridSeats(seats, "zone_s", "S석", 1, 4, 12, 20, 18, 5.4, 4.1, "상단 S 관람석");
  return seats;
}

function buildArenaSeats() {
  const seats = [];
  addGridSeats(seats, "zone_vip", "VIP", 1, 3, 8, 33, 39, 4.8, 5.5, "플로어 VIP");
  addGridSeats(seats, "zone_r", "R석", 1, 4, 10, 27, 58, 5.1, 4.3, "아레나 R");
  addGridSeats(seats, "zone_s", "S석", 1, 4, 12, 19, 73, 5.4, 3.8, "상단 S");
  return seats;
}

function buildTheaterSeats() {
  const seats = [];
  addGridSeats(seats, "zone_vip", "VIP", 1, 3, 8, 33, 38, 4.8, 5.2, "오케스트라 VIP");
  addGridSeats(seats, "zone_r", "R석", 1, 4, 10, 25, 56, 5.5, 4.7, "메자닌 R");
  addGridSeats(seats, "zone_s", "S석", 1, 4, 12, 18, 74, 5.6, 3.9, "발코니 S");
  return seats;
}

function buildFestivalSeats() {
  const seats = [];
  addGridSeats(seats, "zone_vip", "VIP", 1, 3, 8, 33, 36, 4.8, 5.5, "프론트 패스");
  addGridSeats(seats, "zone_r", "R석", 1, 4, 10, 25, 57, 5.5, 4.8, "피크닉 R");
  addGridSeats(seats, "zone_s", "S석", 1, 4, 12, 18, 75, 5.6, 3.9, "잔디 S");
  return seats;
}

function seatLayoutForVenue(venueId) {
  if (venueId === "venue_jamsil_olympic") return buildOlympicMainSeats();
  if (venueId === "venue_bluesquare") return buildTheaterSeats();
  if (venueId === "venue_nanjipark") return buildFestivalSeats();
  return buildArenaSeats();
}

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

function normalizeDb(db) {
  let changed = false;
  db.users ||= [];
  db.events ||= [];
  db.tickets ||= [];
  db.resalePools ||= [];
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
    ticket.issuedAt ||= now();
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

function publicState(db) {
  return {
    events: db.events,
    venues: db.venues.map(({ id, name, address, map }) => ({
      id,
      name,
      address,
      mapType: map?.type,
      imageUrl: map?.imageUrl || ""
    })),
    users: db.users.map(({ id, name, balance, status, trustScore, sanctions }) => ({
      id,
      name,
      balance,
      status,
      trustScore,
      sanctions
    })),
    tickets: db.tickets,
    resalePools: db.resalePools,
    ledger: {
      totalEntries: db.ledger.length,
      latestHash: db.ledger.at(-1)?.hash || null,
      verified: verifyLedger(db).ok
    }
  };
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
    ledger: []
  };
  for (const event of db.events) ensureTicketsForEvent(db, event);
  appendLedger(db, "SYSTEM", "BOOTSTRAP", { message: "Initial event, venue map and ticket minting snapshot" });
  return db;
}

async function loadDb() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(dbPath)) {
    const db = seedDb();
    await saveDb(db);
    return db;
  }
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  if (normalizeDb(db)) await saveDb(db);
  return db;
}

async function saveDb(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
}

function appendLedger(db, actorId, action, payload) {
  const previousHash = db.ledger.at(-1)?.hash || "GENESIS";
  const entry = {
    index: db.ledger.length,
    at: now(),
    actorId,
    action,
    payload: sortJson(payload),
    previousHash
  };
  entry.hash = hash(JSON.stringify(entry));
  db.ledger.push(entry);
  return entry;
}

function verifyLedger(db) {
  let previousHash = "GENESIS";
  for (const entry of db.ledger) {
    const copy = { ...entry };
    delete copy.hash;
    if (entry.previousHash !== previousHash) {
      return { ok: false, reason: `Broken previousHash at ledger index ${entry.index}` };
    }
    if (hash(JSON.stringify(copy)) !== entry.hash) {
      return { ok: false, reason: `Hash mismatch at ledger index ${entry.index}` };
    }
    previousHash = entry.hash;
  }
  return { ok: true };
}

function findUser(db, userId) {
  const user = db.users.find((item) => item.id === userId);
  if (!user) throw httpError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
  if (user.status === "BANNED") throw httpError(403, "USER_BANNED", "제재된 사용자는 거래할 수 없습니다.");
  return user;
}

function httpError(status, code, message, detail = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.detail = detail;
  return error;
}

function requireBody(body, keys) {
  for (const key of keys) {
    if (body[key] === undefined || body[key] === "") {
      throw httpError(400, "MISSING_FIELD", `${key} 값이 필요합니다.`);
    }
  }
}

function buyPrimary(db, { userId, ticketId, paymentMethod }) {
  const user = findUser(db, userId);
  const ticket = db.tickets.find((item) => item.id === ticketId);
  const payment = resolvePaymentMethod(paymentMethod);
  if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
  if (ticket.status !== "ON_SALE") throw httpError(409, "TICKET_NOT_AVAILABLE", "구매 가능한 티켓이 아닙니다.");
  const { event, zone } = eventZone(db, ticket.eventId, ticket.zoneId);
  const performanceDate = eventDate(event, ticket.performanceDateId);
  if (payment.requiresBalance && user.balance < ticket.faceValue) {
    throw httpError(402, "INSUFFICIENT_BALANCE", "충전금이 부족합니다. 다른 결제수단을 선택해주세요.");
  }

  if (payment.requiresBalance) user.balance -= ticket.faceValue;
  ticket.ownerId = user.id;
  ticket.status = "OWNED";
  appendLedger(db, user.id, "PRIMARY_PURCHASE", {
    ticketId: ticket.id,
    eventId: event.id,
    performanceDateId: performanceDate.id,
    seatLabel: ticket.seatLabel,
    zone: zone.name,
    price: ticket.faceValue,
    paymentMethod: payment.key,
    paymentLabel: payment.label,
    paymentStatus: payment.status,
    approvalId: `${payment.key}-${id("pay").toUpperCase()}`,
    policy: "date-selected-seat-owner-assignment"
  });
  return { user, ticket, event, performanceDate, payment };
}

function listForResale(db, { sellerId, ticketId, price }) {
  const seller = findUser(db, sellerId);
  const ticket = db.tickets.find((item) => item.id === ticketId);
  if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
  if (ticket.ownerId !== seller.id) throw httpError(403, "NOT_OWNER", "소유자만 재판매 등록할 수 있습니다.");
  if (ticket.status !== "OWNED") throw httpError(409, "INVALID_TICKET_STATE", "보유 중인 티켓만 등록할 수 있습니다.");
  if (ticket.transferCount >= ticket.maxTransferCount) {
    throw httpError(409, "TRANSFER_LIMIT_REACHED", "양도 가능 횟수를 초과했습니다.");
  }

  const resalePrice = money(price);
  if (resalePrice < ticket.minPrice || resalePrice > ticket.maxPrice) {
    throw httpError(422, "PRICE_OUT_OF_POLICY", "가격 정책 범위를 벗어났습니다.", {
      minPrice: ticket.minPrice,
      maxPrice: ticket.maxPrice
    });
  }

  const pool = {
    id: id("pool"),
    eventId: ticket.eventId,
    performanceDateId: ticket.performanceDateId,
    zoneId: ticket.zoneId,
    ticketId: ticket.id,
    sellerId: seller.id,
    price: resalePrice,
    buyers: [],
    status: "OPEN",
    createdAt: now()
  };
  ticket.status = "IN_RESALE_POOL";
  db.resalePools.push(pool);
  appendLedger(db, seller.id, "RESALE_LISTED", {
    poolId: pool.id,
    ticketId: ticket.id,
    price: resalePrice,
    rule: "no-directed-transfer"
  });
  return pool;
}

function joinPool(db, { buyerId, poolId }) {
  const buyer = findUser(db, buyerId);
  const pool = db.resalePools.find((item) => item.id === poolId);
  if (!pool) throw httpError(404, "POOL_NOT_FOUND", "재판매 풀을 찾을 수 없습니다.");
  if (pool.status !== "OPEN") throw httpError(409, "POOL_CLOSED", "이미 종료된 풀입니다.");
  if (pool.sellerId === buyer.id) throw httpError(409, "SELF_PURCHASE_BLOCKED", "본인 티켓은 구매 대기할 수 없습니다.");
  if (buyer.balance < pool.price) throw httpError(402, "INSUFFICIENT_BALANCE", "충전금이 부족합니다.");
  if (!pool.buyers.includes(buyer.id)) pool.buyers.push(buyer.id);

  appendLedger(db, buyer.id, "POOL_JOINED", {
    poolId: pool.id,
    zoneId: pool.zoneId,
    policy: "buyer-hidden-random-queue"
  });
  return pool;
}

function drawPool(db, { poolId }) {
  const pool = db.resalePools.find((item) => item.id === poolId);
  if (!pool) throw httpError(404, "POOL_NOT_FOUND", "재판매 풀을 찾을 수 없습니다.");
  if (pool.status !== "OPEN") throw httpError(409, "POOL_CLOSED", "이미 종료된 풀입니다.");
  if (pool.buyers.length === 0) throw httpError(409, "EMPTY_POOL", "대기자가 없습니다.");

  const seed = hmac(`${pool.id}:${pool.buyers.join(",")}:${Date.now()}`);
  const winnerIndex = Number.parseInt(seed.slice(0, 8), 16) % pool.buyers.length;
  const winnerId = pool.buyers[winnerIndex];
  const buyer = findUser(db, winnerId);
  const seller = findUser(db, pool.sellerId);
  const ticket = db.tickets.find((item) => item.id === pool.ticketId);
  const fee = Math.ceil(pool.price * 0.08);

  if (buyer.balance < pool.price + fee) {
    pool.buyers = pool.buyers.filter((idValue) => idValue !== winnerId);
    appendLedger(db, winnerId, "MATCH_SKIPPED_INSUFFICIENT_BALANCE", { poolId: pool.id });
    return { pool, skipped: winnerId };
  }

  buyer.balance -= pool.price + fee;
  seller.balance += pool.price;
  ticket.ownerId = buyer.id;
  ticket.transferCount += 1;
  ticket.status = "OWNED";
  ticket.currentQr = null;
  pool.status = "MATCHED";
  pool.winnerId = buyer.id;
  pool.matchedAt = now();

  appendLedger(db, "SYSTEM", "RANDOM_RESALE_MATCHED", {
    poolId: pool.id,
    ticketId: ticket.id,
    sellerId: seller.id,
    buyerId: buyer.id,
    price: pool.price,
    buyerFee: fee,
    randomSeedCommitment: seed,
    policy: "zone-pool-random-assignment"
  });
  return { pool, ticket, buyer, seller, fee };
}

function directTransferAttempt(db, { actorId, ticketId, targetUserId, offeredPrice }) {
  const actor = findUser(db, actorId);
  const ticket = db.tickets.find((item) => item.id === ticketId);
  if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");

  actor.trustScore = Math.max(0, actor.trustScore - 18);
  actor.status = actor.trustScore < 40 ? "WATCHLIST" : actor.status;
  actor.sanctions.push({
    id: id("sanction"),
    reason: "지정 양도 시도",
    penalty: "trust-score-minus-18",
    at: now()
  });
  appendLedger(db, actor.id, "DIRECT_TRANSFER_BLOCKED", {
    ticketId,
    targetUserId,
    offeredPrice,
    reason: "missing-platform-approval-signature"
  });
  return { blocked: true, user: actor, ticket };
}

function issueQr(db, { userId, ticketId }) {
  const user = findUser(db, userId);
  const ticket = db.tickets.find((item) => item.id === ticketId);
  if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
  if (ticket.ownerId !== user.id) throw httpError(403, "NOT_OWNER", "소유자만 입장 QR을 발급할 수 있습니다.");
  if (ticket.status !== "OWNED") throw httpError(409, "INVALID_TICKET_STATE", "입장 가능한 티켓 상태가 아닙니다.");

  const expiresAt = new Date(Date.now() + 20_000).toISOString();
  const nonce = crypto.randomBytes(8).toString("hex");
  const signature = hmac(`${ticket.id}:${user.id}:${expiresAt}:${nonce}`);
  ticket.currentQr = { nonce, expiresAt, signature, issuedAt: now() };
  appendLedger(db, user.id, "DYNAMIC_QR_ISSUED", {
    ticketId: ticket.id,
    expiresAt,
    ttlSeconds: 20
  });
  return { ticketId: ticket.id, ownerId: user.id, expiresAt, nonce, signature };
}

function verifyQr(db, { ticketId, ownerId, expiresAt, nonce, signature }) {
  const expected = hmac(`${ticketId}:${ownerId}:${expiresAt}:${nonce}`);
  const ticket = db.tickets.find((item) => item.id === ticketId);
  const valid = Boolean(ticket)
    && ticket.ownerId === ownerId
    && ticket.currentQr?.signature === signature
    && signature === expected
    && Date.parse(expiresAt) > Date.now();

  appendLedger(db, ownerId || "GATE", valid ? "GATE_QR_ACCEPTED" : "GATE_QR_REJECTED", {
    ticketId,
    reason: valid ? "valid-dynamic-token" : "invalid-or-expired-token"
  });
  return { valid };
}

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
  return {
    stats: {
      totalTickets: db.tickets.length,
      onSaleTickets: db.tickets.filter((ticket) => ticket.status === "ON_SALE").length,
      ownedTickets: db.tickets.filter((ticket) => ticket.status === "OWNED").length,
      resalePools: openPools.length,
      watchUsers: watchUsers.length,
      ledgerEntries: db.ledger.length,
      ledgerVerified: ledgerCheck.ok
    },
    event: db.events[0],
    users: db.users,
    tickets: db.tickets,
    resalePools: db.resalePools,
    ledger: db.ledger.slice(-12).reverse(),
    ledgerCheck
  };
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

function seatMap(db, { category, venueId }) {
  const event = db.events[0];
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

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw httpError(400, "BAD_JSON", "JSON 본문을 확인해주세요.");
  }
}

async function handleApi(req, res, db) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const body = req.method === "POST" ? await parseBody(req) : {};
  const seatMapMatch = url.pathname.match(/^\/api\/events\/([^/]+)\/seat-map$/);

  if (req.method === "GET" && url.pathname === "/api/state") return publicState(db);
  if (req.method === "GET" && url.pathname === "/api/ledger/verify") return verifyLedger(db);
  if (req.method === "GET" && url.pathname === "/api/ledger") return db.ledger.slice(-30).reverse();
  if (req.method === "GET" && url.pathname === "/api/admin/summary") return adminSummary(db);
  if (req.method === "GET" && url.pathname === "/api/admin/venues") return adminVenues(db);
  if (req.method === "GET" && url.pathname === "/api/seat-map") {
    return seatMap(db, {
      category: url.searchParams.get("category"),
      venueId: url.searchParams.get("venueId")
    });
  }
  if (req.method === "GET" && seatMapMatch) return venueMapForEvent(db, decodeURIComponent(seatMapMatch[1]));

  if (req.method === "POST" && url.pathname === "/api/tickets/buy") {
    requireBody(body, ["userId", "ticketId"]);
    return buyPrimary(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/resale/list") {
    requireBody(body, ["sellerId", "ticketId", "price"]);
    return listForResale(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/resale/join") {
    requireBody(body, ["buyerId", "poolId"]);
    return joinPool(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/resale/draw") {
    requireBody(body, ["poolId"]);
    return drawPool(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/security/direct-transfer-attempt") {
    requireBody(body, ["actorId", "ticketId", "targetUserId"]);
    return directTransferAttempt(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/tickets/qr") {
    requireBody(body, ["userId", "ticketId"]);
    return issueQr(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/gate/verify") {
    requireBody(body, ["ticketId", "ownerId", "expiresAt", "nonce", "signature"]);
    return verifyQr(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/events/venue") {
    requireBody(body, ["eventId", "venueId"]);
    return updateEventVenue(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/users/status") {
    requireBody(body, ["userId", "status"]);
    return updateUserStatus(db, body);
  }
  if (req.method === "POST" && url.pathname === "/api/admin/tickets/status") {
    requireBody(body, ["ticketId", "status"]);
    return updateTicketStatus(db, body);
  }

  throw httpError(404, "NOT_FOUND", "요청한 API가 없습니다.");
}

async function serveStatic(req, res, rootDir, fallback = "/index.html") {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? fallback : decodeURIComponent(url.pathname);
  if (requested === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }
  const dcStatic = rootDir === publicDir ? {
    "/좌석선택.dc.html": path.join(jamsilOlympicSeatMapDir, "좌석선택.dc.html"),
    "/support.js": path.join(jamsilOlympicSeatMapDir, "support.js"),
    "/좌석 도면/잠실 올림픽 경기장/좌석선택.dc.html": path.join(jamsilOlympicSeatMapDir, "좌석선택.dc.html"),
    "/좌석 도면/잠실 올림픽 경기장/support.js": path.join(jamsilOlympicSeatMapDir, "support.js")
  } : {};
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const relativeSafePath = safePath.replace(/^[/\\]+/, "");
  let specialPath = dcStatic[requested];
  if (!specialPath && rootDir === publicDir && requested.startsWith("/좌석 도면/")) {
    const seatMapPath = path.join(__dirname, relativeSafePath);
    if (!seatMapPath.startsWith(seatMapDir)) throw httpError(403, "FORBIDDEN", "잘못된 경로입니다.");
    specialPath = seatMapPath;
  }
  const filePath = specialPath || path.join(rootDir, safePath);
  if (!specialPath && !filePath.startsWith(rootDir)) throw httpError(403, "FORBIDDEN", "잘못된 경로입니다.");
  let file;
  try {
    file = await readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT") throw httpError(404, "NOT_FOUND", "파일을 찾을 수 없습니다.");
    throw error;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
  res.end(file);
}

async function handleRequest(req, res, db, staticDir, fallback) {
  try {
    if (req.url.startsWith("/api/")) {
      const result = await handleApi(req, res, db);
      await saveDb(db);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, data: result }, null, 2));
      return;
    }
    await serveStatic(req, res, staticDir, fallback);
  } catch (error) {
    const status = error.status || 500;
    if (!req.url.startsWith("/api/") && status === 404) {
      res.writeHead(302, { Location: "/" });
      res.end();
      return;
    }
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      ok: false,
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: error.message || "서버 오류가 발생했습니다.",
        detail: error.detail || {}
      }
    }, null, 2));
  }
}

const db = await loadDb();

http.createServer((req, res) => {
  handleRequest(req, res, db, publicDir, "/index.html");
}).listen(PORT, () => {
  console.log(`Ticketground MVP running at http://localhost:${PORT}`);
});

http.createServer((req, res) => {
  handleRequest(req, res, db, adminDir, "/admin.html");
}).listen(ADMIN_PORT, () => {
  console.log(`Ticketground console running at http://localhost:${ADMIN_PORT}`);
});
