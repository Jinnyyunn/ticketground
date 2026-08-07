// Gate operator API client. Deliberately separate from ticketground-api.ts:
// gate auth uses the x-gate-token header (backend/gate-sessions.js), a
// credential namespace completely independent of consumer session Bearer
// tokens - mixing the two client helpers would make it too easy to
// accidentally send a consumer session where a gate token belongs, or vice
// versa (see "게이트 운영자 인증 경계" in 애플리케이션 QR 검증 및 스캐너 계획서.md).
export interface GateVerifyPayload {
  readonly ticketId: string;
  readonly ownerId: string;
  readonly expiresAt: string;
  readonly nonce: string;
  readonly signature: string;
}

export interface GateVerifyResult {
  readonly valid: boolean;
  readonly alreadyUsed?: boolean;
  readonly usedAt?: string | null;
  readonly usedByGateId?: string | null;
}

export class GateApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "GateApiError";
    this.code = code;
    this.status = status;
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

// The QR the (not-yet-built) native ticket-holder app renders encodes
// exactly the fields backend/admission-qr.js's issueQr() response and
// /api/gate/verify's request body share - see the 계획서 5장 for how
// issueQr() returns { ticketId, ownerId, expiresAt, nonce, signature, ... }.
// This is the scanner's half of that contract.
export function parseGateQrPayload(raw: string): GateVerifyPayload {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new GateApiError("QR 내용을 해석할 수 없습니다.", "MALFORMED_QR", 0);
  }
  if (typeof data !== "object" || data === null) {
    throw new GateApiError("QR 형식이 올바르지 않습니다.", "MALFORMED_QR", 0);
  }
  const record = data as Record<string, unknown>;
  if (
    !isNonEmptyString(record.ticketId)
    || !isNonEmptyString(record.ownerId)
    || !isNonEmptyString(record.expiresAt)
    || !isNonEmptyString(record.nonce)
    || !isNonEmptyString(record.signature)
  ) {
    throw new GateApiError("QR 형식이 올바르지 않습니다.", "MALFORMED_QR", 0);
  }
  return {
    ticketId: record.ticketId,
    ownerId: record.ownerId,
    expiresAt: record.expiresAt,
    nonce: record.nonce,
    signature: record.signature,
  };
}

export async function verifyGateQr(gateToken: string, payload: GateVerifyPayload): Promise<GateVerifyResult> {
  let response: Response;
  try {
    response = await fetch("/api/gate/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-gate-token": gateToken },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new GateApiError(
      error instanceof Error ? error.message : "네트워크에 연결할 수 없습니다.",
      "NETWORK_ERROR",
      0,
    );
  }
  let json: { ok?: boolean; data?: GateVerifyResult; error?: { code?: string; message?: string } };
  try {
    json = await response.json();
  } catch {
    throw new GateApiError("게이트 서버 응답을 해석할 수 없습니다.", "INVALID_RESPONSE", response.status);
  }
  if (!response.ok || !json.ok || !json.data) {
    throw new GateApiError(
      json.error?.message ?? "게이트 인증에 실패했습니다.",
      json.error?.code ?? "GATE_ERROR",
      response.status,
    );
  }
  return json.data;
}
