import http from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const adminDir = path.join(__dirname, "admin");
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
  ".png": "image/png"
};

const VENUES = [
  {
    id: "jamsil-indoor",
    name: "잠실 실내체육관",
    category: "concert",
    mapId: "jamsil-indoor",
    mapTitle: "잠실 실내체육관 도면",
    mapImage: "/admin-assets/jamsil-indoor.svg",
    description: "원형 실내 공연장 좌석 배치도입니다."
  },
  {
    id: "jamsil-main-stadium",
    name: "잠실 올림픽주경기장",
    category: "sports",
    mapId: "jamsil-main-stadium",
    mapTitle: "잠실 올림픽주경기장 도면",
    mapImage: "/admin-assets/jamsil-main-stadium.svg",
    description: "대형 경기장형 관람석 배치도입니다."
  },
  {
    id: "jamsil-aux-field",
    name: "잠실 보조 경기장",
    category: "festival",
    mapId: "jamsil-aux-field",
    mapTitle: "잠실 보조 경기장 도면",
    mapImage: "/admin-assets/jamsil-aux-field.svg",
    description: "야외 페스티벌형 스탠딩 및 피크닉 구역 배치도입니다."
  }
];

function now() {
  return new Date().toISOString();
}

function money(value) {
  return Math.round(Number(value));
}

const PAYMENT_METHODS = {
  BALANCE: { label: "충전금", requiresBalance: true, status: "PAID" },
  CREDIT_CARD: { label: "신용카드", requiresBalance: false, status: "PAID" },
  BANK_TRANSFER: { label: "계좌이체", requiresBalance: false, status: "PAID" },
  BANK_DEPOSIT: { label: "무통장 입금", requiresBalance: false, status: "WAITING_DEPOSIT" },
  MOBILE: { label: "휴대폰 결제", requiresBalance: false, status: "PAID" }
};

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

function publicState(db) {
  return {
    events: db.events,
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
  return {
    users: [
      { id: "user_fan_a", name: "민서", balance: 180000, status: "ACTIVE", trustScore: 92, sanctions: [] },
      { id: "user_fan_b", name: "지후", balance: 135000, status: "ACTIVE", trustScore: 88, sanctions: [] },
      { id: "user_seller", name: "하린", balance: 30000, status: "ACTIVE", trustScore: 95, sanctions: [] },
      { id: "user_scalper", name: "의심 계정", balance: 500000, status: "WATCHLIST", trustScore: 34, sanctions: [] }
    ],
    events: [
      {
        id: "event_kpop_001",
        title: "TIG Live: Neon Stage",
        venue: "잠실 실내체육관",
        venueId: "jamsil-indoor",
        date: "2026-09-19T19:00:00+09:00",
        organizer: "TIG Entertainment",
        zones: [
          { id: "zone_vip", name: "VIP", faceValue: 154000, resaleFeeRate: 0.08, maxTransferCount: 1 },
          { id: "zone_r", name: "R석", faceValue: 121000, resaleFeeRate: 0.07, maxTransferCount: 1 },
          { id: "zone_s", name: "S석", faceValue: 99000, resaleFeeRate: 0.06, maxTransferCount: 1 }
        ]
      }
    ],
    tickets: [],
    resalePools: [],
    ledger: []
  };
}

async function loadDb() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(dbPath)) {
    const db = seedDb();
    for (const zone of db.events[0].zones) {
      for (let i = 1; i <= 4; i += 1) {
        const ticket = {
          id: id("ticket"),
          eventId: db.events[0].id,
          zoneId: zone.id,
          seatLabel: `${zone.name}-${String(i).padStart(2, "0")}`,
          ownerId: null,
          status: "ON_SALE",
          faceValue: zone.faceValue,
          minPrice: Math.ceil(zone.faceValue * 0.5),
          maxPrice: Math.ceil(zone.faceValue * (1 + zone.resaleFeeRate)),
          transferCount: 0,
          maxTransferCount: zone.maxTransferCount,
          currentQr: null,
          issuedAt: now()
        };
        db.tickets.push(ticket);
      }
    }
    appendLedger(db, "SYSTEM", "BOOTSTRAP", { message: "Initial event and ticket minting snapshot" });
    await saveDb(db);
    return db;
  }
  return JSON.parse(await readFile(dbPath, "utf8"));
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

function eventZone(db, eventId, zoneId) {
  const event = db.events.find((item) => item.id === eventId);
  if (!event) throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
  const zone = event.zones.find((item) => item.id === zoneId);
  if (!zone) throw httpError(404, "ZONE_NOT_FOUND", "구역을 찾을 수 없습니다.");
  return { event, zone };
}

function venueById(venueId) {
  const venue = VENUES.find((item) => item.id === venueId);
  if (!venue) throw httpError(404, "VENUE_NOT_FOUND", "공연장을 찾을 수 없습니다.");
  return venue;
}

function resolveEventVenue(event) {
  return venueById(event.venueId || "jamsil-indoor");
}

function adminVenues(db) {
  const event = db.events[0];
  if (event && !event.venueId) {
    event.venueId = "jamsil-indoor";
    event.venue = "잠실 실내체육관";
  }
  return {
    venues: VENUES.map(({ id, name, category, mapId, mapTitle }) => ({ id, name, category, mapId, mapTitle })),
    event
  };
}

function updateEventVenue(db, { eventId, venueId }) {
  const event = db.events.find((item) => item.id === eventId) || db.events[0];
  if (!event) throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
  const venue = venueById(venueId);
  event.venueId = venue.id;
  event.venue = venue.name;
  appendLedger(db, "SYSTEM", "EVENT_VENUE_UPDATED", {
    eventId: event.id,
    venueId: venue.id,
    venueName: venue.name,
    mapId: venue.mapId
  });
  return { event, venue };
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
  appendLedger(db, "SYSTEM", "USER_STATUS_UPDATED", {
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
  appendLedger(db, "SYSTEM", "TICKET_STATUS_UPDATED", {
    ticketId: ticket.id,
    status,
    policy: "operator-inventory-control"
  });
  return ticket;
}

function seatMap(db, { category, venueId }) {
  const event = db.events[0];
  const venue = venueId ? venueById(venueId) : resolveEventVenue(event);
  const zones = event.zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    price: zone.faceValue,
    available: db.tickets.filter((ticket) => ticket.zoneId === zone.id && ticket.status === "ON_SALE").length
  }));
  const seats = db.tickets.map((ticket, index) => {
    const zone = event.zones.find((item) => item.id === ticket.zoneId);
    const angle = (index / Math.max(db.tickets.length, 1)) * Math.PI * 2 - Math.PI / 2;
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
    category: category || venue.category,
    date: "",
    event: {
      id: event.id,
      title: event.title,
      venueId: venue.id,
      venue: venue.name,
      originalVenue: venue.name
    },
    map: {
      id: venue.mapId,
      venue: venue.name,
      title: venue.mapTitle,
      image: venue.mapImage,
      description: venue.description
    },
    zones,
    seats
  };
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
  if (payment.requiresBalance && user.balance < ticket.faceValue) {
    throw httpError(402, "INSUFFICIENT_BALANCE", "충전금이 부족합니다. 다른 결제수단을 선택해주세요.");
  }

  if (payment.requiresBalance) user.balance -= ticket.faceValue;
  ticket.ownerId = user.id;
  ticket.status = "OWNED";
  appendLedger(db, user.id, "PRIMARY_PURCHASE", {
    ticketId: ticket.id,
    price: ticket.faceValue,
    paymentMethod: payment.key,
    paymentLabel: payment.label,
    paymentStatus: payment.status,
    approvalId: `${payment.key}-${id("pay").toUpperCase()}`,
    policy: "platform-signed-owner-assignment"
  });
  return { user, ticket, payment };
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
  const safePath = path.normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(rootDir, safePath);
  if (!filePath.startsWith(rootDir)) throw httpError(403, "FORBIDDEN", "잘못된 경로입니다.");
  if (!existsSync(filePath)) throw httpError(404, "NOT_FOUND", "요청한 파일이 없습니다.");
  const file = await readFile(filePath);
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
