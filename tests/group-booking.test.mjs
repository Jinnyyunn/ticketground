import test from "node:test";
import assert from "node:assert/strict";
import { adminApi, api, bootstrapAdminPassword, startServer } from "./backend-test-utils.mjs";

const businessRegistrationFileUrl = "data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCg==";

async function adminSessionRequest(server, pathName, { body, cookie, csrf, expectedStatus = 200 } = {}) {
  const response = await fetch(`${server.adminUrl}${pathName}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { "x-tig-csrf": csrf } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  const json = await response.json();
  assert.equal(response.status, expectedStatus, `${pathName} status ${response.status}: ${JSON.stringify(json)}`);
  return { json, setCookie: response.headers.get("set-cookie") || "" };
}

async function groupBookingAdminSession(server) {
  const owner = await adminSessionRequest(server, "/api/admin/login", {
    body: { username: "admin", password: bootstrapAdminPassword }
  });
  const ownerCookie = owner.setCookie.split(";")[0];
  const ownerCsrf = owner.json.data.csrf;
  await adminSessionRequest(server, "/api/admin/admin-accounts", {
    cookie: ownerCookie,
    csrf: ownerCsrf,
    body: {
      username: "group-booking-admin",
      password: "group-booking-password",
      roleKeys: ["groupBooking"],
      ipAllowlist: []
    }
  });
  const login = await adminSessionRequest(server, "/api/admin/login", {
    body: { username: "group-booking-admin", password: "group-booking-password" }
  });
  return {
    cookie: login.setCookie.split(";")[0],
    csrf: login.json.data.csrf
  };
}

function requestPayload(state, overrides = {}) {
  const event = state.data.events.find((item) => item.id === "event_kpop_001");
  assert.ok(event, "seeded event exists");
  return {
    orgName: "서울문화재단",
    orgType: "GOVERNMENT",
    contactName: "김담당",
    contactPhone: "010-7777-1234",
    contactEmail: "group@example.org",
    businessRegistrationFileUrl,
    eventId: event.id,
    performanceDateId: event.dates[0].id,
    zoneId: event.zones[0].id,
    expectedHeadcount: 2,
    paymentMethod: "TAX_INVOICE",
    requestNote: "복지기관 단체 관람",
    ...overrides
  };
}

async function submitGroupBooking(server, overrides = {}) {
  const state = await api(server.baseUrl, "/api/state");
  return api(server.baseUrl, "/api/group-booking/requests", requestPayload(state, overrides));
}

test("public group-booking request submission stores a pending request without echoing private data", async (t) => {
  const server = await startServer(t);
  const created = await submitGroupBooking(server);

  assert.equal(created.data.status, "PENDING");
  assert.match(created.data.id, /^gbr_/);
  assert.ok(created.data.createdAt);
  assert.equal(created.data.contactEmail, undefined);

  const workspace = await adminApi(server, "/api/admin/workspaces/group-booking");
  assert.equal(workspace.data.requests.length, 1);
  assert.equal(workspace.data.requests[0].id, created.data.id);
  assert.equal(workspace.data.requests[0].orgName, "서울문화재단");
  assert.equal(workspace.data.requests[0].status, "PENDING");
  assert.equal(workspace.data.requests[0].eventTitle, "TIG Live: Neon Stage");
  assert.ok(workspace.data.requests[0].venue);
  assert.ok(workspace.data.requests[0].zoneName);
  assert.ok(workspace.data.requests[0].dateLabel);
  assert.ok(workspace.data.eventSummaries.some((event) => event.id === "event_kpop_001"));
});

test("public group-booking request validation rejects bad required fields with specific codes", async (t) => {
  const server = await startServer(t);
  const state = await api(server.baseUrl, "/api/state");
  const base = requestPayload(state);

  const missing = await api(server.baseUrl, "/api/group-booking/requests", { ...base, orgName: "" }, 400);
  assert.equal(missing.error.code, "MISSING_FIELD");

  const badEmail = await api(server.baseUrl, "/api/group-booking/requests", { ...base, contactEmail: "not-an-email" }, 422);
  assert.equal(badEmail.error.code, "INVALID_EMAIL");

  const badPhone = await api(server.baseUrl, "/api/group-booking/requests", { ...base, contactPhone: "02-123-4567" }, 422);
  assert.equal(badPhone.error.code, "INVALID_PHONE_NUMBER");

  const missingEvent = await api(server.baseUrl, "/api/group-booking/requests", { ...base, eventId: "event_missing" }, 404);
  assert.equal(missingEvent.error.code, "EVENT_NOT_FOUND");

  const workspace = await adminApi(server, "/api/admin/workspaces/group-booking");
  assert.equal(workspace.data.requests.length, 0);
});

test("group-booking admin workspace requires groupBooking.manage permission for browser sessions", async (t) => {
  const server = await startServer(t, { env: { TIG_ADMIN_ROLES: "readonly" } });
  const login = await adminSessionRequest(server, "/api/admin/login", {
    body: { username: "admin", password: bootstrapAdminPassword }
  });

  const denied = await adminSessionRequest(server, "/api/admin/workspaces/group-booking", {
    cookie: login.setCookie.split(";")[0],
    expectedStatus: 403
  });
  assert.equal(denied.json.error.code, "ADMIN_PERMISSION_DENIED");
  assert.equal(denied.json.error.detail.permission, "groupBooking.manage");
});

test("approving a group-booking request assigns institutional tickets all at once", async (t) => {
  const server = await startServer(t);
  const admin = await groupBookingAdminSession(server);
  const created = await submitGroupBooking(server, { expectedHeadcount: 3, contactEmail: "approve@example.org" });

  const approved = await adminSessionRequest(server, `/api/admin/group-booking/requests/${created.data.id}/approve`, {
    cookie: admin.cookie,
    csrf: admin.csrf,
    body: { assignedCount: 2, reviewNote: "2석 우선 승인" }
  });

  assert.equal(approved.json.data.status, "APPROVED");
  assert.equal(approved.json.data.assignedCount, 2);
  assert.equal(approved.json.data.assignedTicketIds.length, 2);
  assert.ok(approved.json.data.buyerUserId);

  const workspace = await adminApi(server, "/api/admin/workspaces/group-booking?status=APPROVED");
  const request = workspace.data.requests.find((item) => item.id === created.data.id);
  assert.equal(request.status, "APPROVED");
  assert.equal(request.assignedCount, 2);
  assert.equal(request.reviewNote, "2석 우선 승인");

  const userTickets = await api(server.baseUrl, `/api/users/${request.buyerUserId}/tickets`);
  assert.equal(userTickets.data.length, 2);
  assert.deepEqual(userTickets.data.map((ticket) => ticket.status), ["OWNED", "OWNED"]);

  const inventory = await adminApi(server, `/api/admin/workspaces/inventory?eventId=${request.eventId}&performanceDateId=${request.performanceDateId}&zoneId=${request.zoneId}&limit=100`);
  const assignedTickets = inventory.data.tickets.filter((ticket) => request.assignedTicketIds.includes(ticket.id));
  assert.equal(assignedTickets.length, 2);
  assert.ok(assignedTickets.every((ticket) => ticket.ownerId === request.buyerUserId));
  assert.ok(assignedTickets.every((ticket) => ticket.institutional === true));
  assert.ok(assignedTickets.every((ticket) => ticket.groupBookingRequestId === request.id));
  assert.ok(assignedTickets.every((ticket) => ticket.admissionCredentialId));

  const finance = await adminApi(server, `/api/admin/workspaces/finance?eventId=${request.eventId}&limit=100`);
  const groupBookingTransaction = finance.data.transactions.find((transaction) => transaction.groupBookingRequestId === request.id);
  assert.ok(groupBookingTransaction, "finance workspace includes the group-booking transaction");
  assert.equal(groupBookingTransaction.eventId, request.eventId);
  assert.equal(groupBookingTransaction.eventTitle, request.eventTitle);
});

test("group-booking approval preserves inventory when requested count is unavailable", async (t) => {
  const server = await startServer(t);
  const state = await api(server.baseUrl, "/api/state");
  const payload = requestPayload(state, { expectedHeadcount: 999, contactEmail: "shortage@example.org" });
  const availableBefore = state.data.tickets.filter((ticket) => (
    ticket.eventId === payload.eventId
    && ticket.performanceDateId === payload.performanceDateId
    && ticket.zoneId === payload.zoneId
    && ticket.status === "ON_SALE"
  )).length;
  const created = await api(server.baseUrl, "/api/group-booking/requests", payload);

  const denied = await adminApi(server, `/api/admin/group-booking/requests/${created.data.id}/approve`, {
    assignedCount: availableBefore + 1,
    reviewNote: "재고 초과"
  }, 409);
  assert.equal(denied.error.code, "INSUFFICIENT_INVENTORY");
  assert.equal(denied.error.detail.available, availableBefore);
  assert.equal(denied.error.detail.requested, availableBefore + 1);

  const after = await adminApi(server, "/api/admin/workspaces/group-booking");
  const request = after.data.requests.find((item) => item.id === created.data.id);
  assert.equal(request.status, "PENDING");
  assert.deepEqual(request.assignedTicketIds, []);
  assert.equal(request.assignedCount, null);
});

test("group-booking request cannot be approved again after review", async (t) => {
  const server = await startServer(t);
  const created = await submitGroupBooking(server, { contactEmail: "double-review@example.org" });
  const approved = await adminApi(server, `/api/admin/group-booking/requests/${created.data.id}/approve`, {
    assignedCount: 1,
    reviewNote: "승인"
  });
  assert.equal(approved.data.status, "APPROVED");

  const denied = await adminApi(server, `/api/admin/group-booking/requests/${created.data.id}/approve`, {
    assignedCount: 1,
    reviewNote: "재승인"
  }, 409);
  assert.equal(denied.error.code, "GROUP_BOOKING_ALREADY_REVIEWED");

  const workspace = await adminApi(server, "/api/admin/workspaces/group-booking");
  const request = workspace.data.requests.find((item) => item.id === created.data.id);
  assert.equal(request.status, "APPROVED");
  assert.equal(request.assignedCount, 1);
});

test("rejecting a group-booking request requires a review note and does not assign tickets", async (t) => {
  const server = await startServer(t);
  const created = await submitGroupBooking(server, { contactEmail: "reject@example.org" });

  const missing = await adminApi(server, `/api/admin/group-booking/requests/${created.data.id}/reject`, {
    reviewNote: ""
  }, 400);
  assert.equal(missing.error.code, "MISSING_FIELD");

  const rejected = await adminApi(server, `/api/admin/group-booking/requests/${created.data.id}/reject`, {
    reviewNote: "기관 증빙 확인 불가"
  });
  assert.equal(rejected.data.status, "REJECTED");
  assert.equal(rejected.data.reviewNote, "기관 증빙 확인 불가");
  assert.deepEqual(rejected.data.assignedTicketIds, []);
  assert.equal(rejected.data.buyerUserId, null);

  const denied = await adminApi(server, `/api/admin/group-booking/requests/${created.data.id}/approve`, {
    assignedCount: 1,
    reviewNote: "승인 불가"
  }, 409);
  assert.equal(denied.error.code, "GROUP_BOOKING_ALREADY_REVIEWED");
});

test("institutional tickets assigned by approval cannot be listed for resale", async (t) => {
  const server = await startServer(t);
  const created = await submitGroupBooking(server, { contactEmail: "resale-block@example.org" });
  const approved = await adminApi(server, `/api/admin/group-booking/requests/${created.data.id}/approve`, {
    assignedCount: 1,
    reviewNote: "승인"
  });
  const ticketId = approved.data.assignedTicketIds[0];

  const blocked = await api(server.baseUrl, "/api/resale/list", {
    sellerId: approved.data.buyerUserId,
    ticketId,
    price: 100000
  }, 403);
  assert.equal(blocked.error.code, "INSTITUTIONAL_TICKET_RESALE_BLOCKED");
});
