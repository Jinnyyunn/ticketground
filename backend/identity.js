import crypto from "node:crypto";

// NICE 통합인증 API (auth-guide.niceid.co.kr, "통합인증 서비스 가이드"). 엔드포인트/필드명은
// 2026-08-13에 가이드 원문에서 확인한 값이며, 실제 테스트베드 호출로 아직 검증되지 않았다 -
// 문제가 생기면 가이드 원문과 다시 대조할 것. `NICE 본인인증 연동 계획서.md` 참고.
const NICE_TOKEN_URL = "https://auth.niceid.co.kr/ido/intc/v1.0/auth/token";
const NICE_AUTH_URL_ENDPOINT = "https://auth.niceid.co.kr/ido/intc/v1.0/auth/url";
const NICE_RESULT_URL = "https://auth.niceid.co.kr/ido/intc/v1.0/auth/result";

function normalizePhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("82") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

function maskPhoneNumber(normalizedPhone) {
  if (normalizedPhone.length < 8) return normalizedPhone;
  return `${normalizedPhone.slice(0, 3)}-${"*".repeat(Math.max(3, normalizedPhone.length - 7))}-${normalizedPhone.slice(-4)}`;
}

function niceClientId() {
  return (process.env.TIG_NICE_CLIENT_ID || "").trim();
}

function niceClientSecret() {
  return (process.env.TIG_NICE_CLIENT_SECRET || "").trim();
}

function niceCallbackReturnUrl() {
  return (process.env.TIG_NICE_CALLBACK_RETURN_URL || "").trim();
}

function niceDevLang() {
  return (process.env.TIG_NICE_DEV_LANG || "Linux/Node.js").trim();
}

function niceProductCodeAdult() {
  return (process.env.TIG_NICE_PRODUCT_CODE_ADULT || "").trim();
}

function niceApiConfigured() {
  return Boolean(niceClientId() && niceClientSecret() && niceCallbackReturnUrl());
}

function niceTestModeForced() {
  return process.env.TIG_NICE_IDENTITY_TEST_MODE === "1";
}

function niceMockAllowed() {
  return process.env.NODE_ENV !== "production" || niceTestModeForced();
}

// TIG_NICE_IDENTITY_TEST_MODE=1 always wins even if real credentials happen to be
// present (e.g. local/CI runs against a checkout that also has .env.local's real
// TIG_NICE_CLIENT_ID/SECRET) - otherwise tests would silently hit the live NICE API.
function realNiceApiAllowed() {
  return niceApiConfigured() && !niceTestModeForced();
}

// 표준창 인증수단 코드: 우리 계약은 휴대폰(M)만 쓴다. 성인인증은 상품 코드/연동 방식이
// 아직 확인되지 않아 미지원 - `TIG_NICE_PRODUCT_CODE_ADULT`가 채워지고 실제 연동 방식이
// 확인된 뒤에 추가한다.
const SVC_TYPES_BY_PRODUCT = { phone: ["M"] };

function generateNiceRequestNo() {
  return `TIG${Date.now()}${crypto.randomBytes(8).toString("hex")}`;
}

function pickString(record, keys) {
  if (!record || typeof record !== "object") return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function niceApiCall(url, { headers, body }) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Intc-DevLang": niceDevLang(), ...headers },
    body: JSON.stringify(body)
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || !payload || payload.result_code !== "0000") {
    const providerCode = String(payload?.result_code || "");
    const detail = payload ? `${providerCode} ${payload.result_message || ""}`.trim() : `HTTP ${response.status}`;
    const error = new Error(`NICE API 요청이 실패했습니다 (${url}): ${detail}`);
    error.niceDetail = detail;
    if (providerCode === "1006") {
      error.code = "NICE_CLIENT_PERMISSION";
      error.status = 503;
      error.detail = { providerCode, action: "NICE 통합인증 API 사용 권한과 Client ID 발급 상품을 확인하세요." };
    } else if (providerCode === "1007") {
      error.code = "NICE_OUTBOUND_IP_DENIED";
      error.status = 503;
      error.detail = { providerCode, action: "NICE에 실제 서버 Outbound IP 또는 Cloudflare 연동 IP 등록을 요청하세요." };
    }
    throw error;
  }
  return payload;
}

async function requestNiceAccessToken(requestNo) {
  // 가이드 원문: "Authorization: Basic {Base64UrlEncoding(client_id + ':' + client_secret)}" -
  // 표준 base64가 아니라 base64url(패딩 없음)을 명시하고 있어 그대로 맞춘다.
  return niceApiCall(NICE_TOKEN_URL, {
    headers: { Authorization: `Basic ${Buffer.from(`${niceClientId()}:${niceClientSecret()}`).toString("base64url")}` },
    body: { grant_type: "client_credentials", request_no: requestNo }
  });
}

async function requestNiceAuthUrl({ accessToken, requestNo, returnUrl, svcTypes }) {
  return niceApiCall(NICE_AUTH_URL_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { request_no: requestNo, return_url: returnUrl, svc_types: svcTypes, method_type: "GET" }
  });
}

async function requestNiceResult({ accessToken, requestNo, transactionId, webTransactionId }) {
  return niceApiCall(NICE_RESULT_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { web_transaction_id: webTransactionId, transaction_id: transactionId, request_no: requestNo }
  });
}

// KDF: PBKDF2WithHmacSHA256(password=ticket, salt=transactionId, iterations).
// 가이드 원문은 출력키를 "512bit"라 적어놓고 코드 예시는 "48바이트째부터 32바이트를
// 무결성/HMAC 키로 쓴다"고 해서 앞뒤가 안 맞는다(64바이트로는 80바이트째까지 못 읽음).
// PBKDF2는 블록 단위로 늘어나도 앞쪽 바이트가 안 바뀌므로, 두 해석을 모두 만족하도록
// 80바이트를 요청해서 0-31(AES 키)/48-79(HMAC 키) 둘 다 안전하게 잘라 쓴다.
function deriveNiceKeys({ ticket, transactionId, iterations }) {
  const material = crypto.pbkdf2Sync(ticket, transactionId, iterations, 80, "sha256");
  return { aesKey: material.subarray(0, 32), hmacKey: material.subarray(48, 80) };
}

// enc_data = base64url(IV(16) + ciphertext + GCM tag(16)). AES/GCM은 그 자체로 인증
// 암호(AEAD)라 setAuthTag 검증에 실패하면 decipher.final()이 던진다 - 그게 사실상의
// 무결성 검증이라, NICE가 별도로 내려주는 integrity_value는 지금은 따로 재검증하지
// 않는다(정확한 계산식이 가이드에 명시돼 있지 않았다).
function decryptNiceEncData(encData, aesKey) {
  const raw = Buffer.from(encData, "base64url");
  const iv = raw.subarray(0, 16);
  const tag = raw.subarray(raw.length - 16);
  const cipherText = raw.subarray(16, raw.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(cipherText), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext);
}

// 필드명은 가이드 원문 기준(name/birthdate/gender/national_info/ci/di/mobile_co/mobile_no)이지만
// 실제 응답에서 표기가 다를 가능성을 감안해 흔한 변형도 함께 시도한다.
function niceResultFields(decrypted) {
  return {
    ci: pickString(decrypted, ["ci", "CI"]),
    di: pickString(decrypted, ["di", "DI"]),
    mobileNo: pickString(decrypted, ["mobile_no", "mobileno", "mobileNo", "phone_no", "phoneno"]),
    name: pickString(decrypted, ["name", "utf8_name", "username"]),
    birthdate: pickString(decrypted, ["birthdate", "birth_date"]),
    gender: pickString(decrypted, ["gender"]),
    nationalInfo: pickString(decrypted, ["national_info", "nationalinfo"])
  };
}

export function createIdentityBackend({ appendLedger, findUser, hash, hmac, httpError, id, now }) {
  function normalizeIdentityStore(db) {
    db.identityVerifications ||= [];
    for (const user of db.users || []) {
      if (user.identityVerification?.phoneHash || user.identityVerification?.personHash) continue;
      user.identityVerification = user.identityVerification || null;
    }
  }

  function publicIdentityStatus(db, userId) {
    normalizeIdentityStore(db);
    const user = findUser(db, userId);
    const verification = user.identityVerification || null;
    return {
      userId: user.id,
      verified: Boolean(verification?.verifiedAt),
      provider: verification?.provider || "nice-standard",
      phoneMasked: verification?.phoneMasked || null,
      verifiedAt: verification?.verifiedAt || null,
      niceConfigured: realNiceApiAllowed(),
      mockAvailable: niceMockAllowed()
    };
  }

  function assertIdentityCanBeVerified(db, userId, { personHash, phoneHash }) {
    const usedByOtherUser = db.users.find((user) => {
      if (user.id === userId) return false;
      const verification = user.identityVerification || null;
      return (phoneHash && verification?.phoneHash === phoneHash) || (personHash && verification?.personHash === personHash);
    });
    if (usedByOtherUser) {
      throw httpError(409, "PHONE_ALREADY_VERIFIED", "이미 다른 계정에서 인증된 휴대폰 번호입니다.");
    }
  }

  function identityKeyHash(ciOrDi) {
    return hmac(`nice-standard:${ciOrDi}`);
  }

  async function startNiceVerification(db, { userId, product = "phone" }) {
    normalizeIdentityStore(db);
    const user = findUser(db, userId);
    if (!niceApiConfigured() && !niceMockAllowed()) {
      throw httpError(503, "NICE_NOT_CONFIGURED", "NICE 본인인증 환경변수가 설정되지 않았습니다.");
    }
    if (product !== "phone") {
      if (!niceProductCodeAdult()) {
        throw httpError(503, "NICE_ADULT_NOT_CONFIGURED", "성인인증은 아직 도입되지 않았습니다.");
      }
      throw httpError(501, "NICE_ADULT_NOT_IMPLEMENTED", "성인인증 연동은 아직 구현되지 않았습니다.");
    }

    const identityVerificationId = id("idv");
    const tokenRequestNo = generateNiceRequestNo();
    const authRequestNo = generateNiceRequestNo();
    const record = {
      id: identityVerificationId,
      userId: user.id,
      provider: "nice-standard",
      product,
      phoneHash: null,
      personHash: null,
      phoneMasked: null,
      status: "PENDING",
      requestNo: authRequestNo,
      tokenRequestNo,
      ticket: null,
      iterators: null,
      transactionId: null,
      accessToken: null,
      createdAt: now(),
      verifiedAt: null
    };
    db.identityVerifications.push(record);

    let authUrl = null;
    if (realNiceApiAllowed()) {
      const returnUrl = new URL(niceCallbackReturnUrl());
      returnUrl.searchParams.set("rid", identityVerificationId);
      const token = await requestNiceAccessToken(tokenRequestNo);
      const auth = await requestNiceAuthUrl({
        accessToken: token.access_token,
        requestNo: authRequestNo,
        returnUrl: returnUrl.toString(),
        svcTypes: SVC_TYPES_BY_PRODUCT[product]
      });
      record.ticket = token.ticket;
      record.iterators = token.iterators;
      record.accessToken = token.access_token;
      record.transactionId = auth.transaction_id;
      authUrl = auth.auth_url;
    }

    appendLedger(db, user.id, "IDENTITY_VERIFICATION_STARTED", {
      provider: "nice-standard",
      identityVerificationId,
      product,
      mode: realNiceApiAllowed() ? "nice" : "mock"
    });

    return {
      identityVerificationId,
      provider: "nice-standard",
      status: record.status,
      product,
      authUrl,
      niceConfigured: realNiceApiAllowed(),
      mockAvailable: niceMockAllowed()
    };
  }

  function findPendingRecord(db, predicate) {
    normalizeIdentityStore(db);
    const record = db.identityVerifications.find((item) => item.status === "PENDING" && predicate(item));
    if (!record) throw httpError(404, "IDENTITY_VERIFICATION_NOT_FOUND", "진행 중인 본인인증 요청을 찾을 수 없습니다.");
    return record;
  }

  function finalizeVerification(db, record, { normalizedPhone, ciOrDi, mode }) {
    const user = findUser(db, record.userId);
    const phoneHash = normalizedPhone ? hash(`identity-phone:${normalizedPhone}`) : null;
    const personHash = ciOrDi ? identityKeyHash(ciOrDi) : identityKeyHash(normalizedPhone);
    assertIdentityCanBeVerified(db, user.id, { phoneHash, personHash });

    record.status = "VERIFIED";
    record.verifiedAt ||= now();
    record.phoneHash = phoneHash;
    record.personHash = personHash;
    record.phoneMasked = normalizedPhone ? maskPhoneNumber(normalizedPhone) : null;
    user.identityVerification = {
      provider: "nice-standard",
      phoneHash,
      personHash,
      phoneMasked: record.phoneMasked,
      verifiedAt: record.verifiedAt
    };
    appendLedger(db, user.id, "IDENTITY_VERIFIED", {
      provider: "nice-standard",
      identityVerificationId: record.id,
      product: record.product,
      phoneHash,
      personHash,
      verifiedAt: record.verifiedAt,
      mode,
      policy: "unique-phone-per-account"
    });
    return publicIdentityStatus(db, user.id);
  }

  // 실제 콜백: NICE가 사용자의 브라우저를 return_url(=/api/identity/nice/callback?rid=...)로
  // 돌려보내며 web_transaction_id를 넘겨준다(서버 push가 아니라 브라우저 경유). rid로 우리
  // 쪽에 저장해둔 세션(ticket/transactionId/accessToken)을 찾아 결과를 조회·복호화한다.
  async function completeNiceVerificationFromCallback(db, { identityVerificationId, webTransactionId }) {
    if (!webTransactionId) throw httpError(400, "NICE_WEB_TRANSACTION_ID_REQUIRED", "인증 결과 값을 확인할 수 없습니다.");
    const record = findPendingRecord(db, (item) => item.id === identityVerificationId && item.provider === "nice-standard");
    if (!record.accessToken || !record.ticket || !record.transactionId) {
      throw httpError(409, "NICE_VERIFICATION_NOT_STARTED", "본인인증 요청 정보가 올바르지 않습니다.");
    }

    const result = await requestNiceResult({
      accessToken: record.accessToken,
      requestNo: record.requestNo,
      transactionId: record.transactionId,
      webTransactionId
    });
    const { aesKey } = deriveNiceKeys({ ticket: record.ticket, transactionId: record.transactionId, iterations: record.iterators });
    const decrypted = decryptNiceEncData(result.enc_data, aesKey);
    const fields = niceResultFields(decrypted);
    const normalizedPhone = normalizePhoneNumber(fields.mobileNo);
    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      throw httpError(422, "NICE_PHONE_NUMBER_UNAVAILABLE", "본인인증 결과에서 휴대폰 번호를 확인하지 못했습니다.");
    }
    const ciOrDi = fields.ci || fields.di;
    return finalizeVerification(db, record, { normalizedPhone, ciOrDi, mode: "nice" });
  }

  // 목(mock) 경로: 실제 NICE 왕복 없이 로컬/CI에서 결정적으로 테스트하기 위한 것. 운영에서는
  // niceMockAllowed()가 항상 false라 절대 쓸 수 없다.
  function mockCompleteNiceVerification(db, { userId, identityVerificationId, phone }) {
    if (!niceMockAllowed()) {
      throw httpError(404, "NOT_FOUND", "요청한 API가 없습니다.");
    }
    const user = findUser(db, userId);
    const record = findPendingRecord(db, (item) => item.id === identityVerificationId && item.userId === user.id && item.provider === "nice-standard");
    const normalizedPhone = normalizePhoneNumber(phone);
    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      throw httpError(422, "INVALID_PHONE_NUMBER", "휴대폰 번호를 확인해주세요.");
    }
    return finalizeVerification(db, record, { normalizedPhone, ciOrDi: null, mode: "mock" });
  }

  function ensureIdentityVerified(db, userId) {
    const status = publicIdentityStatus(db, userId);
    if (!status.verified) {
      throw httpError(403, "IDENTITY_VERIFICATION_REQUIRED", "티켓 결제 전 본인인증이 필요합니다.");
    }
    return status;
  }

  return {
    completeNiceVerificationFromCallback,
    ensureIdentityVerified,
    mockCompleteNiceVerification,
    normalizeIdentityStore,
    publicIdentityStatus,
    startNiceVerification
  };
}
