import test from "node:test";
import assert from "node:assert/strict";
import { api, appAttestation, buyFirstTicket, startServer } from "./backend-test-utils.mjs";

test("backend issues virtual ticket, app-only admission QR, and one-use gate verification", async (t) => {
  const { baseUrl } = await startServer(t);
  const { ticket, purchase } = await buyFirstTicket(baseUrl);

  assert.equal(purchase.admission.activationChannel, "APP_ONLY");
  assert.equal(purchase.admissionCredential, undefined);
  assert.equal(purchase.user, undefined);
  assert.equal(purchase.ticket.ownerId, undefined);
  assert.equal(purchase.ticket.admissionCredentialId, undefined);

  const virtualQr = await api(baseUrl, "/api/tickets/virtual-qr", {
    userId: "user_fan_a",
    ticketId: ticket.id
  });
  assert.equal(virtualQr.data.type, "VIRTUAL_TICKET");
  assert.equal(virtualQr.data.admissionChannel, "APP_ONLY");
  assert.equal(virtualQr.data.ownerId, undefined);
  assert.equal(virtualQr.data.signature, undefined);

  const device = await api(baseUrl, "/api/devices/trust", {
    userId: "user_fan_a",
    deviceId: "iphone-15-pro",
    deviceName: "민서 iPhone",
    platform: "iOS",
    biometricVerified: true,
    appAttestation: appAttestation("TRUST_DEVICE", "user_fan_a", "iphone-15-pro")
  });
  assert.equal(device.data.device.status, "TRUSTED");
  assert.ok(device.data.deviceToken);

  const admissionQr = await api(baseUrl, "/api/tickets/qr", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    channel: "APP",
    deviceId: "iphone-15-pro",
    deviceToken: device.data.deviceToken,
    appAttestation: appAttestation("ISSUE_QR", "user_fan_a", "iphone-15-pro", ticket.id)
  });
  assert.equal(admissionQr.data.type, "ADMISSION");
  assert.equal(admissionQr.data.ttlSeconds, 20);
  assert.ok(Date.parse(admissionQr.data.expiresAt) - Date.parse(admissionQr.data.issuedAt) <= 20_000);

  const gateAccepted = await api(baseUrl, "/api/gate/verify", admissionQr.data);
  assert.equal(gateAccepted.data.valid, true);
  assert.equal(gateAccepted.data.credential, undefined);

  const replay = await api(baseUrl, "/api/gate/verify", admissionQr.data);
  assert.equal(replay.data.valid, false);

  const stateAfterQr = await api(baseUrl, "/api/state");
  const publicTicket = stateAfterQr.data.tickets.find((item) => item.id === ticket.id);
  assert.equal(publicTicket.ownerId, undefined);
  assert.equal(publicTicket.admissionCredentialId, undefined);
  assert.equal(publicTicket.currentQr, undefined);
  assert.equal(publicTicket.signature, undefined);
  assert.equal(publicTicket.nonce, undefined);
  const publicUser = stateAfterQr.data.users.find((item) => item.id === "user_fan_a");
  assert.equal(publicUser.balance, undefined);
  assert.equal(publicUser.status, undefined);
  assert.equal(publicUser.trustScore, undefined);
  assert.equal(publicUser.sanctions, undefined);
  assert.equal(stateAfterQr.data.admissionCredentials, undefined);
  assert.equal(stateAfterQr.data.watchlist, undefined);
  assert.equal(stateAfterQr.data.notificationJobs, undefined);
  assert.equal(stateAfterQr.data.supportThreads, undefined);
  assert.equal(stateAfterQr.data.backendSummary.admissionCredentials, undefined);
  assert.equal(stateAfterQr.data.ledger.latestHash, undefined);
});

test("backend rejects web admission QR, early QR activation, malformed watchlist, and out-of-policy resale", async (t) => {
  const early = await startServer(t, { now: "2026-09-19T15:00:00+09:00" });
  const { ticket } = await buyFirstTicket(early.baseUrl);
  const device = await api(early.baseUrl, "/api/devices/trust", {
    userId: "user_fan_a",
    deviceId: "iphone-early",
    biometricVerified: true,
    appAttestation: appAttestation("TRUST_DEVICE", "user_fan_a", "iphone-early")
  });

  const forgedDevice = await api(early.baseUrl, "/api/devices/trust", {
    userId: "user_fan_a",
    deviceId: "forged-iphone",
    biometricVerified: true
  }, 403);
  assert.equal(forgedDevice.error.code, "APP_ATTESTATION_REQUIRED");

  const webQr = await api(early.baseUrl, "/api/tickets/qr", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    channel: "WEB"
  }, 403);
  assert.equal(webQr.error.code, "APP_CHANNEL_REQUIRED");

  const earlyQr = await api(early.baseUrl, "/api/tickets/qr", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    channel: "APP",
    deviceId: "iphone-early",
    deviceToken: device.data.deviceToken,
    appAttestation: appAttestation("ISSUE_QR", "user_fan_a", "iphone-early", ticket.id)
  }, 409);
  assert.equal(earlyQr.error.code, "REAL_QR_NOT_READY");

  const forgedQr = await api(early.baseUrl, "/api/tickets/qr", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    channel: "APP",
    deviceId: "iphone-early",
    deviceToken: device.data.deviceToken,
    appAttestation: appAttestation("ISSUE_QR", "user_fan_b", "iphone-early", ticket.id)
  }, 403);
  assert.equal(forgedQr.error.code, "APP_ATTESTATION_REQUIRED");

  const emergencyBypass = await api(early.baseUrl, "/api/tickets/qr", {
    userId: "user_fan_a",
    ticketId: ticket.id,
    channel: "WEB",
    emergencyOverride: true,
    emergencyReason: "public-body-bypass"
  }, 403);
  assert.equal(emergencyBypass.error.code, "APP_CHANNEL_REQUIRED");

  const malformedWatch = await api(early.baseUrl, "/api/watchlist", {
    userId: "user_fan_a"
  }, 400);
  assert.equal(malformedWatch.error.code, "MISSING_FIELD");

  const emptySupport = await api(early.baseUrl, "/api/support/threads", {
    userId: "user_fan_a",
    message: " "
  }, 400);
  assert.equal(emptySupport.error.code, "EMPTY_SUPPORT_MESSAGE");

  const resale = await api(early.baseUrl, "/api/resale/list", {
    sellerId: "user_fan_a",
    ticketId: ticket.id,
    price: ticket.maxPrice + 1
  }, 422);
  assert.equal(resale.error.code, "PRICE_OUT_OF_POLICY");

  const ledger = await api(early.baseUrl, "/api/ledger/verify");
  assert.equal(ledger.data.ok, true);
});

test("backend watchlist, notification, seat map, and admin summary APIs remain usable", async (t) => {
  const { baseUrl, adminUrl } = await startServer(t);

  const watch = await api(baseUrl, "/api/watchlist", {
    userId: "user_fan_a",
    eventId: "event_kpop_001",
    channels: ["APP_PUSH", "KAKAO"],
    calendarEnabled: true,
    notificationEnabled: true
  });
  assert.equal(watch.data.watchlist.eventId, "event_kpop_001");
  assert.equal(watch.data.notificationJobs.length, 2);

  const userWatchlist = await api(baseUrl, "/api/users/user_fan_a/watchlist");
  assert.equal(userWatchlist.data.length, 1);

  const notify = await api(baseUrl, "/api/watchlist/notify", {
    watchlistId: watch.data.watchlist.id,
    type: "STATUS_CHANGE",
    dispatchNow: true
  });
  assert.equal(notify.data.notificationJob.status, "SENT");

  const seatMap = await api(baseUrl, "/api/seat-map?eventId=event_kpop_001");
  assert.ok(seatMap.data.seats.length > 0);
  assert.ok(seatMap.data.zones.length > 0);

  const publicAdmin = await api(baseUrl, "/api/admin/summary", null, 404);
  assert.equal(publicAdmin.error.code, "NOT_FOUND");
  const publicLedger = await api(baseUrl, "/api/ledger", null, 404);
  assert.equal(publicLedger.error.code, "NOT_FOUND");

  const admin = await api(adminUrl, "/api/admin/summary");
  assert.equal(admin.data.stats.watchlistEntries, 1);
  assert.ok(admin.data.stats.notificationJobs >= 3);
});
