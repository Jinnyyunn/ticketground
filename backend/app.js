import { createAdmissionBackend } from "./admission.js";
import { createAppAttestBackend } from "./app-attest.js";
import { createGateSessionBackend } from "./gate-sessions.js";
import { createAdminBackend } from "./admin.js";
import { createApiRouter } from "./api-router.js";
import { createBookingHoldsBackend } from "./booking-holds.js";
import { createCatalogBackend } from "./catalog.js";
import { createCommerceBackend } from "./commerce.js";
import { createDtoBackend } from "./dtos.js";
import { createDiscoveryBackend } from "./discovery.js";
import { createEngagementBackend } from "./engagement.js";
import { createGroupBookingBackend } from "./group-booking.js";
import { createHttpHandler } from "./http-handler.js";
import { createIdentityBackend } from "./identity.js";
import { createNativeSessionBackend } from "./native-session.js";
import { createMobileLifecycleBackend } from "./mobile-lifecycle.js";
import { createPersistence } from "./persistence.js";
import { createRuntime } from "./runtime.js";
import { createSessionBackend } from "./session.js";
import { createSellerAccountBackend } from "./seller-accounts.js";
import { createSellerApplicationBackend } from "./seller-applications.js";
import { createSellerEventsBackend } from "./seller-events.js";
import { sellerSessionFromRequest } from "./seller-session.js";
import { createTosspaymentsBackend } from "./tosspayments.js";

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
  const discovery = createDiscoveryBackend({
    httpError: runtime.httpError,
    publicCatalog: dtos.publicCatalog
  });
  let groupBooking;
  const sellerApplications = createSellerApplicationBackend({
    appendLedger: persistence.appendLedger,
    clone: runtime.clone,
    httpError: runtime.httpError,
    id: runtime.id,
    now: runtime.now
  });
  // sellerEvents is constructed after admin (it reuses admin.createEventDraft/
  // updateEventSale) but admin's "seller-events" workspace listing needs
  // sellerEvents.listPendingSellerEvents back - same forward-reference
  // pattern as ensureAdmissionCredential below breaks the circular need.
  let listPendingSellerEvents;
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
    verifyLedger: persistence.verifyLedger,
    listSellerApplications: sellerApplications.listSellerApplications,
    listPendingSellerEvents: (...args) => listPendingSellerEvents(...args)
  });
  const sellerAccounts = createSellerAccountBackend({
    appendLedger: persistence.appendLedger,
    httpError: runtime.httpError,
    id: runtime.id,
    now: runtime.now
  });
  const sellerEvents = createSellerEventsBackend({
    appendLedger: persistence.appendLedger,
    createEventDraft: admin.createEventDraft,
    httpError: runtime.httpError,
    now: runtime.now,
    updateEventSale: admin.updateEventSale
  });
  ({ listPendingSellerEvents } = sellerEvents);
  function sellerSession(db, req) {
    return sellerSessionFromRequest({
      activeSellerAccount: sellerAccounts.activeSellerAccount,
      currentTimeMs: runtime.currentTimeMs,
      db,
      hmac: runtime.hmac,
      req
    });
  }
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
  const appAttest = createAppAttestBackend({
    currentTimeMs: runtime.currentTimeMs,
    httpError: runtime.httpError,
    id: runtime.id,
    now: runtime.now,
    randomHex: runtime.randomHex,
    verifierURL: options.runtime.appAttestVerifierURL,
    verifierToken: options.runtime.appAttestVerifierToken
  });
  const gateSessions = createGateSessionBackend({
    appendLedger: persistence.appendLedger,
    hash: runtime.hash,
    httpError: runtime.httpError,
    id: runtime.id,
    now: runtime.now,
    randomHex: runtime.randomHex
  });
  const engagement = createEngagementBackend({
    appendLedger: persistence.appendLedger,
    findUser: runtime.findUser,
    hash: runtime.hash,
    httpError: runtime.httpError,
    id: runtime.id,
    now: runtime.now,
    offsetIso: runtime.offsetIso,
    primaryDate: catalog.primaryDate,
    stableId: runtime.stableId
  });
  const nativeSession = createNativeSessionBackend({
    currentTimeMs: runtime.currentTimeMs,
    findUser: runtime.findUser,
    hash: runtime.hash,
    httpError: runtime.httpError,
    now: runtime.now,
    randomHex: runtime.randomHex
  });
  const session = createSessionBackend({
    appendLedger: persistence.appendLedger,
    currentTimeMs: runtime.currentTimeMs,
    findUser: runtime.findUser,
    hmac: runtime.hmac,
    httpError: runtime.httpError,
    issueNativeSession: nativeSession.issueNativeSession,
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
  const mobileLifecycle = createMobileLifecycleBackend({
    appendLedger: persistence.appendLedger,
    cancelResaleListing: commerce.cancelResaleListing,
    hash: runtime.hash,
    httpError: runtime.httpError,
    id: runtime.id,
    joinPool: commerce.joinPool,
    listForResale: commerce.listForResale,
    now: runtime.now,
    publicResalePool: dtos.publicResalePool,
    sortJson: runtime.sortJson
  });
  groupBooking = createGroupBookingBackend({
    appendLedger: persistence.appendLedger,
    businessRegistrationDir: options.businessRegistrationDir,
    clone: runtime.clone,
    ensureAdmissionCredential,
    httpError: runtime.httpError,
    id: runtime.id,
    isEventBookable: catalog.isEventBookable,
    money: runtime.money,
    now: runtime.now,
    saleSummary: catalog.saleSummary
  });
  const tosspayments = createTosspaymentsBackend({
    hash: runtime.hash,
    httpError: runtime.httpError,
    now: runtime.now
  });
  const bookingHolds = createBookingHoldsBackend({
    currentTimeMs: runtime.currentTimeMs,
    eventZone: catalog.eventZone,
    findUser: runtime.findUser,
    hash: runtime.hash,
    httpError: runtime.httpError,
    id: runtime.id,
    isEventBookable: catalog.isEventBookable,
    now: runtime.now
  });
  const apiRouter = createApiRouter({
    ...admin,
    ...bookingHolds,
    ...commerce,
    ...discovery,
    ...engagement,
    ...gateSessions,
    ...groupBooking,
    ...identity,
    ...mobileLifecycle,
    ...nativeSession,
    ...sellerApplications,
    ...sellerAccounts,
    ...sellerEvents,
    ...session,
    accountTicketsForUser: dtos.accountTicketsForUser,
    appendLedger: persistence.appendLedger,
    buyPrimary: commerce.buyPrimary,
    cancelTosspaymentsPayment: tosspayments.cancelTosspaymentsPayment,
    confirmTosspaymentsPayment: tosspayments.confirmTosspaymentsPayment,
    currentTimeMs: runtime.currentTimeMs,
    hmac: runtime.hmac,
    httpError: runtime.httpError,
    isDev: options.isDev === true,
    isWebhookSignatureValid: tosspayments.isWebhookSignatureValid,
    sellerSession,
    publicCatalog: dtos.publicCatalog,
    publicDirectTransferResult: dtos.publicDirectTransferResult,
    publicPurchaseResult: dtos.publicPurchaseResult,
    publicResaleDrawResult: dtos.publicResaleDrawResult,
    publicResalePool: dtos.publicResalePool,
    publicState: dtos.publicState,
    publicTicket: dtos.publicTicket,
    publicTicketsForUser: dtos.publicTicketsForUser,
    seatMap: admin.seatMap,
    tosspaymentsConfig: tosspayments.tosspaymentsConfig,
    trustDevice: admission.trustDevice,
    issueAppAttestChallenge: appAttest.issueChallenge,
    verifyAppAttestProof: appAttest.verifyProof,
    verifyAppAttestation: runtime.verifyAppAttestation,
    verifyLedger: persistence.verifyLedger,
    verifyQr: admission.verifyQr,
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
