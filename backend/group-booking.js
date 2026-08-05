import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ORG_TYPES = new Set(["SCHOOL", "ACADEMY", "WELFARE", "COMPANY", "GOVERNMENT", "OTHER"]);
const PAYMENT_METHODS = new Set(["CARD", "TAX_INVOICE", "BANK_TRANSFER"]);
const REVIEWED_STATUSES = new Set(["APPROVED", "REJECTED"]);
const MAX_HEADCOUNT = 5000;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const BUSINESS_REGISTRATION_EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf"
};

export function createGroupBookingBackend({
  appendLedger,
  businessRegistrationDir,
  clone,
  ensureAdmissionCredential,
  httpError,
  id,
  isEventBookable,
  money,
  now,
  saleSummary
}) {
function cleanString(value) {
  return String(value || "").trim();
}

function normalizePhoneNumber(value) {
  return String(value || "").replace(/\D/g, "");
}

function requireNonEmpty(payload, field) {
  const value = cleanString(payload[field]);
  if (!value) throw httpError(400, "MISSING_FIELD", `${field} 값이 필요합니다.`);
  return value;
}

function normalizeEnum(value, allowed, code, message) {
  const normalized = cleanString(value).toUpperCase();
  if (!allowed.has(normalized)) throw httpError(422, code, message);
  return normalized;
}

function normalizeEmail(value) {
  const email = cleanString(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(422, "INVALID_EMAIL", "기관 이메일 형식을 확인해주세요.");
  }
  return email;
}

function normalizePhone(value) {
  const phone = normalizePhoneNumber(value);
  if (!/^\d{10,11}$/.test(phone)) {
    throw httpError(422, "INVALID_PHONE_NUMBER", "담당자 휴대폰 번호를 확인해주세요.");
  }
  return phone;
}

function normalizeHeadcount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > MAX_HEADCOUNT) {
    throw httpError(422, "INVALID_HEADCOUNT", "예상 인원은 1명 이상 5000명 이하로 입력해주세요.");
  }
  return count;
}

function decodeBusinessRegistrationFile(value) {
  const dataUrl = cleanString(value);
  const match = /^data:(image\/(?:png|jpeg|webp)|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) {
    throw httpError(422, "INVALID_BUSINESS_REGISTRATION_FILE", "사업자등록증/고유번호증 파일 형식을 확인해주세요.");
  }
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) {
    throw httpError(422, "INVALID_BUSINESS_REGISTRATION_FILE", "사업자등록증/고유번호증 파일은 5MB 이하로 등록해주세요.");
  }
  return { mimeType: match[1], buffer };
}

// Stored on disk instead of inline in the JSON DB: every mutation across the
// entire app triggers a full rewrite of db.json, so embedding multi-MB
// base64 blobs in a request record would re-serialize them on every
// unrelated write once enough institutions had applied.
async function storeBusinessRegistrationFile(requestId, { mimeType, buffer }) {
  if (!businessRegistrationDir?.directory) {
    throw httpError(422, "INVALID_BUSINESS_REGISTRATION_FILE", "사업자등록증/고유번호증 파일을 저장할 수 없습니다.");
  }
  await mkdir(businessRegistrationDir.directory, { recursive: true });
  const fileName = `${requestId}.${BUSINESS_REGISTRATION_EXTENSIONS[mimeType]}`;
  await writeFile(path.join(businessRegistrationDir.directory, fileName), buffer, { mode: 0o600 });
  return { fileName, mimeType };
}

async function readBusinessRegistrationFile(db, requestId) {
  const request = db.groupBookingRequests.find((item) => item.id === requestId);
  if (!request) throw httpError(404, "GROUP_BOOKING_REQUEST_NOT_FOUND", "단체/기관 예매 신청을 찾을 수 없습니다.");
  if (!request.businessRegistrationFile) {
    throw httpError(404, "GROUP_BOOKING_FILE_NOT_FOUND", "첨부된 파일을 찾을 수 없습니다.");
  }
  const { fileName, mimeType } = request.businessRegistrationFile;
  const buffer = await readFile(path.join(businessRegistrationDir.directory, fileName));
  return { buffer, mimeType, fileName };
}

function eventDate(event, performanceDateId) {
  const performanceDate = event.dates?.find((item) => item.id === performanceDateId);
  if (!performanceDate) throw httpError(404, "EVENT_DATE_NOT_FOUND", "예매 날짜를 찾을 수 없습니다.");
  return performanceDate;
}

function eventZone(event, zoneId) {
  const zone = event.zones?.find((item) => item.id === zoneId);
  if (!zone) throw httpError(404, "ZONE_NOT_FOUND", "구역을 찾을 수 없습니다.");
  return zone;
}

function resolveRequestEvent(db, request) {
  const event = db.events.find((item) => item.id === request.eventId);
  if (!event) throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
  const performanceDate = eventDate(event, request.performanceDateId);
  const zone = eventZone(event, request.zoneId);
  return { event, performanceDate, zone };
}

function eventPickerSummary(db, event) {
  const tickets = db.tickets.filter((ticket) => ticket.eventId === event.id);
  return {
    id: event.id,
    title: event.title,
    category: event.category,
    saleState: event.saleState,
    venue: event.venue,
    date: event.date,
    dates: event.dates,
    ticketCount: tickets.length,
    soldCount: tickets.filter((ticket) => ticket.status !== "ON_SALE").length
  };
}

function normalizePageOptions(options) {
  const page = Math.max(1, Number.parseInt(String(options.page || "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(options.limit || "50"), 10) || 50));
  return { page, limit };
}

function pageSlice(items, options) {
  const { page, limit } = normalizePageOptions(options);
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    page: {
      page,
      limit,
      total: items.length,
      hasNext: start + limit < items.length,
      hasPrevious: page > 1
    }
  };
}

function groupBookingRequestDto(db, request) {
  const event = db.events.find((item) => item.id === request.eventId);
  const performanceDate = event?.dates?.find((item) => item.id === request.performanceDateId);
  const zone = event?.zones?.find((item) => item.id === request.zoneId);
  const cloned = clone(request);
  delete cloned.businessRegistrationFile;
  return {
    ...cloned,
    eventTitle: event?.title || request.eventId,
    venue: event?.venue || null,
    zoneName: zone?.name || request.zoneId,
    dateLabel: performanceDate?.label || performanceDate?.startsAt || request.performanceDateId,
    // Legacy requests (submitted before this endpoint moved the file to disk)
    // still carry the inline data: URL directly on the record.
    businessRegistrationFileUrl: request.businessRegistrationFile
      ? `/api/admin/group-booking/requests/${request.id}/business-registration-file`
      : request.businessRegistrationFileUrl
  };
}

function normalizeRequestPayload(db, payload) {
  const orgName = requireNonEmpty(payload, "orgName");
  const contactName = requireNonEmpty(payload, "contactName");
  const contactEmail = normalizeEmail(requireNonEmpty(payload, "contactEmail"));
  const contactPhone = normalizePhone(requireNonEmpty(payload, "contactPhone"));
  const orgType = normalizeEnum(payload.orgType, ORG_TYPES, "INVALID_ORG_TYPE", "지원하지 않는 기관 유형입니다.");
  const paymentMethod = normalizeEnum(payload.paymentMethod, PAYMENT_METHODS, "INVALID_PAYMENT_METHOD", "지원하지 않는 결제 방식입니다.");
  const eventId = requireNonEmpty(payload, "eventId");
  const performanceDateId = requireNonEmpty(payload, "performanceDateId");
  const zoneId = requireNonEmpty(payload, "zoneId");
  const event = db.events.find((item) => item.id === eventId);
  if (!event) throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
  eventDate(event, performanceDateId);
  eventZone(event, zoneId);
  return {
    orgName,
    orgType,
    contactName,
    contactPhone,
    contactEmail,
    businessRegistrationFile: decodeBusinessRegistrationFile(requireNonEmpty(payload, "businessRegistrationFileUrl")),
    eventId,
    performanceDateId,
    zoneId,
    expectedHeadcount: normalizeHeadcount(payload.expectedHeadcount),
    paymentMethod,
    requestNote: cleanString(payload.requestNote)
  };
}

function assertPendingRequest(db, requestId) {
  const request = db.groupBookingRequests.find((item) => item.id === requestId);
  if (!request) throw httpError(404, "GROUP_BOOKING_REQUEST_NOT_FOUND", "단체/기관 예매 신청을 찾을 수 없습니다.");
  if (REVIEWED_STATUSES.has(request.status)) {
    throw httpError(409, "GROUP_BOOKING_ALREADY_REVIEWED", "이미 검토가 완료된 신청입니다.");
  }
  return request;
}

function normalizeAssignedCount(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return normalizeHeadcount(value);
}

// Deliberately never matches an existing account by phone/email: the
// contact's phone/email is their own staff line, not a dedicated org
// account, so matching risks silently attaching institutional tickets to
// an unrelated real consumer's account (merging trust score, ticket list,
// and support history). Each approved request gets its own dedicated,
// clearly-marked institutional buyer instead.
function findOrCreateBuyerUser(db, request) {
  const created = {
    id: id("user"),
    name: request.orgName,
    phone: request.contactPhone,
    email: request.contactEmail,
    balance: 0,
    status: "ACTIVE",
    trustScore: 90,
    sanctions: [],
    identityVerification: null,
    institutionalBuyer: true,
    groupBookingRequestId: request.id,
    createdAt: now(),
    updatedAt: now()
  };
  db.users.push(created);
  return created;
}

async function submitGroupBookingRequest(db, payload) {
  db.groupBookingRequests ||= [];
  const input = normalizeRequestPayload(db, payload);
  const createdAt = now();
  const requestId = id("gbr");
  const businessRegistrationFile = await storeBusinessRegistrationFile(requestId, input.businessRegistrationFile);
  const request = {
    id: requestId,
    ...input,
    businessRegistrationFile,
    status: "PENDING",
    createdAt,
    updatedAt: createdAt,
    reviewedBy: null,
    reviewNote: null,
    reviewedAt: null,
    assignedCount: null,
    assignedTicketIds: [],
    buyerUserId: null
  };
  db.groupBookingRequests.push(request);
  appendLedger(db, "PUBLIC", "GROUP_BOOKING_REQUEST_SUBMITTED", {
    requestId: request.id,
    orgName: request.orgName,
    eventId: request.eventId,
    expectedHeadcount: request.expectedHeadcount
  });
  return { id: request.id, status: "PENDING", createdAt };
}

function listGroupBookingRequests(db, { status, page, limit } = {}) {
  db.groupBookingRequests ||= [];
  const normalizedStatus = status ? cleanString(status).toUpperCase() : "";
  if (normalizedStatus && !["PENDING", "APPROVED", "REJECTED"].includes(normalizedStatus)) {
    throw httpError(422, "INVALID_GROUP_BOOKING_STATUS", "지원하지 않는 단체/기관 예매 상태입니다.");
  }
  const requests = db.groupBookingRequests
    .filter((request) => !normalizedStatus || request.status === normalizedStatus)
    .sort((a, b) => Date.parse(b.createdAt || b.updatedAt || 0) - Date.parse(a.createdAt || a.updatedAt || 0))
    .map((request) => groupBookingRequestDto(db, request));
  const paged = pageSlice(requests, { page, limit });
  return {
    requests: paged.items,
    page: paged.page,
    eventSummaries: db.events.map((event) => eventPickerSummary(db, event))
  };
}

function approveGroupBookingRequest(db, { requestId, assignedCount, reviewNote }, actor) {
  const request = assertPendingRequest(db, requestId);
  const count = normalizeAssignedCount(assignedCount, request.expectedHeadcount);
  const { event, performanceDate, zone } = resolveRequestEvent(db, request);
  if (!isEventBookable(event)) {
    throw httpError(409, "EVENT_NOT_ON_SALE", `${saleSummary(event).label} 티켓은 아직 예매할 수 없습니다.`);
  }
  const availableTickets = db.tickets.filter((ticket) => (
    ticket.eventId === request.eventId
    && ticket.performanceDateId === request.performanceDateId
    && ticket.zoneId === request.zoneId
    && ticket.status === "ON_SALE"
  ));
  if (availableTickets.length < count) {
    throw httpError(409, "INSUFFICIENT_INVENTORY", "단체/기관 예매에 배정할 수 있는 재고가 부족합니다.", {
      available: availableTickets.length,
      requested: count
    });
  }

  const buyerUser = findOrCreateBuyerUser(db, request);
  const assignedTickets = availableTickets.slice(0, count);
  const reviewedAt = now();
  for (const ticket of assignedTickets) {
    ticket.ownerId = buyerUser.id;
    ticket.status = "OWNED";
    ticket.institutional = true;
    ticket.groupBookingRequestId = request.id;
    ticket.virtualQr = {
      issuedAt: reviewedAt,
      type: "VIRTUAL_TICKET"
    };
    ensureAdmissionCredential?.(db, { user: buyerUser, ticket, event, performanceDate });
  }

  db.paymentTransactions.push({
    id: id("pay"),
    ticketIds: assignedTickets.map((ticket) => ticket.id),
    userId: buyerUser.id,
    type: "GROUP_BOOKING",
    amount: money(assignedTickets.reduce((total, ticket) => total + Number(ticket.faceValue || zone.faceValue || 0), 0)),
    method: request.paymentMethod,
    status: "INVOICE_PENDING",
    pgTransactionId: null,
    groupBookingRequestId: request.id,
    createdAt: reviewedAt
  });

  request.status = "APPROVED";
  request.reviewedBy = actor?.id || "ADMIN";
  request.reviewedAt = reviewedAt;
  request.reviewNote = cleanString(reviewNote) || null;
  request.updatedAt = reviewedAt;
  request.assignedCount = count;
  request.assignedTicketIds = assignedTickets.map((ticket) => ticket.id);
  request.buyerUserId = buyerUser.id;
  appendLedger(db, "ADMIN", "GROUP_BOOKING_APPROVED", {
    requestId: request.id,
    assignedCount: count,
    assignedTicketIds: request.assignedTicketIds,
    buyerUserId: buyerUser.id,
    eventId: event.id
  });
  return groupBookingRequestDto(db, request);
}

function rejectGroupBookingRequest(db, { requestId, reviewNote }, actor) {
  const note = cleanString(reviewNote);
  if (!note) throw httpError(400, "MISSING_FIELD", "반려 사유를 입력해주세요.");
  const request = assertPendingRequest(db, requestId);
  const reviewedAt = now();
  request.status = "REJECTED";
  request.reviewedBy = actor?.id || "ADMIN";
  request.reviewedAt = reviewedAt;
  request.reviewNote = note;
  request.updatedAt = reviewedAt;
  appendLedger(db, "ADMIN", "GROUP_BOOKING_REJECTED", {
    requestId: request.id,
    reviewNote: note
  });
  return groupBookingRequestDto(db, request);
}

  return {
    approveGroupBookingRequest,
    listGroupBookingRequests,
    readBusinessRegistrationFile,
    rejectGroupBookingRequest,
    submitGroupBookingRequest
  };
}
