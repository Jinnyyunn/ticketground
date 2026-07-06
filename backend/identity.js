const PORTONE_IDENTITY_VERIFICATION_URL = "https://api.portone.io/identity-verifications";

function normalizePhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("82") && digits.length >= 11) return `0${digits.slice(2)}`;
  return digits;
}

function maskPhoneNumber(normalizedPhone) {
  if (normalizedPhone.length < 8) return normalizedPhone;
  return `${normalizedPhone.slice(0, 3)}-${"*".repeat(Math.max(3, normalizedPhone.length - 7))}-${normalizedPhone.slice(-4)}`;
}

function portOneApiSecret() {
  return (process.env.PORTONE_API_SECRET || process.env.TIG_PORTONE_API_SECRET || "").trim();
}

function portOneStoreId() {
  return (process.env.NEXT_PUBLIC_PORTONE_STORE_ID || process.env.TIG_PORTONE_STORE_ID || "").trim();
}

function portOneDanalChannelKey() {
  return (process.env.NEXT_PUBLIC_PORTONE_DANAL_CHANNEL_KEY || process.env.TIG_PORTONE_DANAL_CHANNEL_KEY || "").trim();
}

function portOneApiConfigured() {
  return Boolean(portOneApiSecret() && portOneStoreId() && portOneDanalChannelKey());
}

function portOneMockAllowed() {
  return process.env.NODE_ENV !== "production" || process.env.TIG_PORTONE_IDENTITY_TEST_MODE === "1";
}

function portOneIdentityLookupUrl(identityVerificationId) {
  const baseUrl = process.env.TIG_PORTONE_IDENTITY_LOOKUP_URL || PORTONE_IDENTITY_VERIFICATION_URL;
  return `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(identityVerificationId)}`;
}

function pickString(record, keys) {
  if (!record || typeof record !== "object") return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function verifiedCustomerFrom(payload) {
  if (!payload || typeof payload !== "object") return {};
  const direct = payload.verifiedCustomer;
  if (direct && typeof direct === "object") return direct;
  const data = payload.data;
  if (!data || typeof data !== "object") return {};
  return data.verifiedCustomer && typeof data.verifiedCustomer === "object" ? data.verifiedCustomer : data;
}

function portOneStatusFrom(payload) {
  if (!payload || typeof payload !== "object") return "";
  const status = pickString(payload, ["status", "identityVerificationStatus"]);
  if (status) return status;
  const data = payload.data;
  return data && typeof data === "object" ? pickString(data, ["status", "identityVerificationStatus"]) : "";
}

function portOneVerificationSucceeded(payload) {
  return /^(VERIFIED|SUCCESS|SUCCEEDED|DONE)$/i.test(portOneStatusFrom(payload));
}

async function readPortOneIdentityVerification({ httpError, identityVerificationId }) {
  const response = await fetch(portOneIdentityLookupUrl(identityVerificationId), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `PortOne ${portOneApiSecret()}`
    }
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw httpError(502, "PORTONE_INVALID_RESPONSE", "포트원 본인인증 응답 형식을 확인하지 못했습니다.");
  }

  if (!response.ok) {
    throw httpError(502, "PORTONE_REQUEST_FAILED", "포트원 본인인증 조회 요청에 실패했습니다.");
  }
  if (!portOneVerificationSucceeded(payload)) {
    throw httpError(422, "PORTONE_IDENTITY_NOT_VERIFIED", "다날 휴대폰 본인인증이 아직 완료되지 않았습니다.");
  }
  return verifiedCustomerFrom(payload);
}

export function createIdentityBackend({ appendLedger, findUser, hash, httpError, id, now }) {
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
      provider: verification?.provider || "portone-danal",
      phoneMasked: verification?.phoneMasked || null,
      verifiedAt: verification?.verifiedAt || null,
      portOneConfigured: portOneApiConfigured(),
      storeId: portOneStoreId(),
      channelKey: portOneDanalChannelKey(),
      mockAvailable: portOneMockAllowed()
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

  function startPortOneDanalVerification(db, { userId, phone }) {
    normalizeIdentityStore(db);
    const user = findUser(db, userId);
    const normalizedPhone = normalizePhoneNumber(phone);
    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      throw httpError(422, "INVALID_PHONE_NUMBER", "휴대폰 번호를 확인해주세요.");
    }

    const phoneHash = hash(`identity-phone:${normalizedPhone}`);
    assertIdentityCanBeVerified(db, user.id, { phoneHash, personHash: "" });
    const existing = db.identityVerifications.find((item) => item.userId === user.id && item.phoneHash === phoneHash && item.status !== "EXPIRED");
    const identityVerificationId = existing?.id || id("idv");
    const verification = existing || {
      id: identityVerificationId,
      userId: user.id,
      provider: "portone-danal",
      phoneHash,
      personHash: null,
      phoneMasked: maskPhoneNumber(normalizedPhone),
      status: "PENDING",
      createdAt: now(),
      verifiedAt: null
    };
    if (!existing) db.identityVerifications.push(verification);

    appendLedger(db, user.id, "IDENTITY_VERIFICATION_STARTED", {
      provider: "portone-danal",
      identityVerificationId: verification.id,
      phoneHash,
      mode: portOneApiConfigured() ? "portone" : "mock"
    });
    return {
      identityVerificationId: verification.id,
      provider: "portone-danal",
      status: verification.status,
      phoneMasked: verification.phoneMasked,
      storeId: portOneStoreId(),
      channelKey: portOneDanalChannelKey(),
      portOneConfigured: portOneApiConfigured(),
      mockAvailable: portOneMockAllowed()
    };
  }

  async function confirmPortOneDanalVerification(db, { userId, phone, identityVerificationId }) {
    normalizeIdentityStore(db);
    const user = findUser(db, userId);

    if (!portOneApiConfigured() && !portOneMockAllowed()) {
      throw httpError(503, "PORTONE_DANAL_NOT_CONFIGURED", "포트원 다날 본인인증 환경변수가 설정되지 않았습니다.");
    }

    let normalizedPhone = normalizePhoneNumber(phone);
    let personKey = "";
    if (portOneApiConfigured() && process.env.TIG_PORTONE_IDENTITY_TEST_MODE !== "1") {
      const customer = await readPortOneIdentityVerification({ httpError, identityVerificationId });
      const verifiedPhone = normalizePhoneNumber(pickString(customer, ["phoneNumber", "mobileNumber", "phone"]));
      if (!verifiedPhone) {
        throw httpError(422, "DANAL_PHONE_NUMBER_UNAVAILABLE", "다날 본인인증 결과에서 휴대폰 번호를 확인하지 못했습니다.");
      }
      if (verifiedPhone !== normalizedPhone) {
        throw httpError(422, "DANAL_PHONE_MISMATCH", "입력한 휴대폰 번호와 본인인증 결과가 일치하지 않습니다.");
      }
      normalizedPhone = verifiedPhone;
      personKey = pickString(customer, ["di", "ci", "identityKey", "customerId"]);
    }

    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      throw httpError(422, "INVALID_PHONE_NUMBER", "휴대폰 번호를 확인해주세요.");
    }

    const phoneHash = hash(`identity-phone:${normalizedPhone}`);
    const personHash = personKey ? hash(`identity-person:${personKey}`) : hash(`identity-person:${normalizedPhone}`);
    assertIdentityCanBeVerified(db, user.id, { phoneHash, personHash });

    const verification = db.identityVerifications.find((item) =>
      item.userId === user.id
      && item.phoneHash === phoneHash
      && (!identityVerificationId || item.id === identityVerificationId)
      && item.status !== "EXPIRED"
    );
    if (!verification) {
      throw httpError(404, "IDENTITY_VERIFICATION_NOT_FOUND", "진행 중인 본인인증 요청을 찾을 수 없습니다.");
    }

    verification.status = "VERIFIED";
    verification.verifiedAt ||= now();
    verification.personHash = personHash;
    verification.phoneMasked = maskPhoneNumber(normalizedPhone);
    user.identityVerification = {
      provider: "portone-danal",
      phoneHash,
      personHash,
      phoneMasked: verification.phoneMasked,
      verifiedAt: verification.verifiedAt
    };
    appendLedger(db, user.id, "IDENTITY_VERIFIED", {
      provider: "portone-danal",
      identityVerificationId: verification.id,
      phoneHash,
      personHash,
      verifiedAt: verification.verifiedAt,
      policy: "unique-phone-per-account"
    });
    return publicIdentityStatus(db, user.id);
  }

  function ensureIdentityVerified(db, userId) {
    const status = publicIdentityStatus(db, userId);
    if (!status.verified) {
      throw httpError(403, "IDENTITY_VERIFICATION_REQUIRED", "티켓 결제 전 본인인증이 필요합니다.");
    }
    return status;
  }

  return {
    confirmPortOneDanalVerification,
    ensureIdentityVerified,
    normalizeIdentityStore,
    publicIdentityStatus,
    startPortOneDanalVerification
  };
}
