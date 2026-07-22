import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { createTicketgroundApp } from "../backend/app.js";

const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAF/wJ/0R5yyAAAAABJRU5ErkJggg==";
const tinyPdf = "data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwvVHlwZSAvQ2F0YWxvZz4+CmVuZG9iagp0cmFpbGVyCjw8L1Jvb3QgMSAwIFI+PgolJUVPRgo=";

async function ticketgroundApp(t) {
  const tempDir = await mkdtemp(path.join(tmpdir(), "ticketground-seller-accounts-"));
  t.after(() => rm(tempDir, { recursive: true, force: true }));
  return await createTicketgroundApp({
    dbPath: path.join(tempDir, "db.json"),
    mediaDir: { directory: path.join(tempDir, "uploads"), urlPrefix: "/manual-uploads" },
    runtime: {
      appAttestationSecret: "seller-accounts-app-secret",
      nowOverride: "2026-07-22T12:00:00+09:00",
      secret: "seller-accounts-runtime-secret"
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

function requestStream(method, url, body, cookie) {
  const request = Readable.from(body ? [Buffer.from(JSON.stringify(body))] : []);
  request.method = method;
  request.url = url;
  request.headers = { host: "seller-accounts.test", ...(cookie ? { cookie } : {}) };
  request.socket = { remoteAddress: "127.0.0.1" };
  return request;
}

function extractCookiePair(setCookieHeader) {
  const value = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  return String(value || "").split(";")[0];
}

async function requestApp(app, { body, cookie, csrf, expectedStatus = 200, method, surface, url }) {
  const response = { status: 0, body: "", headers: {} };
  const res = {
    writeHead(status, headers = {}) {
      response.status = status;
      response.headers = headers;
    },
    end(chunk = "") {
      response.body += chunk.toString();
    }
  };
  const req = requestStream(method, url, body, cookie);
  if (csrf) req.headers["x-tig-seller-csrf"] = csrf;
  await app.handleRequest(req, res, app.db, surface);
  const json = JSON.parse(response.body);
  assert.equal(response.status, expectedStatus, `${url} status ${response.status}: ${response.body}`);
  return { headers: response.headers, json };
}

function sellerApplicationPayload(overrides = {}) {
  return {
    organization: {
      legalName: "테스트 기획 주식회사",
      orgType: "PRODUCTION",
      bizRegistrationNumber: "123-45-67890",
      bizRegistrationDocDataUrl: tinyPdf,
      representativeName: "김대표"
    },
    contact: { name: "박담당", phone: "010-1234-5678", email: "seller@example.com" },
    proposedEvent: {
      title: "판매자 대시보드 검증 공연",
      category: "concert",
      venueName: "임시 공연장",
      sessions: [{ label: "1회차", date: "2026-12-24", times: ["19:30"] }],
      seatGrades: [{ gradeName: "VIP", price: 154000, quantity: 20 }],
      posterImageDataUrl: tinyPng
    },
    saleTerms: {
      channelType: "EXCLUSIVE",
      settlement: { bankName: "국민은행", accountNumber: "1234567890", accountHolder: "테스트 기획" }
    },
    privacyConsent: true,
    preliminaryAcknowledged: true,
    ...overrides
  };
}

async function approvedApplicationId(app) {
  const submitted = await requestApp(app, { surface: "public", method: "POST", url: "/api/seller-applications", body: sellerApplicationPayload() });
  const applicationId = submitted.json.data.id;
  for (const key of ["bizNumberVerified", "contactPhoneVerified", "eventAuthenticityChecked"]) {
    await requestApp(app, { surface: "admin", method: "POST", url: `/api/admin/seller-applications/${applicationId}/checklist`, body: { [key]: true } });
  }
  await requestApp(app, { surface: "admin", method: "POST", url: `/api/admin/seller-applications/${applicationId}/approve`, body: {} });
  return applicationId;
}

async function issueAccount(app, applicationId, username) {
  const result = await requestApp(app, { surface: "admin", method: "POST", url: "/api/admin/seller-accounts/issue", body: { applicationId, username } });
  return result.json.data;
}

async function loginAsSeller(app, username, password) {
  const result = await requestApp(app, { surface: "public", method: "POST", url: "/api/seller/login", body: { username, password } });
  return { cookie: extractCookiePair(result.headers["Set-Cookie"]), csrf: result.json.data.csrf, session: result.json.data };
}

function eventCreatePayload(overrides = {}) {
  return {
    title: "기업 등록 공연",
    category: "concert",
    startsAt: "2026-12-24T19:30:00+09:00",
    venueId: "venue_jamsil_olympic",
    schedules: [{ label: "1회차", date: "2026-12-24", times: ["19:30"] }],
    prices: [{ grade: "VIP", seat: "VIP석", price: 154000, seatCount: 10 }],
    imageDataUrl: tinyPng,
    ...overrides
  };
}

test("issuing a seller account is blocked until the application is APPROVED", async (t) => {
  const app = await ticketgroundApp(t);
  const submitted = await requestApp(app, { surface: "public", method: "POST", url: "/api/seller-applications", body: sellerApplicationPayload() });
  const applicationId = submitted.json.data.id;
  const denied = await requestApp(app, { surface: "admin", method: "POST", url: "/api/admin/seller-accounts/issue", body: { applicationId, username: "stagemaker" }, expectedStatus: 409 });
  assert.equal(denied.json.error.code, "SELLER_APPLICATION_NOT_APPROVED");
});

test("issuing a seller account twice for the same application is rejected", async (t) => {
  const app = await ticketgroundApp(t);
  const applicationId = await approvedApplicationId(app);
  await issueAccount(app, applicationId, "stagemaker");
  const denied = await requestApp(app, { surface: "admin", method: "POST", url: "/api/admin/seller-accounts/issue", body: { applicationId, username: "stagemaker2" }, expectedStatus: 409 });
  assert.equal(denied.json.error.code, "SELLER_ACCOUNT_ALREADY_ISSUED");
});

test("seller login rejects a wrong password and succeeds with the issued temp password", async (t) => {
  const app = await ticketgroundApp(t);
  const applicationId = await approvedApplicationId(app);
  const issued = await issueAccount(app, applicationId, "stagemaker");
  await requestApp(app, { surface: "public", method: "POST", url: "/api/seller/login", body: { username: "stagemaker", password: "wrong-password" }, expectedStatus: 401 });
  const { cookie, session } = await loginAsSeller(app, "stagemaker", issued.tempPassword);
  assert.ok(cookie.startsWith("tig_seller_session="));
  assert.equal(session.mustChangePassword, true);
});

test("seller-scoped routes require a valid session", async (t) => {
  const app = await ticketgroundApp(t);
  const denied = await requestApp(app, { surface: "public", method: "GET", url: "/api/seller/events", expectedStatus: 401 });
  assert.equal(denied.json.error.code, "SELLER_SESSION_REQUIRED");
});

test("a seller can create an event, but it stays hidden from the public catalog until an admin publishes it", async (t) => {
  const app = await ticketgroundApp(t);
  const applicationId = await approvedApplicationId(app);
  const issued = await issueAccount(app, applicationId, "stagemaker");
  const { cookie, csrf } = await loginAsSeller(app, "stagemaker", issued.tempPassword);

  const created = await requestApp(app, { surface: "public", method: "POST", url: "/api/seller/events/create", body: eventCreatePayload(), cookie, csrf });
  assert.equal(created.json.data.publishStatus, "PENDING_ADMIN_REVIEW");

  const catalogBefore = await requestApp(app, { surface: "public", method: "GET", url: "/api/catalog" });
  assert.ok(!catalogBefore.json.data.events.some((event) => event.id === created.json.data.id), "unpublished seller event must not appear in the public catalog");

  const reviewList = await requestApp(app, { surface: "admin", method: "GET", url: "/api/admin/workspaces/seller-events" });
  assert.ok(reviewList.json.data.events.some((event) => event.id === created.json.data.id));

  await requestApp(app, { surface: "admin", method: "POST", url: `/api/admin/seller-events/${created.json.data.id}/publish`, body: {} });

  const catalogAfter = await requestApp(app, { surface: "public", method: "GET", url: "/api/catalog" });
  assert.ok(catalogAfter.json.data.events.some((event) => event.id === created.json.data.id), "published seller event must appear in the public catalog");
});

test("editing an already-published seller event re-enters review and disappears from the public catalog again", async (t) => {
  const app = await ticketgroundApp(t);
  const applicationId = await approvedApplicationId(app);
  const issued = await issueAccount(app, applicationId, "stagemaker");
  const { cookie, csrf } = await loginAsSeller(app, "stagemaker", issued.tempPassword);

  const created = await requestApp(app, { surface: "public", method: "POST", url: "/api/seller/events/create", body: eventCreatePayload(), cookie, csrf });
  const eventId = created.json.data.id;
  await requestApp(app, { surface: "admin", method: "POST", url: `/api/admin/seller-events/${eventId}/publish`, body: {} });

  const updated = await requestApp(app, { surface: "public", method: "POST", url: "/api/seller/events/update", body: eventCreatePayload({ eventId, title: "수정된 공연명" }), cookie, csrf });
  assert.equal(updated.json.data.publishStatus, "PENDING_ADMIN_REVIEW");

  const catalog = await requestApp(app, { surface: "public", method: "GET", url: "/api/catalog" });
  assert.ok(!catalog.json.data.events.some((event) => event.id === eventId), "editing a published seller event must pull it back out of the public catalog");
});

test("a seller cannot read or edit another seller's event", async (t) => {
  const app = await ticketgroundApp(t);
  const applicationIdA = await approvedApplicationId(app);
  const issuedA = await issueAccount(app, applicationIdA, "stagemaker-a");
  const sellerA = await loginAsSeller(app, "stagemaker-a", issuedA.tempPassword);
  const created = await requestApp(app, { surface: "public", method: "POST", url: "/api/seller/events/create", body: eventCreatePayload(), cookie: sellerA.cookie, csrf: sellerA.csrf });
  const eventId = created.json.data.id;

  const applicationIdB = await approvedApplicationId(app);
  const issuedB = await issueAccount(app, applicationIdB, "stagemaker-b");
  const sellerB = await loginAsSeller(app, "stagemaker-b", issuedB.tempPassword);

  const listB = await requestApp(app, { surface: "public", method: "GET", url: "/api/seller/events", cookie: sellerB.cookie });
  assert.ok(!listB.json.data.some((event) => event.id === eventId), "seller B must not see seller A's event in their own list");

  const deniedUpdate = await requestApp(app, {
    surface: "public",
    method: "POST",
    url: "/api/seller/events/update",
    body: eventCreatePayload({ eventId, title: "탈취 시도" }),
    cookie: sellerB.cookie,
    csrf: sellerB.csrf,
    expectedStatus: 404
  });
  assert.equal(deniedUpdate.json.error.code, "EVENT_NOT_FOUND");
});

test("a mutating seller request without the CSRF header is rejected", async (t) => {
  const app = await ticketgroundApp(t);
  const applicationId = await approvedApplicationId(app);
  const issued = await issueAccount(app, applicationId, "stagemaker");
  const { cookie } = await loginAsSeller(app, "stagemaker", issued.tempPassword);
  const denied = await requestApp(app, { surface: "public", method: "POST", url: "/api/seller/events/create", body: eventCreatePayload(), cookie, expectedStatus: 403 });
  assert.equal(denied.json.error.code, "CSRF_REQUIRED");
});

test("changing the temporary password clears mustChangePassword and requires the current password", async (t) => {
  const app = await ticketgroundApp(t);
  const applicationId = await approvedApplicationId(app);
  const issued = await issueAccount(app, applicationId, "stagemaker");
  const { cookie, csrf } = await loginAsSeller(app, "stagemaker", issued.tempPassword);

  await requestApp(app, {
    surface: "public",
    method: "POST",
    url: "/api/seller/change-password",
    body: { currentPassword: "wrong-temp-password", nextPassword: "a-new-strong-password" },
    cookie,
    csrf,
    expectedStatus: 401
  });

  const changed = await requestApp(app, {
    surface: "public",
    method: "POST",
    url: "/api/seller/change-password",
    body: { currentPassword: issued.tempPassword, nextPassword: "a-new-strong-password" },
    cookie,
    csrf
  });
  assert.equal(changed.json.data.mustChangePassword, false);

  const relogin = await loginAsSeller(app, "stagemaker", "a-new-strong-password");
  assert.equal(relogin.session.mustChangePassword, false);
});
