import test from "node:test";
import assert from "node:assert/strict";
import {
  adminApi,
  api,
  bootstrapAdminPassword,
  buyFirstNativeTicket,
  nativeGoogleLogin,
  startAttestedServer,
  trustIosDevice,
  verifyNativeIdentity
} from "./backend-test-utils.mjs";

async function sessionRequest(server, path, { body, cookie, csrf, expectedStatus = 200 } = {}) {
  const response = await fetch(`${server.adminUrl}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(csrf ? { "x-tig-csrf": csrf } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(json));
  return { json, cookie: response.headers.get("set-cookie")?.split(";")[0] || "" };
}

test("mobile operations workspace manages release, messaging, devices, cancellations, and audit without secrets", async (t) => {
  const server = await startAttestedServer(t);
  const login = await nativeGoogleLogin(server.baseUrl);
  await verifyNativeIdentity(server.baseUrl, login);
  const { ticket } = await buyFirstNativeTicket(server.baseUrl, login);
  const trusted = await trustIosDevice(server.baseUrl, login, { deviceId: "ios-admin-fixture", deviceName: "QA iPhone" });
  const cancellation = await api(server.baseUrl, "/api/me/cancellation-requests", {
    ticketId: ticket.id,
    reason: "공연 일정 변경",
    refundAcknowledged: true
  }, 200, { Authorization: login.authorization, "X-Idempotency-Key": "mobile-admin-cancel-request" });

  const initial = await adminApi(server, "/api/admin/workspaces/mobile");
  assert.deepEqual(initial.data.releasePolicies.map((item) => item.platform), ["ios", "android"]);
  assert.equal(initial.data.trustedDevices.some((item) => item.id === trusted.data.device.id), true);
  assert.equal(initial.data.cancellationRequests.some((item) => item.id === cancellation.data.id), true);
  assert.doesNotMatch(JSON.stringify(initial), /deviceToken|integrityToken|signature|nonce/i);

  const policy = await adminApi(server, "/api/admin/mobile/release-policy", {
    idempotencyKey: "release-policy-ios-1",
    platform: "ios",
    minimumVersion: "2.4.0",
    recommendedVersion: "2.6.0",
    storeUrl: "https://apps.apple.com/kr/app/ticketground/id1234567890"
  });
  assert.equal(policy.data.minimumVersion, "2.4.0");
  const replay = await adminApi(server, "/api/admin/mobile/release-policy", {
    idempotencyKey: "release-policy-ios-1",
    platform: "ios",
    minimumVersion: "2.4.0",
    recommendedVersion: "2.6.0",
    storeUrl: "https://apps.apple.com/kr/app/ticketground/id1234567890"
  });
  assert.deepEqual(replay.data, policy.data);
  await adminApi(server, "/api/admin/mobile/release-policy", {
    idempotencyKey: "release-policy-ios-1",
    platform: "ios",
    minimumVersion: "9.0.0",
    recommendedVersion: "9.0.0",
    storeUrl: "https://apps.apple.com/kr/app/ticketground/id1234567890"
  }, 409);

  const maintenance = await adminApi(server, "/api/admin/mobile/maintenance", {
    idempotencyKey: "maintenance-1",
    enabled: true,
    title: "결제 시스템 점검",
    message: "8월 14일 02:00부터 20분 동안 결제가 제한됩니다.",
    startsAt: "2026-09-20T02:00:00+09:00",
    endsAt: "2026-09-20T02:20:00+09:00"
  });
  assert.equal(maintenance.data.enabled, true);

  const campaign = await adminApi(server, "/api/admin/mobile/push-campaigns", {
    idempotencyKey: "push-campaign-1",
    title: "예매 오픈 안내",
    message: "관심공연 예매가 곧 시작됩니다.",
    audience: "WATCHLIST",
    scheduledAt: "2026-09-20T10:00:00+09:00"
  });
  assert.equal(campaign.data.status, "SCHEDULED");

  const revoked = await adminApi(server, "/api/admin/mobile/devices/revoke", {
    idempotencyKey: "revoke-device-1",
    deviceId: trusted.data.device.id,
    reason: "사용자 분실 신고"
  });
  assert.equal(revoked.data.status, "REVOKED");

  const reviewed = await adminApi(server, "/api/admin/mobile/cancellations/review", {
    idempotencyKey: "review-cancellation-1",
    cancellationRequestId: cancellation.data.id,
    decision: "APPROVED",
    reviewNote: "환불은 결제 운영자가 별도 처리"
  });
  assert.equal(reviewed.data.status, "APPROVED");
  assert.equal(reviewed.data.refundStatus, "PENDING_OPERATOR_ACTION");

  const refreshed = await adminApi(server, "/api/admin/workspaces/mobile");
  assert.equal(refreshed.data.maintenance.enabled, true);
  assert.equal(refreshed.data.pushCampaigns.length, 1);
  assert.equal(refreshed.data.trustedDevices.find((item) => item.id === trusted.data.device.id).status, "REVOKED");
  assert.equal(refreshed.data.cancellationRequests.find((item) => item.id === cancellation.data.id).status, "APPROVED");
  assert.ok(refreshed.data.audit.length >= 5);
  assert.deepEqual(Object.keys(refreshed.data.audit[0]).sort(), ["action", "actorId", "at", "index"]);

  const publicResponse = await api(server.baseUrl, "/api/admin/workspaces/mobile", null, 404);
  assert.equal(publicResponse.error.code, "NOT_FOUND");
});

test("mobile operations browser role is CSRF protected and cannot cross into finance", async (t) => {
  const server = await startAttestedServer(t, { env: { TIG_ADMIN_ROLES: "mobileOperations" } });
  const login = await sessionRequest(server, "/api/admin/login", {
    body: { username: "admin", password: bootstrapAdminPassword }
  });
  const csrf = login.json.data.csrf;
  assert.ok(csrf);
  assert.equal(login.json.data.admin.permissions.includes("mobile.read"), true);

  await sessionRequest(server, "/api/admin/workspaces/mobile", { cookie: login.cookie });
  const deniedFinance = await sessionRequest(server, "/api/admin/workspaces/finance", { cookie: login.cookie, expectedStatus: 403 });
  assert.equal(deniedFinance.json.error.detail.permission, "finance.read");
  const missingCsrf = await sessionRequest(server, "/api/admin/mobile/release-policy", {
    cookie: login.cookie,
    body: { idempotencyKey: "missing-csrf", platform: "android", minimumVersion: "1.0.0", recommendedVersion: "1.0.0", storeUrl: "https://play.google.com/store/apps/details?id=kr.ticketground.app" },
    expectedStatus: 403
  });
  assert.equal(missingCsrf.json.error.code, "CSRF_REQUIRED");
  const allowed = await sessionRequest(server, "/api/admin/mobile/release-policy", {
    cookie: login.cookie,
    csrf,
    body: { idempotencyKey: "role-release", platform: "android", minimumVersion: "1.0.0", recommendedVersion: "1.1.0", storeUrl: "https://play.google.com/store/apps/details?id=kr.ticketground.app" }
  });
  assert.equal(allowed.json.data.recommendedVersion, "1.1.0");
});
