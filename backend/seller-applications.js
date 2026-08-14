import { allowedCategories } from "./admin-event-content.js";

const orgTypes = ["AGENCY", "PRODUCTION", "VENUE", "FOUNDATION", "SPORTS_CLUB", "OTHER"];
const channelTypes = ["EXCLUSIVE", "SHARED", "SEAT_PRIORITY", "PRESALE"];
const dataUrlMaxBytes = 5 * 1024 * 1024;

export function createSellerApplicationBackend({ appendLedger, clone, httpError, id, now }) {
function cleanText(value, maxLength = 2000) {
  return String(value || "").trim().slice(0, maxLength);
}

function requiredText(value, message = "필수 항목을 입력해주세요.") {
  const text = cleanText(value);
  if (!text) throw httpError(400, "MISSING_FIELD", message);
  return text;
}

function optionalText(value, maxLength = 2000) {
  const text = cleanText(value, maxLength);
  return text || "";
}

function normalizeEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(422, "INVALID_EMAIL", "이메일 형식을 확인해주세요.");
  }
  return email;
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!/^0\d{9,10}$/.test(digits)) {
    throw httpError(422, "INVALID_PHONE", "연락처 형식을 확인해주세요.");
  }
  return digits.replace(/^(010)(\d{4})(\d{4})$/, "$1-$2-$3");
}

function normalizeBizRegistrationNumber(value) {
  const text = cleanText(value, 12);
  if (!/^\d{3}-\d{2}-\d{5}$/.test(text)) {
    throw httpError(422, "INVALID_BIZ_REGISTRATION_NUMBER", "사업자등록번호 형식을 확인해주세요.");
  }
  return text;
}

function normalizeDataUrl(value, { code, message, mimePattern }) {
  const match = /^data:([^;]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(value || ""));
  if (!match || !mimePattern.test(match[1])) {
    throw httpError(422, code, message);
  }
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > dataUrlMaxBytes) {
    throw httpError(422, code, message);
  }
  return `data:${match[1]};base64,${match[2]}`;
}

function normalizeCategory(value) {
  const rawCategory = cleanText(value, 40);
  const category = rawCategory === "festival" ? "concert" : rawCategory;
  if (!allowedCategories.includes(category)) {
    throw httpError(422, "INVALID_CATEGORY", "지원하지 않는 행사 유형입니다.");
  }
  return category;
}

// The admin catalog tool's prefill round-trips these values back through
// comma/pipe-delimited textareas ("등급,좌석명,가격,수량" / "회차명|날짜|시간1,시간2"),
// so a "," or "|" inside a name/date here would silently shift columns and
// corrupt prices/dates on the live event once an admin submits the
// pre-filled form without editing every line by hand.
function assertNoDelimiters(text, code, message) {
  if (/[,|]/.test(text)) {
    throw httpError(422, code, message);
  }
  return text;
}

function normalizeSessions(value) {
  if (!Array.isArray(value) || !value.length) {
    throw httpError(422, "INVALID_SESSIONS", "공연 일정을 하나 이상 입력해주세요.");
  }
  return value.map((session, index) => {
    const date = cleanText(session?.date, 40);
    const times = Array.isArray(session?.times) ? session.times.map((time) => cleanText(time, 20)).filter(Boolean) : [];
    if (!date || !times.length) {
      throw httpError(422, "INVALID_SESSIONS", "공연 일정을 하나 이상 입력해주세요.", { index });
    }
    const label = optionalText(session.label, 80) || `${index + 1}회차`;
    const delimiterMessage = "회차명, 날짜, 시간에는 쉼표(,)나 파이프(|)를 사용할 수 없습니다.";
    assertNoDelimiters(label, "INVALID_SESSIONS", delimiterMessage);
    assertNoDelimiters(date, "INVALID_SESSIONS", delimiterMessage);
    for (const time of times) assertNoDelimiters(time, "INVALID_SESSIONS", delimiterMessage);
    return { label, date, times };
  });
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeSeatGrades(value) {
  if (!Array.isArray(value) || !value.length) {
    throw httpError(422, "INVALID_SEAT_GRADES", "좌석 등급/가격/수량을 확인해주세요.");
  }
  return value.map((grade, index) => {
    const gradeName = cleanText(grade?.gradeName, 80);
    const price = positiveInteger(grade?.price);
    const quantity = positiveInteger(grade?.quantity);
    if (!gradeName || price === null || quantity === null) {
      throw httpError(422, "INVALID_SEAT_GRADES", "좌석 등급/가격/수량을 확인해주세요.", { index });
    }
    assertNoDelimiters(gradeName, "INVALID_SEAT_GRADES", "좌석 등급명에는 쉼표(,)나 파이프(|)를 사용할 수 없습니다.");
    return { gradeName, price, quantity };
  });
}

function normalizeOrganization(value = {}) {
  const orgType = cleanText(value.orgType, 40);
  if (!orgTypes.includes(orgType)) {
    throw httpError(422, "INVALID_ORG_TYPE", "지원하지 않는 기관 유형입니다.");
  }
  return {
    legalName: requiredText(value.legalName),
    orgType,
    bizRegistrationNumber: normalizeBizRegistrationNumber(value.bizRegistrationNumber),
    bizRegistrationDocDataUrl: normalizeDataUrl(value.bizRegistrationDocDataUrl, {
      code: "INVALID_BIZ_REGISTRATION_DOC",
      message: "사업자등록증 파일 형식을 확인해주세요.",
      mimePattern: /^(image\/(?:png|jpeg|webp)|application\/pdf)$/
    }),
    representativeName: requiredText(value.representativeName),
    address: optionalText(value.address, 240),
    website: optionalText(value.website, 240)
  };
}

function normalizeContact(value = {}) {
  return {
    name: requiredText(value.name),
    title: optionalText(value.title, 80),
    phone: normalizePhone(value.phone),
    email: normalizeEmail(value.email)
  };
}

function normalizeProposedEvent(value = {}) {
  return {
    title: requiredText(value.title),
    category: normalizeCategory(value.category),
    venueName: requiredText(value.venueName),
    sessions: normalizeSessions(value.sessions),
    seatGrades: normalizeSeatGrades(value.seatGrades),
    desiredSaleOpenDate: optionalText(value.desiredSaleOpenDate, 40),
    eventDateRange: optionalText(value.eventDateRange, 120),
    discountPolicyNotes: optionalText(value.discountPolicyNotes, 2000),
    posterImageDataUrl: normalizeDataUrl(value.posterImageDataUrl, {
      code: "INVALID_POSTER_IMAGE",
      message: "포스터 이미지는 PNG, JPEG, WebP 형식으로 등록해주세요.",
      mimePattern: /^image\/(?:png|jpeg|webp)$/
    }),
    castNotes: optionalText(value.castNotes, 2000),
    summaryDraft: optionalText(value.summaryDraft, 400),
    noticesDraft: optionalText(value.noticesDraft, 2000)
  };
}

function normalizeSaleTerms(value = {}) {
  const channelType = cleanText(value.channelType, 40);
  if (!channelTypes.includes(channelType)) {
    throw httpError(422, "INVALID_CHANNEL_TYPE", "지원하지 않는 판매 채널 유형입니다.");
  }
  const settlement = value.settlement || {};
  if (!cleanText(settlement.bankName) || !cleanText(settlement.accountNumber) || !cleanText(settlement.accountHolder)) {
    throw httpError(400, "MISSING_FIELD", "정산 계좌 정보를 입력해주세요.");
  }
  return {
    channelType,
    requestedCommissionNotes: optionalText(value.requestedCommissionNotes, 2000),
    settlement: {
      bankName: cleanText(settlement.bankName, 80),
      accountNumber: cleanText(settlement.accountNumber, 80),
      accountHolder: cleanText(settlement.accountHolder, 80)
    }
  };
}

function assertRequiredTopLevelFields(payload) {
  const checks = [
    payload?.organization?.legalName,
    payload?.organization?.representativeName,
    payload?.contact?.name,
    payload?.contact?.phone,
    payload?.contact?.email,
    payload?.proposedEvent?.title,
    payload?.proposedEvent?.venueName
  ];
  if (checks.some((value) => !cleanText(value))) {
    throw httpError(400, "MISSING_FIELD", "필수 항목을 입력해주세요.");
  }
}

function findApplication(db, applicationId) {
  const application = db.sellerApplications.find((item) => item.id === applicationId);
  if (!application) throw httpError(404, "SELLER_APPLICATION_NOT_FOUND", "판매자 신청을 찾을 수 없습니다.");
  return application;
}

function assertPending(application) {
  if (["APPROVED", "REJECTED", "REGISTERED"].includes(application.status)) {
    throw httpError(409, "SELLER_APPLICATION_ALREADY_REVIEWED", "이미 검토가 완료된 신청입니다.");
  }
}

function pageOptions(options = {}) {
  const page = Math.max(1, Number.parseInt(String(options.page || "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(options.limit || "50"), 10) || 50));
  return { page, limit };
}

function submitSellerApplication(db, payload) {
  assertRequiredTopLevelFields(payload);
  if (payload.privacyConsent !== true || payload.preliminaryAcknowledged !== true) {
    throw httpError(400, "CONSENT_REQUIRED", "필수 동의 항목을 확인해주세요.");
  }
  const organization = normalizeOrganization(payload.organization);
  const contact = normalizeContact(payload.contact);
  const proposedEvent = normalizeProposedEvent(payload.proposedEvent);
  const saleTerms = normalizeSaleTerms(payload.saleTerms);
  const createdAt = now();
  const application = {
    id: id("sapp"),
    organization,
    contact,
    proposedEvent,
    saleTerms,
    otherNotes: optionalText(payload.otherNotes, 2000),
    privacyConsent: true,
    preliminaryAcknowledged: true,
    status: "PENDING",
    createdAt,
    updatedAt: createdAt,
    review: {
      verificationChecklist: {
        bizNumberVerified: false,
        contactPhoneVerified: false,
        eventAuthenticityChecked: false
      },
      log: [{ at: createdAt, by: "PUBLIC", action: "SUBMITTED", note: null }],
      rejectionReason: null,
      linkedEventId: null
    }
  };
  db.sellerApplications.push(application);
  appendLedger(db, "PUBLIC", "SELLER_APPLICATION_SUBMITTED", {
    applicationId: application.id,
    legalName: application.organization.legalName,
    eventTitle: application.proposedEvent.title
  });
  return { id: application.id, status: "PENDING", createdAt };
}

function listSellerApplications(db, options = {}) {
  const status = options.status ? String(options.status).toUpperCase() : null;
  const filtered = db.sellerApplications
    .filter((application) => !status || application.status === status)
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  const { page, limit } = pageOptions(options);
  const start = (page - 1) * limit;
  return {
    applications: clone(filtered.slice(start, start + limit)),
    page: {
      page,
      limit,
      total: filtered.length,
      hasNext: start + limit < filtered.length,
      hasPrevious: page > 1
    }
  };
}

function updateSellerApplicationChecklist(db, payload, actor) {
  const application = findApplication(db, payload.applicationId);
  assertPending(application);
  const changes = {};
  for (const key of ["bizNumberVerified", "contactPhoneVerified", "eventAuthenticityChecked"]) {
    if (Object.hasOwn(payload, key)) {
      const nextValue = Boolean(payload[key]);
      if (application.review.verificationChecklist[key] !== nextValue) changes[key] = nextValue;
      application.review.verificationChecklist[key] = nextValue;
    }
  }
  const at = now();
  application.updatedAt = at;
  application.review.log.push({
    at,
    by: actor?.id || "ADMIN",
    action: "CHECKLIST_UPDATED",
    note: JSON.stringify(changes)
  });
  return clone(application);
}

function approveSellerApplication(db, { applicationId, reviewNote }, actor) {
  const application = findApplication(db, applicationId);
  assertPending(application);
  const checklist = application.review.verificationChecklist;
  if (!checklist.bizNumberVerified || !checklist.contactPhoneVerified || !checklist.eventAuthenticityChecked) {
    throw httpError(422, "VERIFICATION_CHECKLIST_INCOMPLETE", "검증 체크리스트를 모두 완료해야 승인할 수 있습니다.", { checklist: clone(checklist) });
  }
  const at = now();
  application.status = "APPROVED";
  application.updatedAt = at;
  application.review.log.push({
    at,
    by: actor?.id || "ADMIN",
    action: "APPROVED",
    note: cleanText(reviewNote) || null
  });
  appendLedger(db, "ADMIN", "SELLER_APPLICATION_APPROVED", {
    applicationId,
    legalName: application.organization.legalName
  });
  return clone(application);
}

function rejectSellerApplication(db, { applicationId, reviewNote }, actor) {
  const note = cleanText(reviewNote);
  if (!note) throw httpError(400, "MISSING_FIELD", "반려 사유를 입력해주세요.");
  const application = findApplication(db, applicationId);
  assertPending(application);
  const at = now();
  application.status = "REJECTED";
  application.updatedAt = at;
  application.review.rejectionReason = note;
  application.review.log.push({
    at,
    by: actor?.id || "ADMIN",
    action: "REJECTED",
    note
  });
  appendLedger(db, "ADMIN", "SELLER_APPLICATION_REJECTED", {
    applicationId,
    reviewNote: note
  });
  return clone(application);
}

  return {
    approveSellerApplication,
    listSellerApplications,
    rejectSellerApplication,
    submitSellerApplication,
    updateSellerApplicationChecklist
  };
}
