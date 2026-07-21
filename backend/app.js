import { createAdmissionBackend } from "./admission.js";
import { createAdminBackend } from "./admin.js";
import { createApiRouter } from "./api-router.js";
import { createBootpayBackend } from "./bootpay.js";
import { createCatalogBackend } from "./catalog.js";
import { createCommerceBackend } from "./commerce.js";
import { createDtoBackend } from "./dtos.js";
import { createEngagementBackend } from "./engagement.js";
import { createGroupBookingBackend } from "./group-booking.js";
import { createHttpHandler } from "./http-handler.js";
import { createIdentityBackend } from "./identity.js";
import { createPersistence } from "./persistence.js";
import { createRuntime } from "./runtime.js";
import { createSessionBackend } from "./session.js";

export async function createTicketgroundApp(options) {
  const runtime = createRuntime(options.runtime);
  const persistence = createPersistence({
    dbPath: options.dbPath,
    hash: runtime.hash,
    now: runtime.now,
    sortJson: runtime.sortJson
  });
  let ensureAdmissionCredential;
  const catalog = createCatalogBackend({
    appendLedger: persistence.appendLedger,
    clone: runtime.clone,
    ensureAdmissionCredential: (...args) => ensureAdmissionCredential(...args),
    httpError: runtime.httpError,
    now: runtime.now,
    stableId: runtime.stableId
  });
  const dtos = createDtoBackend({
    saleSummary: catalog.saleSummary,
    verifyLedger: persistence.verifyLedger
  });
  let groupBooking;
  const admin = createAdminBackend({
    adminTicket: dtos.adminTicket,
    appendLedger: persistence.appendLedger,
    clone: runtime.clone,
    ensureTicketsForEvent: catalog.ensureTicketsForEvent,
    httpError: runtime.httpError,
    id: runtime.id,
    listGroupBookingRequests: (...args) => groupBooking.listGroupBookingRequests(...args),
    mediaDir: options.mediaDir,
    money: runtime.money,
    now: runtime.now,
    seatLayoutForVenue: catalog.seatLayoutForVenue,
    stableId: runtime.stableId,
    verifyLedger: persistence.verifyLedger
  });
  const admission = createAdmissionBackend({
    appendLedger: persistence.appendLedger,
    currentTimeMs: runtime.currentTimeMs,
    eventDate: catalog.eventDate,
    findUser: runtime.findUser,
    hash: runtime.hash,
    hmac: runtime.hmac,
    httpError: runtime.httpError,
    id: runtime.id,
    now: runtime.now,
    offsetIso: runtime.offsetIso,
    randomHex: runtime.randomHex,
    stableId: runtime.stableId
  });
  ({ ensureAdmissionCredential } = admission);
  const engagement = createEngagementBackend({
    appendLedger: persistence.appendLedger,
    findUser: runtime.findUser,
    httpError: runtime.httpError,
    id: runtime.id,
    now: runtime.now,
    offsetIso: runtime.offsetIso,
    primaryDate: catalog.primaryDate,
    stableId: runtime.stableId
  });
  const session = createSessionBackend({
    appendLedger: persistence.appendLedger,
    currentTimeMs: runtime.currentTimeMs,
    findUser: runtime.findUser,
    hmac: runtime.hmac,
    httpError: runtime.httpError,
    now: runtime.now,
    stableId: runtime.stableId
  });
  const identity = createIdentityBackend({
    appendLedger: persistence.appendLedger,
    findUser: runtime.findUser,
    hash: runtime.hash,
    httpError: runtime.httpError,
    id: runtime.id,
    now: runtime.now
  });
  const commerce = createCommerceBackend({
    appendLedger: persistence.appendLedger,
    currentTimeMs: runtime.currentTimeMs,
    ensureAdmissionCredential,
    ensureIdentityVerified: identity.ensureIdentityVerified,
    eventDate: catalog.eventDate,
    eventZone: catalog.eventZone,
    findUser: runtime.findUser,
    hash: runtime.hash,
    hmac: runtime.hmac,
    httpError: runtime.httpError,
    id: runtime.id,
    isEventBookable: catalog.isEventBookable,
    money: runtime.money,
    now: runtime.now,
    resolvePaymentMethod: runtime.resolvePaymentMethod,
    saleSummary: catalog.saleSummary
  });
  groupBooking = createGroupBookingBackend({
    appendLedger: persistence.appendLedger,
    clone: runtime.clone,
    ensureAdmissionCredential,
    findUser: runtime.findUser,
    httpError: runtime.httpError,
    id: runtime.id,
    isEventBookable: catalog.isEventBookable,
    money: runtime.money,
    now: runtime.now,
    saleSummary: catalog.saleSummary
  });
  const bootpay = createBootpayBackend({
    hash: runtime.hash,
    httpError: runtime.httpError,
    now: runtime.now
  });
  const apiRouter = createApiRouter({
    ...admin,
    ...commerce,
    ...engagement,
    ...groupBooking,
    ...identity,
    ...session,
    appendLedger: persistence.appendLedger,
    bootpayConfig: bootpay.bootpayConfig,
    buyPrimary: commerce.buyPrimary,
    confirmBootpayPayment: bootpay.confirmBootpayPayment,
    httpError: runtime.httpError,
    publicCatalog: dtos.publicCatalog,
    publicDirectTransferResult: dtos.publicDirectTransferResult,
    publicPurchaseResult: dtos.publicPurchaseResult,
    publicResaleDrawResult: dtos.publicResaleDrawResult,
    publicResalePool: dtos.publicResalePool,
    publicState: dtos.publicState,
    publicTicket: dtos.publicTicket,
    publicTicketsForUser: dtos.publicTicketsForUser,
    seatMap: admin.seatMap,
    trustDevice: admission.trustDevice,
    verifyAppAttestation: runtime.verifyAppAttestation,
    verifyLedger: persistence.verifyLedger,
    verifyQr: (db, payload) => ({ valid: admission.verifyQr(db, payload).valid }),
    virtualQr: admission.virtualQr,
    issueQr: admission.issueQr
  });
  const http = createHttpHandler({
    ...options.http,
    handleApi: apiRouter.handleApi,
    httpError: runtime.httpError,
    saveDb: persistence.saveDb
  });
  const db = await persistence.loadDb({ normalizeDb: catalog.normalizeDb, seedDb: catalog.seedDb });
  return { admin, db, handleRequest: http.handleRequest };
}
