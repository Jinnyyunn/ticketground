import crypto from "node:crypto";

export function createAdmissionQrBackend({
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
}) {
  function admissionCredentialForTicket(db, ticket) {
    return db.admissionCredentials.find((credential) => credential.ticketId === ticket.id);
  }

  function timingSafeStringMatches(actual, expected) {
    const actualBuffer = Buffer.from(String(actual || ""));
    const expectedBuffer = Buffer.from(String(expected || ""));
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  }

  function issueQr(db, params, options = {}) {
    const {
      userId,
      ticketId,
      channel = "WEB",
      deviceId,
      deviceToken,
      otpVerified = false,
      delayAcknowledged = false,
      emergencyOverride = false,
      emergencyReason,
      attestationVerified = false
    } = params;
    const emergencyAllowed = options.allowEmergencyOverride === true && emergencyOverride === true;
    const user = findUser(db, userId);
    const ticket = db.tickets.find((item) => item.id === ticketId);
    if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
    if (ticket.ownerId !== user.id) throw httpError(403, "NOT_OWNER", "소유자만 입장 QR을 발급할 수 있습니다.");
    if (ticket.status !== "OWNED") throw httpError(409, "INVALID_TICKET_STATE", "입장 가능한 티켓 상태가 아닙니다.");
    const event = db.events.find((item) => item.id === ticket.eventId);
    const performanceDate = eventDate(event, ticket.performanceDateId);
    const credential = ensureAdmissionCredential(db, { user, ticket, event, performanceDate });
    if (credential.adminHold === true && !emergencyAllowed) {
      throw httpError(423, "ADMIN_HOLD_ACTIVE", "운영자 보류 중인 입장 자격은 QR을 발급할 수 없습니다.", {
        credentialId: credential.id,
        reason: credential.adminHoldReason || "operator-hold"
      });
    }
    if (!emergencyAllowed && String(channel).toUpperCase() !== "APP") {
      throw httpError(403, "APP_CHANNEL_REQUIRED", "실제 입장 QR은 전용앱에서만 활성화할 수 있습니다.", {
        allowedChannel: "APP",
        webPolicy: "virtual-ticket-only"
      });
    }
    if (!emergencyAllowed && attestationVerified !== true) {
      throw httpError(403, "APP_ATTESTATION_REQUIRED", "전용앱 인증 서명이 필요합니다.");
    }
    const trustedDevice = emergencyAllowed ? null : requireTrustedDevice(db, { user, deviceId, deviceToken });
    const risk = riskGate(riskScoreFor(user));
    if (!emergencyAllowed) {
      if (risk.action === "HOLD") {
        throw httpError(423, "RISK_HOLD_ACTIVE", "위험도 평가에 따라 QR 발급이 보류되었습니다.", risk);
      }
      if (risk.action === "OTP_REQUIRED" && otpVerified !== true) {
        throw httpError(403, "OTP_REQUIRED", "위험 계정은 입장 QR 활성화 전 추가 인증이 필요합니다.", risk);
      }
      // DELAY_OR_SUPPORT_CHECK is a soft gate, not a dead end: the client
      // is told to wait risk.delaySeconds and resubmit with
      // delayAcknowledged: true. Nothing about the account changes during
      // that wait - the delay itself, plus giving a self-selecting scalper
      // a moment to reconsider before a gate scan, is the point.
      if (risk.action === "DELAY_OR_SUPPORT_CHECK" && delayAcknowledged !== true) {
        throw httpError(409, "DELAY_REQUIRED", "잠시 후 다시 시도하거나 고객센터 확인이 필요합니다.", risk);
      }
    }
    if (currentTimeMs() < Date.parse(credential.activeAt) && !emergencyAllowed) {
      throw httpError(409, "REAL_QR_NOT_READY", "입장 QR은 공연 3시간 전부터 활성화됩니다.", {
        preparedAt: credential.preparedAt,
        activeAt: credential.activeAt,
        performanceStartsAt: performanceDate.startsAt
      });
    }
    const expiresAt = new Date(currentTimeMs() + 20_000).toISOString();
    const nonce = randomHex(8);
    const signature = hmac(`${ticket.id}:${user.id}:${expiresAt}:${nonce}`);
    const traceCode = hash(`${ticket.id}:${nonce}:${now()}`).slice(0, 10).toUpperCase();
    ticket.currentQr = { nonce, expiresAt, signature, issuedAt: now(), type: "ADMISSION", usedAt: null, traceCode };
    credential.status = "QR_ACTIVE";
    credential.deviceId = trustedDevice?.deviceId || "EMERGENCY";
    credential.updatedAt = now();
    db.qrIssueLogs.push({
      id: id("qrlog"),
      ticketId: ticket.id,
      credentialId: credential.id,
      userId: user.id,
      deviceId: credential.deviceId,
      channel: emergencyAllowed ? "EMERGENCY" : "APP",
      issuedAt: ticket.currentQr.issuedAt,
      expiresAt,
      traceCode
    });
    appendLedger(db, user.id, "DYNAMIC_QR_ISSUED", {
      ticketId: ticket.id,
      admissionCredentialId: credential.id,
      expiresAt,
      ttlSeconds: 20,
      channel: emergencyAllowed ? "EMERGENCY" : "APP",
      deviceId: credential.deviceId,
      emergencyReason: emergencyAllowed ? String(emergencyReason || "operator-exception").slice(0, 120) : null
    });
    return {
      type: "ADMISSION",
      ticketId: ticket.id,
      ownerId: user.id,
      expiresAt,
      nonce,
      signature,
      issuedAt: ticket.currentQr.issuedAt,
      performanceStartsAt: performanceDate.startsAt,
      preparedAt: credential.preparedAt,
      activeAt: credential.activeAt,
      ttlSeconds: 20,
      traceCode,
      channel: emergencyAllowed ? "EMERGENCY" : "APP",
      emergencyReason: emergencyAllowed ? String(emergencyReason || "operator-exception").slice(0, 120) : null
    };
  }

  function verifyQr(db, { ticketId, ownerId, expiresAt, nonce, signature, gateId, gateEventId }) {
    const expected = hmac(`${ticketId}:${ownerId}:${expiresAt}:${nonce}`);
    const ticket = db.tickets.find((item) => item.id === ticketId);
    const credential = ticket ? admissionCredentialForTicket(db, ticket) : null;
    // Both comparisons against the caller-supplied signature must stay
    // timing-safe: a plain === here (even ANDed with the constant-time
    // check below) would let short-circuit evaluation skip the safe
    // comparison and leak byte-position match info through response
    // timing for forged/replayed signatures.
    const signatureValid = Boolean(ticket)
      && ticket.ownerId === ownerId
      && timingSafeStringMatches(signature, expected)
      && timingSafeStringMatches(signature, ticket.currentQr?.signature)
      && Date.parse(expiresAt) > currentTimeMs();
    // Split out of the original single `valid` expression so a second gate
    // that loses the race can be told *why* (already admitted, and where)
    // instead of just "invalid" - this is what the gate PWA shows as
    // "이미 다른 게이트에서 입장 처리됨".
    const alreadyUsed = signatureValid && (Boolean(ticket.currentQr?.usedAt) || credential?.status === "USED");
    // A gate token issued for a specific event (gateEventId set at
    // issuance) must not admit tickets for a different event - the QR
    // signature only proves the QR is genuine for that ticket, not that
    // this particular gate is authorized for that ticket's event. An
    // unscoped gate token (gateEventId null) is unaffected.
    const eventScopeMismatch = signatureValid && !alreadyUsed
      && Boolean(gateEventId) && ticket.eventId !== gateEventId;
    const valid = signatureValid && !alreadyUsed && !eventScopeMismatch;
    if (valid) {
      ticket.currentQr.usedAt = now();
      ticket.currentQr.usedByGateId = gateId || null;
      ticket.status = "ADMITTED";
      if (credential) {
        credential.status = "USED";
        credential.usedAt = ticket.currentQr.usedAt;
        credential.usedByGateId = gateId || null;
        credential.updatedAt = now();
      }
    }
    appendLedger(db, ownerId || "GATE", valid ? "GATE_QR_ACCEPTED" : "GATE_QR_REJECTED", {
      ticketId,
      admissionCredentialId: credential?.id || null,
      gateId: gateId || "UNKNOWN",
      reason: valid
        ? "valid-dynamic-token-one-use-consumed"
        : alreadyUsed
          ? "already-used"
          : eventScopeMismatch
            ? "gate-event-scope-mismatch"
            : "invalid-expired-or-replayed-token"
    });
    return {
      valid,
      alreadyUsed,
      eventScopeMismatch,
      usedAt: alreadyUsed ? (credential?.usedAt || ticket?.currentQr?.usedAt || null) : null,
      usedByGateId: alreadyUsed ? (credential?.usedByGateId || ticket?.currentQr?.usedByGateId || null) : null
    };
  }

  return { issueQr, verifyQr };
}
