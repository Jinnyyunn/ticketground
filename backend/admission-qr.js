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
  isRiskUser,
  now,
  randomHex,
  requireTrustedDevice
}) {
  function admissionCredentialForTicket(db, ticket) {
    return db.admissionCredentials.find((credential) => credential.ticketId === ticket.id);
  }

  function issueQr(db, params, options = {}) {
    const {
      userId,
      ticketId,
      channel = "WEB",
      deviceId,
      deviceToken,
      otpVerified = false,
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
    if (isRiskUser(user) && otpVerified !== true && !emergencyAllowed) {
      throw httpError(403, "OTP_REQUIRED", "위험 계정은 입장 QR 활성화 전 추가 인증이 필요합니다.");
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

  function verifyQr(db, { ticketId, ownerId, expiresAt, nonce, signature }) {
    const expected = hmac(`${ticketId}:${ownerId}:${expiresAt}:${nonce}`);
    const ticket = db.tickets.find((item) => item.id === ticketId);
    const credential = ticket ? admissionCredentialForTicket(db, ticket) : null;
    const valid = Boolean(ticket)
      && ticket.ownerId === ownerId
      && ticket.currentQr?.signature === signature
      && signature === expected
      && Date.parse(expiresAt) > currentTimeMs()
      && !ticket.currentQr?.usedAt
      && credential?.status !== "USED";
    if (valid) {
      ticket.currentQr.usedAt = now();
      ticket.status = "ADMITTED";
      if (credential) {
        credential.status = "USED";
        credential.usedAt = ticket.currentQr.usedAt;
        credential.updatedAt = now();
      }
    }
    appendLedger(db, ownerId || "GATE", valid ? "GATE_QR_ACCEPTED" : "GATE_QR_REJECTED", {
      ticketId,
      admissionCredentialId: credential?.id || null,
      reason: valid ? "valid-dynamic-token-one-use-consumed" : "invalid-expired-or-replayed-token"
    });
    return { valid };
  }

  return { issueQr, verifyQr };
}
