import http from "node:http";
import { createApiRouter } from "./backend/api-router.js";
import { createHttpHandler } from "./backend/http-handler.js";
import { createPersistence } from "./backend/persistence.js";
import { createRuntime } from "./backend/runtime.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAdmissionBackend } from "./backend/admission.js";
import { createAdminBackend } from "./backend/admin.js";
import { createCatalogBackend } from "./backend/catalog.js";
import { createDtoBackend } from "./backend/dtos.js";
import { createCommerceBackend } from "./backend/commerce.js";
import { createEngagementBackend } from "./backend/engagement.js";
import { createSessionBackend } from "./backend/session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const adminDir = path.join(__dirname, "admin");
const seatMapDir = path.join(__dirname, "좌석 도면");
const jamsilOlympicSeatMapDir = path.join(seatMapDir, "잠실 올림픽 경기장");
const defaultDbPath = path.join(__dirname, "data", "db.json");
const dbPath = process.env.TIG_DB_PATH ? path.resolve(process.env.TIG_DB_PATH) : defaultDbPath;
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

const {
  clone,
  currentTimeMs,
  findUser,
  hash,
  hmac,
  httpError,
  id,
  money,
  now,
  offsetIso,
  randomHex,
  resolvePaymentMethod,
  stableId,
  sortJson,
  verifyAppAttestation
} = createRuntime({
  appAttestationSecret: process.env.TIG_APP_ATTESTATION_SECRET,
  nowOverride: process.env.TIG_NOW,
  secret: SECRET
});
const { appendLedger, loadDb, saveDb, verifyLedger } = createPersistence({
  dbPath,
  hash,
  now,
  sortJson
});
let ensureAdmissionCredential;

const {
  ensureTicketsForEvent,
  eventDate,
  eventZone,
  isEventBookable,
  normalizeDb,
  primaryDate,
  saleSummary,
  seatLayoutForVenue,
  seedDb
} = createCatalogBackend({
  appendLedger,
  clone,
  ensureAdmissionCredential: (...args) => ensureAdmissionCredential(...args),
  httpError,
  now,
  stableId
});

const {
  adminTicket,
  publicDirectTransferResult,
  publicPurchaseResult,
  publicResaleDrawResult,
  publicResalePool,
  publicState,
  publicTicket,
  publicTicketsForUser
} = createDtoBackend({ saleSummary, verifyLedger });

const {
  adminSummary,
  adminVenues,
  resolveVenue,
  seatMap,
  updateEventSale,
  updateEventVenue,
  updateTicketStatus,
  updateUserStatus,
  updateUserStatuses,
  venueMapForEvent
} = createAdminBackend({
  adminTicket,
  appendLedger,
  ensureTicketsForEvent,
  httpError,
  id,
  money,
  now,
  seatLayoutForVenue,
  stableId,
  verifyLedger
});

const admissionBackend = createAdmissionBackend({
  appendLedger,
  currentTimeMs,
  eventDate,
  findUser,
  hash,
  hmac,
  httpError,
  id,
  now,
  offsetIso,
  randomHex,
  stableId
});

({ ensureAdmissionCredential } = admissionBackend);
const { issueQr, trustDevice, verifyQr: verifyAdmissionQr, virtualQr } = admissionBackend;

function verifyQr(db, payload) {
  const { valid } = verifyAdmissionQr(db, payload);
  return { valid };
}

const {
  addSupportMessage,
  createSupportThread,
  notifyWatchlist,
  supportThreadForUser,
  updateSupportStatus,
  upsertWatchlist,
  userWatchlist
} = createEngagementBackend({
  appendLedger,
  findUser,
  httpError,
  id,
  now,
  offsetIso,
  primaryDate,
  stableId
});

const {
  demoSession,
  updateDemoProfile
} = createSessionBackend({
  appendLedger,
  findUser,
  httpError,
  now
});

const {
  buyPrimary,
  directTransferAttempt,
  drawPool,
  joinPool,
  listForResale,
  purchaseResale
} = createCommerceBackend({
  appendLedger,
  currentTimeMs,
  ensureAdmissionCredential,
  eventDate,
  eventZone,
  findUser,
  hash,
  hmac,
  httpError,
  id,
  isEventBookable,
  money,
  now,
  resolvePaymentMethod,
  saleSummary
});

const { handleApi } = createApiRouter({
  addSupportMessage,
  adminSummary,
  adminVenues,
  createSupportThread,
  demoSession,
  directTransferAttempt,
  drawPool,
  httpError,
  joinPool,
  listForResale,
  notifyWatchlist,
  purchaseResale,
  publicDirectTransferResult,
  publicPurchaseResult,
  publicResaleDrawResult,
  publicResalePool,
  publicState,
  publicTicket,
  publicTicketsForUser,
  buyPrimary,
  seatMap,
  supportThreadForUser,
  trustDevice,
  updateEventSale,
  updateEventVenue,
  updateDemoProfile,
  updateSupportStatus,
  updateTicketStatus,
  updateUserStatus,
  updateUserStatuses,
  upsertWatchlist,
  userWatchlist,
  venueMapForEvent,
  verifyAppAttestation,
  verifyLedger,
  verifyQr,
  virtualQr,
  issueQr
});

const { handleRequest } = createHttpHandler({
  adminDir,
  fallbackAdmin: "/admin.html",
  fallbackPublic: "/index.html",
  httpError,
  jamsilOlympicSeatMapDir,
  MIME,
  projectDir: __dirname,
  publicDir,
  saveDb,
  seatMapDir,
  handleApi
});

const db = await loadDb({ normalizeDb, seedDb });

http.createServer((req, res) => {
  handleRequest(req, res, db, "public");
}).listen(PORT, () => {
  console.log(`Ticketground MVP running at http://localhost:${PORT}`);
});

http.createServer((req, res) => {
  handleRequest(req, res, db, "admin");
}).listen(ADMIN_PORT, () => {
  console.log(`Ticketground console running at http://localhost:${ADMIN_PORT}`);
});
