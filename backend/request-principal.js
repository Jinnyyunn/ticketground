export function createRequestPrincipal({ httpError, nativeSessionPrincipal }) {
  function requireNativePrincipal(db, req) {
    return nativeSessionPrincipal(db, req);
  }

  function requireIdempotencyKey(req) {
    const key = String(req.headers["idempotency-key"] || "").trim();
    if (!key) {
      throw httpError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key 헤더가 필요합니다.");
    }
    if (key.length > 128) {
      throw httpError(422, "IDEMPOTENCY_KEY_INVALID", "Idempotency-Key는 128자 이하여야 합니다.");
    }
    return key;
  }

  return { requireIdempotencyKey, requireNativePrincipal };
}
