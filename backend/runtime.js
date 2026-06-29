import crypto from "node:crypto";

const PAYMENT_METHODS = {
  CREDIT_CARD: { label: "신용카드", status: "PAID" },
  BANK_TRANSFER: { label: "계좌이체", status: "PAID" },
  BANK_DEPOSIT: { label: "무통장 입금", status: "WAITING_DEPOSIT" },
  MOBILE: { label: "휴대폰 결제", status: "PAID" }
};

export function createRuntime({ appAttestationSecret, nowOverride, secret }) {
  const attestationSecret = appAttestationSecret || crypto.randomBytes(32).toString("hex");

  function currentTimeMs() {
    if (!nowOverride) return Date.now();
    const parsed = Date.parse(nowOverride);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }

  function now() {
    return new Date(currentTimeMs()).toISOString();
  }

  function offsetIso(startsAt, milliseconds) {
    return new Date(Date.parse(startsAt) - milliseconds).toISOString();
  }

  function money(value) {
    return Math.round(Number(value));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function httpError(status, code, message, detail = {}) {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    error.detail = detail;
    return error;
  }

  function resolvePaymentMethod(paymentMethod = "CREDIT_CARD") {
    const key = String(paymentMethod || "CREDIT_CARD").toUpperCase();
    const method = PAYMENT_METHODS[key];
    if (!method) throw httpError(422, "UNSUPPORTED_PAYMENT_METHOD", "지원하지 않는 결제수단입니다.");
    return { key, ...method };
  }

  function hash(input) {
    return crypto.createHash("sha256").update(input).digest("hex");
  }

  function hmac(input) {
    return crypto.createHmac("sha256", secret).update(input).digest("hex");
  }

  function appAttestationSignature(purpose, ...parts) {
    return crypto
      .createHmac("sha256", attestationSecret)
      .update(["app", purpose, ...parts].join(":"))
      .digest("hex");
  }

  function verifyAppAttestation(body, purpose, parts) {
    const expected = appAttestationSignature(purpose, ...parts.map((part) => String(part || "")));
    const provided = String(body.appAttestation || "");
    const expectedBuffer = Buffer.from(expected, "hex");
    const providedBuffer = Buffer.from(provided, "hex");
    if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw httpError(403, "APP_ATTESTATION_REQUIRED", "전용앱 인증 서명이 필요합니다.");
    }
  }

  function id(prefix) {
    return `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
  }

  function randomHex(bytes) {
    return crypto.randomBytes(bytes).toString("hex");
  }

  function stableId(prefix, ...parts) {
    return `${prefix}_${hash(parts.join(":")) .slice(0, 12)}`;
  }

  function sortJson(value) {
    if (Array.isArray(value)) return value.map(sortJson);
    if (value && typeof value === "object") {
      return Object.keys(value).sort().reduce((acc, key) => {
        acc[key] = sortJson(value[key]);
        return acc;
      }, {});
    }
    return value;
  }

  function findUser(db, userId) {
    const user = db.users.find((item) => item.id === userId);
    if (!user) throw httpError(404, "USER_NOT_FOUND", "사용자를 찾을 수 없습니다.");
    if (user.status === "BANNED") throw httpError(403, "USER_BANNED", "제재된 사용자는 거래할 수 없습니다.");
    return user;
  }

  return {
    clone,
    currentTimeMs,
    findUser,
    hash,
    hmac,
    httpError,
    id,
    money,
    now,
    offsetIso,
    randomHex,
    resolvePaymentMethod,
    stableId,
    sortJson,
    verifyAppAttestation
  };
}
