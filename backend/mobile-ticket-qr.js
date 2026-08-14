import crypto from "node:crypto";

const QR_TTL_MS = 20_000;

export function createMobileTicketQr({ appendLedger, currentTimeMs, executeIdempotent, gateApiKey, hash, hmac, httpError, id, now }) {
  const idempotencyEncryptionKey = Buffer.from(hmac("mobile-qr-idempotency-encryption"), "hex");

  function sealToken(token) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", idempotencyEncryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
  }

  function openToken(sealedToken) {
    const [iv, tag, ciphertext, extra] = String(sealedToken || "").split(".");
    if (!iv || !tag || !ciphertext || extra) throw httpError(500, "QR_REPLAY_UNAVAILABLE", "QR 재발급 정보를 복원할 수 없습니다.");
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", idempotencyEncryptionKey, Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
    } catch {
      throw httpError(500, "QR_REPLAY_UNAVAILABLE", "QR 재발급 정보를 복원할 수 없습니다.");
    }
  }

  const idempotencyResponseCodec = {
    encode(response) {
      const { token, ...safeResponse } = response;
      return { ...safeResponse, sealedToken: sealToken(token) };
    },
    decode(response) {
      const { sealedToken, ...safeResponse } = response;
      return { ...safeResponse, token: openToken(sealedToken) };
    }
  };

  function ownedTicket(db, principal, ticketId) {
    const ticket = db.tickets.find((item) => item.id === ticketId);
    if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
    if (ticket.ownerId !== principal.userId) throw httpError(403, "NOT_OWNER", "본인 티켓만 조회할 수 있습니다.");
    return ticket;
  }

  function safeTicket(db, ticket) {
    const event = db.events.find((item) => item.id === ticket.eventId);
    const performance = event?.dates?.find((item) => item.id === ticket.performanceDateId);
    return {
      id: ticket.id,
      event: { id: event?.id || ticket.eventId, title: event?.title || "공연", venue: event?.venue || null },
      performance: { id: performance?.id || ticket.performanceDateId, startsAt: performance?.startsAt || event?.date || null, label: performance?.label || null },
      seat: { label: ticket.seatLabel },
      status: ticket.status,
      admissionStatus: ticket.status === "ADMITTED" ? "USED" : ticket.status === "OWNED" ? "AVAILABLE" : "CANCELED"
    };
  }

  function tickets(db, principal) {
    return db.tickets.filter((item) => item.ownerId === principal.userId).map((item) => safeTicket(db, item));
  }

  function issue(db, principal, key, ticketId, body) {
    const ticket = ownedTicket(db, principal, ticketId);
    const device = db.deviceRegistrations.find((item) => item.id === body.deviceId && item.userId === principal.userId && item.status === "TRUSTED");
    if (!device) throw httpError(403, "TRUSTED_DEVICE_REQUIRED", "신뢰 기기 등록이 필요합니다.");
    if (ticket.status !== "OWNED") throw httpError(409, ticket.status === "ADMITTED" ? "QR_ALREADY_USED" : "TICKET_CANCELED", "입장 가능한 티켓 상태가 아닙니다.");
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: `MOBILE_QR_ISSUE:${ticketId}`,
      key,
      payload: { deviceId: device.id }
    }, () => {
      for (const current of db.mobileQrTokens) {
        if (current.ticketId === ticket.id && current.status === "VALID") current.status = "REVOKED";
      }
      const issuedAt = now();
      const expiresAt = new Date(currentTimeMs() + QR_TTL_MS).toISOString();
      const qrId = id("mobileqr");
      const nonce = crypto.randomBytes(12).toString("hex");
      const payload = Buffer.from(JSON.stringify({ qrId, ticketId: ticket.id, exp: expiresAt, nonce })).toString("base64url");
      const signature = hmac(payload);
      const token = `${payload}.${signature}`;
      db.mobileQrTokens.push({ id: qrId, ticketId: ticket.id, userId: principal.userId, deviceId: device.id, signatureHash: hash(signature), status: "VALID", issuedAt, expiresAt, usedAt: null, revokedAt: null });
      appendLedger(db, principal.userId, "MOBILE_QR_ISSUED", { ticketId: ticket.id, qrId, expiresAt, ttlSeconds: QR_TTL_MS / 1000 });
      return { token, status: "VALID", issuedAt, expiresAt, ttlSeconds: QR_TTL_MS / 1000, ticket: safeTicket(db, ticket) };
    }, idempotencyResponseCodec);
  }

  function revoke(db, principal, key, ticketId) {
    ownedTicket(db, principal, ticketId);
    return executeIdempotent(db, { actorId: principal.userId, operation: `MOBILE_QR_REVOKE:${ticketId}`, key, payload: { ticketId } }, () => {
      const at = now();
      for (const item of db.mobileQrTokens) {
        if (item.ticketId === ticketId && item.userId === principal.userId && item.status === "VALID") {
          item.status = "REVOKED";
          item.revokedAt = at;
        }
      }
      appendLedger(db, principal.userId, "MOBILE_QR_REVOKED", { ticketId });
      return { status: "REVOKED", ticketId };
    });
  }

  function secureMatches(actual, expected) {
    const left = Buffer.from(String(actual || ""));
    const right = Buffer.from(String(expected || ""));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }

  function authorizeGate(requestKey) {
    if (!gateApiKey || !secureMatches(requestKey, gateApiKey)) throw httpError(401, "GATE_UNAUTHORIZED", "게이트 인증이 필요합니다.");
  }

  function verifyGate(db, requestKey, token) {
    authorizeGate(requestKey);
    const [payload, signature, extra] = String(token || "").split(".");
    if (!payload || !signature || extra || !secureMatches(signature, hmac(payload))) throw httpError(422, "QR_INVALID", "QR 서명이 올바르지 않습니다.");
    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      throw httpError(422, "QR_INVALID", "QR 형식이 올바르지 않습니다.");
    }
    const item = db.mobileQrTokens.find((entry) => entry.id === decoded.qrId && entry.ticketId === decoded.ticketId && secureMatches(entry.signatureHash, hash(signature)));
    if (!item) throw httpError(422, "QR_INVALID", "발급된 QR을 찾을 수 없습니다.");
    if (item.status === "USED") throw httpError(409, "QR_ALREADY_USED", "이미 사용한 QR입니다.");
    if (item.status === "REVOKED") throw httpError(409, "QR_REVOKED", "폐기된 QR입니다.");
    if (Date.parse(item.expiresAt) <= currentTimeMs()) {
      item.status = "EXPIRED";
      throw httpError(409, "QR_EXPIRED", "만료된 QR입니다.");
    }
    const ticket = db.tickets.find((entry) => entry.id === item.ticketId);
    if (!ticket || ticket.status !== "OWNED") throw httpError(409, "TICKET_CANCELED", "취소되었거나 사용할 수 없는 티켓입니다.");
    item.status = "USED";
    item.usedAt = now();
    ticket.status = "ADMITTED";
    appendLedger(db, item.userId, "MOBILE_QR_USED", { ticketId: ticket.id, qrId: item.id });
    return { status: "VALID", ticketId: ticket.id, admittedAt: item.usedAt };
  }

  return { authorizeGate, issueMobileQr: issue, listMobileTickets: tickets, revokeMobileQr: revoke, verifyMobileQrAtGate: verifyGate };
}
