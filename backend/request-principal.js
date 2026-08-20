export function createRequestPrincipal({ httpError, nativeSessionPrincipal }) {
  function requireNativePrincipal(db, req) {
    return nativeSessionPrincipal(db, req);
  }

  function requireIdempotencyKey(req) {
    // Already-shipped iOS/Android builds send X-Idempotency-Key (see
    // AppEnvironment.swift / TicketGroundApiClient.kt) - those installs can't
    // be force-updated, so this must keep accepting the header they actually
    // send, not just the newer Idempotency-Key name.
    const key = String(req.headers["idempotency-key"] || req.headers["x-idempotency-key"] || "").trim();
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
