import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { adminPermissionsForRoles } from "../backend/admin-acl.js";
import { createTicketgroundApp } from "../backend/app.js";

const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAF/wJ/0R5yyAAAAABJRU5ErkJggg==";
const tinyPdf = "data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwvVHlwZSAvQ2F0YWxvZz4+CmVuZG9iagp0cmFpbGVyCjw8L1Jvb3QgMSAwIFI+PgolJUVPRgo=";

function requestStream(method, url, body) {
  const request = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  request.method = method;
  request.url = url;
  request.headers = { host: "seller-applications.test" };
  return request;
}

async function ticketgroundApp(t) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-seller-applications-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  return await createTicketgroundApp({
    dbPath: path.join(tempDir, "db.json"),
    mediaDir: { directory: path.join(tempDir, "uploads"), urlPrefix: "/manual-uploads" },
    runtime: {
      appAttestationSecret: "seller-application-app-secret",
      nowOverride: "2026-07-21T12:00:00+09:00",
      secret: "seller-application-runtime-secret"
    },
    http: {
      adminDir: tempDir,
      fallbackPublic: "/index.html",
      jamsilOlympicSeatMapDir: tempDir,
      MIME: { ".json": "application/json; charset=utf-8" },
      projectDir: process.cwd(),
      publicDir: tempDir,
      seatMapDir: tempDir
    }
  });
}

async function requestApp(app, { body, expectedStatus = 200, method, surface, url }) {
  const response = { status: 0, body: "" };
  const res = {
    writeHead(status) {
      response.status = status;
    },
    end(chunk = "") {
      response.body += chunk.toString();
    }
  };
  await app.handleRequest(requestStream(method, url, body), res, app.db, surface);
  const json = JSON.parse(response.body);
  assert.equal(response.status, expectedStatus, `${url} status ${response.status}: ${response.body}`);
  return json;
}

function sellerApplicationPayload(overrides = {}) {
  const base = {
    organization: {
      legalName: "스테이지메이커 주식회사",
      orgType: "PRODUCTION",
      bizRegistrationNumber: "123-45-67890",
      bizRegistrationDocDataUrl: tinyPdf,
      representativeName: "김대표",
      address: "서울시 종로구",
      website: "https://stage.example"
    },
    contact: {
      name: "박담당",
      title: "공연사업팀장",
      phone: "010-1234-5678",
      email: "seller@example.com"
    },
    proposedEvent: {
      title: "검증형 판매 신청 공연",
      category: "concert",
      venueName: "신규 공연장",
      sessions: [{ label: "첫 회차", date: "2026-12-24", times: ["19:30"] }],
      seatGrades: [{ gradeName: "VIP", price: 154000, quantity: 20 }],
      desiredSaleOpenDate: "2026-10-01",
      eventDateRange: "2026.12.24 ~ 2026.12.31",
      discountPolicyNotes: "조기예매 10%",
      posterImageDataUrl: tinyPng,
      castNotes: "추후 확정",
      summaryDraft: "공식 신청서 요약입니다.",
      noticesDraft: "예매 공지 초안"
    },
    saleTerms: {
      channelType: "EXCLUSIVE",
      requestedCommissionNotes: "표준 수수료 협의",
      settlement: {
        bankName: "국민은행",
        accountNumber: "1234567890",
        accountHolder: "스테이지메이커"
      }
    },
    otherNotes: "계약서 별도 체결 예정",
    privacyConsent: true,
    preliminaryAcknowledged: true
  };
  return merge(base, overrides);
}

function merge(base, overrides) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return overrides ?? base;
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    result[key] = value && typeof value === "object" && !Array.isArray(value) ? merge(base[key] || {}, value) : value;
  }
  return result;
}

async function submitApplication(app, overrides = {}) {
  return await requestApp(app, {
    surface: "public",
    method: "POST",
    url: "/api/seller-applications",
    body: sellerApplicationPayload(overrides)
  });
}

async function listApplications(app, query = "") {
  return await requestApp(app, {
    surface: "admin",
    method: "GET",
    url: `/api/admin/workspaces/seller-applications${query}`
  });
}

async function applicationById(app, applicationId) {
  const listed = await listApplications(app);
  const application = listed.data.applications.find((item) => item.id === applicationId);
  assert.ok(application, `${applicationId} appears in seller application workspace`);
  return application;
}

async function adminPost(app, url, body, expectedStatus = 200) {
  return await requestApp(app, { surface: "admin", method: "POST", url, body, expectedStatus });
}

async function approveWithChecklist(app, applicationId) {
  await adminPost(app, `/api/admin/seller-applications/${applicationId}/checklist`, { bizNumberVerified: true });
  await adminPost(app, `/api/admin/seller-applications/${applicationId}/checklist`, { contactPhoneVerified: true });
  await adminPost(app, `/api/admin/seller-applications/${applicationId}/checklist`, { eventAuthenticityChecked: true });
  return await adminPost(app, `/api/admin/seller-applications/${applicationId}/approve`, { reviewNote: "검증 완료" });
}

function createEventPayload(title, sourceApplicationId) {
  return {
    title,
    category: "concert",
    startsAt: "2026-12-24T19:30:00+09:00",
    venueId: "venue_jamsil_olympic",
    saleState: "OPEN_SOON",
    saleNote: "seller application handoff",
    prices: { zone_vip: 160000, zone_r: 120000, zone_s: 90000 },
    imageDataUrl: tinyPng,
    ...(sourceApplicationId ? { sourceApplicationId } : {})
  };
}

test("submission accepts two realistically-sized attachments that would exceed the default body cap", async (t) => {
  const app = await ticketgroundApp(t);
  // ~4.9MB raw each, base64-inflated (~4/3x) - two of these together clear
  // the old blanket 8MB request-body cap even though each file is well
  // within the per-file 5MB limit the UI advertises.
  const bigDataUrl = (mime) => `data:${mime};base64,${Buffer.alloc(4.9 * 1024 * 1024, 65).toString("base64")}`;
  const submitted = await submitApplication(app, {
    organization: { bizRegistrationDocDataUrl: bigDataUrl("application/pdf") },
    proposedEvent: { posterImageDataUrl: bigDataUrl("image/png") }
  });
  assert.equal(submitted.data.status, "PENDING");
});

test("public seller application submission stores only pending receipt response", async (t) => {
  const app = await ticketgroundApp(t);

  const submitted = await submitApplication(app);

  assert.match(submitted.data.id, /^sapp_/);
  assert.equal(submitted.data.status, "PENDING");
  assert.equal(submitted.data.organization, undefined);
  assert.equal(submitted.data.saleTerms, undefined);
  assert.equal(typeof submitted.data.createdAt, "string");

  const stored = await applicationById(app, submitted.data.id);
  assert.equal(stored.status, "PENDING");
  assert.equal(stored.organization.legalName, "스테이지메이커 주식회사");
  assert.deepEqual(stored.review.verificationChecklist, {
    bizNumberVerified: false,
    contactPhoneVerified: false,
    eventAuthenticityChecked: false
  });
  assert.equal(stored.review.log[0].action, "SUBMITTED");
});

test("public seller application submission rejects invalid fields with explicit codes without mutation", async (t) => {
  const app = await ticketgroundApp(t);
  const cases = [
    [{ organization: { legalName: "" } }, "MISSING_FIELD", 400],
    [{ organization: { orgType: "SCALPER" } }, "INVALID_ORG_TYPE", 422],
    [{ organization: { bizRegistrationNumber: "1234567890" } }, "INVALID_BIZ_REGISTRATION_NUMBER", 422],
    [{ organization: { bizRegistrationDocDataUrl: "data:text/plain;base64,SGVsbG8=" } }, "INVALID_BIZ_REGISTRATION_DOC", 422],
    [{ contact: { email: "not-email" } }, "INVALID_EMAIL", 422],
    [{ contact: { phone: "02-123-4567" } }, "INVALID_PHONE", 422],
    [{ proposedEvent: { category: "opera" } }, "INVALID_CATEGORY", 422],
    [{ proposedEvent: { sessions: [] } }, "INVALID_SESSIONS", 422],
    [{ proposedEvent: { seatGrades: [] } }, "INVALID_SEAT_GRADES", 422],
    [{ proposedEvent: { posterImageDataUrl: tinyPdf } }, "INVALID_POSTER_IMAGE", 422],
    // A comma/pipe inside a name or date would silently shift columns when
    // the admin catalog tool's prefill round-trips these values back
    // through comma/pipe-delimited textareas - reject it up front instead
    // of letting it corrupt prices/dates on a live event later.
    [{ proposedEvent: { seatGrades: [{ gradeName: "VIP,special", price: 100000, quantity: 5 }] } }, "INVALID_SEAT_GRADES", 422],
    [{ proposedEvent: { sessions: [{ label: "1|hacked", date: "2026-12-24", times: ["19:30"] }] } }, "INVALID_SESSIONS", 422],
    [{ saleTerms: { channelType: "UNSAFE" } }, "INVALID_CHANNEL_TYPE", 422],
    [{ saleTerms: { settlement: { bankName: "" } } }, "MISSING_FIELD", 400],
    [{ privacyConsent: false }, "CONSENT_REQUIRED", 400],
    [{ preliminaryAcknowledged: false }, "CONSENT_REQUIRED", 400]
  ];

  for (const [overrides, code, status] of cases) {
    const result = await requestApp(app, {
      surface: "public",
      method: "POST",
      url: "/api/seller-applications",
      body: sellerApplicationPayload(overrides),
      expectedStatus: status
    });
    assert.equal(result.error.code, code);
  }

  const listed = await listApplications(app);
  assert.equal(listed.data.applications.length, 0);
});

test("seller application role grants manage permission while readonly does not", () => {
  assert.equal(adminPermissionsForRoles(["readonly"]).includes("sellerApplications.manage"), false);
  assert.equal(adminPermissionsForRoles(["sellerApplications"]).includes("sellerApplications.manage"), true);
});

test("seller application approval is blocked until the full verification checklist is complete", async (t) => {
  const app = await ticketgroundApp(t);
  const submitted = await submitApplication(app);
  const eventCount = app.db.events.length;
  const ticketCount = app.db.tickets.length;

  const denied = await adminPost(app, `/api/admin/seller-applications/${submitted.data.id}/approve`, {
    reviewNote: "승인 시도"
  }, 422);

  assert.equal(denied.error.code, "VERIFICATION_CHECKLIST_INCOMPLETE");
  assert.deepEqual(denied.error.detail.checklist, {
    bizNumberVerified: false,
    contactPhoneVerified: false,
    eventAuthenticityChecked: false
  });
  assert.equal((await applicationById(app, submitted.data.id)).status, "PENDING");

  await adminPost(app, `/api/admin/seller-applications/${submitted.data.id}/checklist`, { bizNumberVerified: true });
  await adminPost(app, `/api/admin/seller-applications/${submitted.data.id}/checklist`, { contactPhoneVerified: "yes" });
  const checklist = await adminPost(app, `/api/admin/seller-applications/${submitted.data.id}/checklist`, { eventAuthenticityChecked: 1 });
  assert.deepEqual(checklist.data.review.verificationChecklist, {
    bizNumberVerified: true,
    contactPhoneVerified: true,
    eventAuthenticityChecked: true
  });

  const final = await adminPost(app, `/api/admin/seller-applications/${submitted.data.id}/approve`, {
    reviewNote: "전화/사업자/공연 검증 완료"
  });
  assert.equal(final.data.status, "APPROVED");
  assert.equal(final.data.review.log.at(-1).action, "APPROVED");
  assert.equal(app.db.events.length, eventCount);
  assert.equal(app.db.tickets.length, ticketCount);
  assert.equal(app.db.paymentTransactions.length, 0);
});

test("seller application rejection requires a note and final states cannot be reviewed again", async (t) => {
  const app = await ticketgroundApp(t);
  const toReject = await submitApplication(app, { proposedEvent: { title: "반려 대상 공연" } });

  const missingNote = await adminPost(app, `/api/admin/seller-applications/${toReject.data.id}/reject`, {}, 400);
  assert.equal(missingNote.error.code, "MISSING_FIELD");

  const rejected = await adminPost(app, `/api/admin/seller-applications/${toReject.data.id}/reject`, {
    reviewNote: "권리 증빙 부족"
  });
  assert.equal(rejected.data.status, "REJECTED");
  assert.equal(rejected.data.review.rejectionReason, "권리 증빙 부족");

  const reapprove = await adminPost(app, `/api/admin/seller-applications/${toReject.data.id}/approve`, {
    reviewNote: "재승인"
  }, 409);
  assert.equal(reapprove.error.code, "SELLER_APPLICATION_ALREADY_REVIEWED");

  const approvedSubmission = await submitApplication(app, { proposedEvent: { title: "승인 후 재반려 대상" } });
  await approveWithChecklist(app, approvedSubmission.data.id);
  const rereject = await adminPost(app, `/api/admin/seller-applications/${approvedSubmission.data.id}/reject`, {
    reviewNote: "재반려"
  }, 409);
  assert.equal(rereject.error.code, "SELLER_APPLICATION_ALREADY_REVIEWED");
});

test("approved seller application links to event creation while missing or pending sources are ignored", async (t) => {
  const app = await ticketgroundApp(t);
  const approvedSubmission = await submitApplication(app, { proposedEvent: { title: "핸드오프 승인 공연" } });
  await approveWithChecklist(app, approvedSubmission.data.id);

  const created = await adminPost(app, "/api/admin/events/create", createEventPayload("Seller Handoff Registered Event", approvedSubmission.data.id));
  assert.ok(created.data.event.id);
  const registered = await applicationById(app, approvedSubmission.data.id);
  assert.equal(registered.status, "REGISTERED");
  assert.equal(registered.review.linkedEventId, created.data.event.id);
  assert.equal(registered.review.log.at(-1).action, "REGISTERED");

  const missingSource = await adminPost(app, "/api/admin/events/create", createEventPayload("Seller Handoff Missing Source Event", "sapp_missing"));
  assert.ok(missingSource.data.event.id);

  const pendingSubmission = await submitApplication(app, { proposedEvent: { title: "핸드오프 대기 공연" } });
  const pendingCreate = await adminPost(app, "/api/admin/events/create", createEventPayload("Seller Handoff Pending Source Event", pendingSubmission.data.id));
  assert.ok(pendingCreate.data.event.id);
  const stillPending = await applicationById(app, pendingSubmission.data.id);
  assert.equal(stillPending.status, "PENDING");
  assert.equal(stillPending.review.linkedEventId, null);
});

test("catalog workspace only returns a seller-application prefill for an approved source, never for pending or missing ids", async (t) => {
  const app = await ticketgroundApp(t);
  const approvedSubmission = await submitApplication(app, { proposedEvent: { title: "프리필 대상 공연" } });
  await approveWithChecklist(app, approvedSubmission.data.id);

  const withApprovedSource = await requestApp(app, {
    surface: "admin",
    method: "GET",
    url: `/api/admin/workspaces/catalog?sourceApplicationId=${approvedSubmission.data.id}`
  });
  assert.equal(withApprovedSource.data.sellerApplicationPrefill.applicationId, approvedSubmission.data.id);
  assert.equal(withApprovedSource.data.sellerApplicationPrefill.title, "프리필 대상 공연");

  const pendingSubmission = await submitApplication(app, { proposedEvent: { title: "프리필 대상 아님(대기중)" } });
  const withPendingSource = await requestApp(app, {
    surface: "admin",
    method: "GET",
    url: `/api/admin/workspaces/catalog?sourceApplicationId=${pendingSubmission.data.id}`
  });
  assert.equal(withPendingSource.data.sellerApplicationPrefill, undefined, "a PENDING application must not leak prefill data before approval");

  const withMissingSource = await requestApp(app, {
    surface: "admin",
    method: "GET",
    url: "/api/admin/workspaces/catalog?sourceApplicationId=sapp_missing"
  });
  assert.equal(withMissingSource.data.sellerApplicationPrefill, undefined);

  const withoutSource = await requestApp(app, { surface: "admin", method: "GET", url: "/api/admin/workspaces/catalog" });
  assert.equal(withoutSource.data.sellerApplicationPrefill, undefined);
});
