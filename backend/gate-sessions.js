import crypto from "node:crypto";

// 게이트(입장 검증) 운영자 인증은 소비자 로그인 세션과 완전히 분리된
// 별도 자격증명이다. 소비자 세션 하나가 게이트 검증 권한까지 가지면
// 소비자 계정 탈취만으로 위조 QR을 "입장 완료" 처리할 수 있게 된다.
export function createGateSessionBackend({
  appendLedger,
  hash,
  httpError,
  id,
  now,
  randomHex
}) {
  function timingSafeStringMatches(actual, expected) {
    const actualBuffer = Buffer.from(String(actual || ""));
    const expectedBuffer = Buffer.from(String(expected || ""));
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  }

  function publicGateSession(gate) {
    return {
      gateId: gate.id,
      gateLabel: gate.gateLabel,
      eventId: gate.eventId,
      status: gate.status,
      createdAt: gate.createdAt,
      lastUsedAt: gate.lastUsedAt,
      revokedAt: gate.revokedAt
    };
  }

  function issueGateSession(db, { gateLabel, eventId }, admin) {
    const label = String(gateLabel || "").trim();
    if (!label) throw httpError(400, "MISSING_FIELD", "gateLabel 값이 필요합니다.");
    const token = randomHex(32);
    const gate = {
      id: id("gate"),
      gateLabel: label,
      eventId: eventId || null,
      tokenHash: hash(token),
      status: "ACTIVE",
      createdAt: now(),
      createdBy: admin?.id || "SYSTEM",
      lastUsedAt: null,
      revokedAt: null
    };
    db.gateSessions.push(gate);
    appendLedger(db, admin?.id || "SYSTEM", "GATE_SESSION_ISSUED", {
      gateId: gate.id,
      gateLabel: gate.gateLabel,
      eventId: gate.eventId
    });
    // 토큰 원문은 이 응답에서 딱 한 번만 노출된다 - 서버는 해시만 보관하므로
    // 이후에는 재발급(신규 게이트 세션 발급 후 기존 토큰 폐기) 외에는 복구할 방법이 없다.
    return { ...publicGateSession(gate), token };
  }

  function revokeGateSession(db, { gateId }, admin) {
    const gate = db.gateSessions.find((item) => item.id === gateId);
    if (!gate) throw httpError(404, "GATE_SESSION_NOT_FOUND", "게이트 세션을 찾을 수 없습니다.");
    gate.status = "REVOKED";
    gate.revokedAt = now();
    appendLedger(db, admin?.id || "SYSTEM", "GATE_SESSION_REVOKED", { gateId: gate.id });
    return publicGateSession(gate);
  }

  function listGateSessions(db) {
    return db.gateSessions.map(publicGateSession);
  }

  function requireGateSession(db, req) {
    const token = req.headers["x-gate-token"];
    if (!token) throw httpError(401, "GATE_AUTH_REQUIRED", "게이트 인증 토큰이 필요합니다.");
    const tokenHash = hash(String(token));
    const gate = db.gateSessions.find((item) =>
      item.status === "ACTIVE" && timingSafeStringMatches(item.tokenHash, tokenHash)
    );
    if (!gate) throw httpError(401, "GATE_AUTH_INVALID", "유효하지 않은 게이트 세션입니다.");
    gate.lastUsedAt = now();
    return gate;
  }

  return { issueGateSession, listGateSessions, requireGateSession, revokeGateSession };
}
