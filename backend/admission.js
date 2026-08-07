import { createAdmissionDeviceBackend } from "./admission-devices.js";
import { createAdmissionQrBackend } from "./admission-qr.js";

export function createAdmissionBackend({
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
}) {
  function qrPreparedAt(performanceDate) {
    return offsetIso(performanceDate.startsAt, 24 * 60 * 60 * 1000);
  }

  function qrActiveAt(performanceDate) {
    return offsetIso(performanceDate.startsAt, 3 * 60 * 60 * 1000);
  }

  function isRiskUser(user) {
    return user.status === "WATCHLIST" || user.trustScore < 50;
  }

  // Graduated replacement for the old binary isRiskUser() check. Kept in
  // this module (not admission-qr.js) because ensureAdmissionCredential
  // also needs riskStatus, same reason isRiskUser lives here.
  //
  // trustScore drives a continuous score (100 - trustScore) so accounts
  // degrading through commerce.js's per-infraction trustScore penalty pass
  // through the OTP/delay bands before ever reaching WATCHLIST, instead of
  // jumping straight from "normal" to "flagged" with no middle ground.
  // WATCHLIST floors the score at 80 (HOLD) regardless of trustScore,
  // since an operator/system already flagged the account explicitly.
  function riskScoreFor(user) {
    let score = Math.max(0, 100 - user.trustScore);
    if (user.status === "WATCHLIST") score = Math.max(score, 80);
    return Math.min(score, 100);
  }

  function riskGate(score) {
    if (score < 30) return { action: "ALLOW", riskScore: score };
    if (score < 60) return { action: "OTP_REQUIRED", riskScore: score };
    if (score < 80) return { action: "DELAY_OR_SUPPORT_CHECK", riskScore: score, delaySeconds: 30 };
    return { action: "HOLD", riskScore: score, requiresAdminReview: true };
  }

  function admissionCredentialForTicket(db, ticket) {
    return db.admissionCredentials.find((credential) => credential.ticketId === ticket.id);
  }

  function ensureAdmissionCredential(db, { user, ticket, event, performanceDate }) {
    let credential = admissionCredentialForTicket(db, ticket);
    if (!credential) {
      credential = {
        id: stableId("cred", ticket.id),
        ticketId: ticket.id,
        userId: user.id,
        eventId: event.id,
        performanceDateId: performanceDate.id,
        status: "VIRTUAL_READY",
        preparedAt: qrPreparedAt(performanceDate),
        activeAt: qrActiveAt(performanceDate),
        activationChannel: "APP_ONLY",
        riskStatus: isRiskUser(user) ? "OTP_REQUIRED" : "NORMAL",
        deviceId: null,
        createdAt: now(),
        updatedAt: now()
      };
      db.admissionCredentials.push(credential);
    } else {
      const ownerChanged = credential.userId !== user.id;
      credential.userId = user.id;
      credential.eventId = event.id;
      credential.performanceDateId = performanceDate.id;
      credential.preparedAt = qrPreparedAt(performanceDate);
      credential.activeAt = qrActiveAt(performanceDate);
      credential.riskStatus = isRiskUser(user) ? "OTP_REQUIRED" : "NORMAL";
      credential.status = credential.status === "USED" ? "USED" : "VIRTUAL_READY";
      if (ownerChanged) {
        credential.adminHold = false;
        credential.adminHoldReason = null;
        credential.adminHoldUpdatedAt = null;
      }
      credential.updatedAt = now();
    }
    ticket.admissionCredentialId = credential.id;
    return credential;
  }

  function virtualQr(db, { userId, ticketId }) {
    const user = findUser(db, userId);
    const ticket = db.tickets.find((item) => item.id === ticketId);
    if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
    if (ticket.ownerId !== user.id) throw httpError(403, "NOT_OWNER", "소유자만 예매 확인 QR을 볼 수 있습니다.");
    const event = db.events.find((item) => item.id === ticket.eventId);
    const performanceDate = eventDate(event, ticket.performanceDateId);
    const credential = ensureAdmissionCredential(db, { user, ticket, event, performanceDate });
    const issuedAt = now();
    return {
      type: "VIRTUAL_TICKET",
      ticketId: ticket.id,
      issuedAt,
      eventTitle: event.title,
      seatLabel: ticket.seatLabel,
      performanceStartsAt: performanceDate.startsAt,
      qrPreparedAt: credential.preparedAt,
      realQrAvailableAt: credential.activeAt,
      admissionCredentialStatus: credential.status,
      admissionChannel: credential.activationChannel
    };
  }

  const { requireTrustedDevice, trustDevice } = createAdmissionDeviceBackend({
    appendLedger,
    findUser,
    hash,
    hmac,
    httpError,
    now,
    stableId
  });

  const { issueQr, verifyQr } = createAdmissionQrBackend({
    appendLedger,
    currentTimeMs,
    ensureAdmissionCredential,
    eventDate,
    findUser,
    hash,
    hmac,
    httpError,
    id,
    now,
    randomHex,
    requireTrustedDevice,
    riskGate,
    riskScoreFor
  });

  return { ensureAdmissionCredential, issueQr, riskGate, riskScoreFor, trustDevice, verifyQr, virtualQr };
}
