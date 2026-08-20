import crypto from "node:crypto";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function createDeviceRegistration({ currentTimeMs, executeIdempotent, hash, httpError, id, now, randomHex, simulatorSecret }) {
  function ownedDevice(db, principal, deviceId) {
    const device = db.deviceRegistrations.find((item) => item.id === deviceId && item.userId === principal.userId);
    if (!device) throw httpError(404, "DEVICE_NOT_FOUND", "등록된 기기를 찾을 수 없습니다.");
    return device;
  }

  function safeDevice(device) {
    return {
      id: device.id,
      deviceId: device.deviceId,
      platform: device.platform,
      status: device.status,
      counter: device.counter,
      deliveryStatus: device.pushTokenHash && device.status === "TRUSTED" ? "REGISTERED" : "UNAVAILABLE",
      updatedAt: device.updatedAt
    };
  }

  function challenge(db, principal, key, body) {
    const deviceId = String(body.deviceId || "").trim();
    if (!deviceId) throw httpError(422, "DEVICE_ID_INVALID", "기기 식별자를 확인해주세요.");
    if (!simulatorSecret) throw httpError(503, "SIMULATOR_ATTESTATION_DISABLED", "시뮬레이터 인증 공급자가 설정되지 않았습니다.");
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: `DEVICE_CHALLENGE:${deviceId}`,
      key,
      payload: { deviceId }
    }, () => {
      const item = {
        id: id("challenge"),
        userId: principal.userId,
        deviceId,
        nonce: randomHex(24),
        status: "PENDING",
        expiresAt: new Date(currentTimeMs() + CHALLENGE_TTL_MS).toISOString(),
        createdAt: now()
      };
      db.deviceChallenges.push(item);
      return { id: item.id, nonce: item.nonce, expiresAt: item.expiresAt, provider: "IOS_SIMULATOR" };
    });
  }

  function expectedProof(nonce, deviceId, counter) {
    return crypto.createHmac("sha256", simulatorSecret).update(`${nonce}:${deviceId}:${counter}`).digest("hex");
  }

  function matches(actual, expected) {
    const actualBuffer = Buffer.from(String(actual || ""));
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
  }

  function trust(db, principal, key, body) {
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: `DEVICE_TRUST:${body.challengeId}`,
      key,
      payload: { challengeId: body.challengeId, counter: body.counter, deviceId: body.deviceId, proof: hash(String(body.proof || "")) }
    }, () => {
      const item = db.deviceChallenges.find((entry) => entry.id === body.challengeId && entry.userId === principal.userId);
      if (!item) throw httpError(404, "DEVICE_CHALLENGE_NOT_FOUND", "기기 인증 요청을 찾을 수 없습니다.");
      if (item.status !== "PENDING") throw httpError(409, "DEVICE_CHALLENGE_USED", "이미 사용한 기기 인증 요청입니다.");
      if (Date.parse(item.expiresAt) <= currentTimeMs()) throw httpError(409, "DEVICE_CHALLENGE_EXPIRED", "기기 인증 요청이 만료되었습니다.");
      const deviceId = String(body.deviceId || "").trim();
      const counter = Number(body.counter);
      if (deviceId !== item.deviceId || !Number.isSafeInteger(counter) || counter < 1) {
        throw httpError(422, "DEVICE_PROOF_INVALID", "기기 인증 정보를 확인해주세요.");
      }
      let device = db.deviceRegistrations.find((entry) => entry.userId === principal.userId && entry.deviceId === deviceId);
      if (device && counter <= device.counter) throw httpError(409, "DEVICE_COUNTER_REPLAY", "기기 인증 카운터를 다시 사용할 수 없습니다.");
      if (!matches(body.proof, expectedProof(item.nonce, deviceId, counter))) {
        throw httpError(403, "DEVICE_PROOF_INVALID", "기기 인증 서명이 올바르지 않습니다.");
      }
      item.status = "USED";
      const at = now();
      if (!device) {
        device = { id: id("device"), userId: principal.userId, deviceId, platform: "IOS_SIMULATOR", counter, status: "TRUSTED", pushTokenHash: null, pushEnvironment: null, createdAt: at, updatedAt: at };
        db.deviceRegistrations.push(device);
      } else {
        device.counter = counter;
        device.status = "TRUSTED";
        device.updatedAt = at;
      }
      return safeDevice(device);
    });
  }

  function putPushToken(db, principal, deviceId, key, body) {
    const token = String(body.token || "").trim();
    if (!token) throw httpError(422, "PUSH_TOKEN_INVALID", "푸시 토큰을 확인해주세요.");
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: `PUSH_TOKEN_PUT:${deviceId}`,
      key,
      payload: { environment: body.environment, tokenHash: hash(token) }
    }, () => {
      const device = ownedDevice(db, principal, deviceId);
      if (device.status !== "TRUSTED") throw httpError(409, "DEVICE_NOT_TRUSTED", "신뢰 기기 등록이 필요합니다.");
      device.pushTokenHash = hash(token);
      device.pushEnvironment = String(body.environment || "production").slice(0, 30);
      device.updatedAt = now();
      return safeDevice(device);
    });
  }

  function revokePushToken(db, principal, deviceId, key) {
    return executeIdempotent(db, { actorId: principal.userId, operation: `PUSH_TOKEN_DELETE:${deviceId}`, key, payload: { deviceId } }, () => {
      const device = ownedDevice(db, principal, deviceId);
      device.pushTokenHash = null;
      device.pushEnvironment = null;
      device.updatedAt = now();
      return safeDevice(device);
    });
  }

  // Named distinctly from mobile-admin.js's unrelated admin-facing
  // revokeDevice(db, body, actor) - both were spread into the same
  // createApiRouter dependency object in app.js, and a shared name there
  // means whichever spread runs last silently wins for every caller.
  function revokeDeviceRegistration(db, principal, deviceId, key) {
    return executeIdempotent(db, { actorId: principal.userId, operation: `DEVICE_REVOKE:${deviceId}`, key, payload: { deviceId } }, () => {
      const device = ownedDevice(db, principal, deviceId);
      device.status = "REVOKED";
      device.pushTokenHash = null;
      device.pushEnvironment = null;
      device.updatedAt = now();
      return safeDevice(device);
    });
  }

  function preferencesFor(db, principal) {
    let preferences = db.notificationPreferences.find((item) => item.userId === principal.userId);
    if (!preferences) {
      preferences = { userId: principal.userId, watchlistOpen: true, reservationUpdates: true, updatedAt: now() };
      db.notificationPreferences.push(preferences);
    }
    return preferences;
  }

  function settings(db, principal) {
    const preferences = preferencesFor(db, principal);
    const devices = db.deviceRegistrations.filter((item) => item.userId === principal.userId).map(safeDevice);
    return {
      preferences: { reservationUpdates: preferences.reservationUpdates, watchlistOpen: preferences.watchlistOpen },
      delivery: { available: devices.some((item) => item.deliveryStatus === "REGISTERED"), devices }
    };
  }

  function putSettings(db, principal, key, body) {
    if (typeof body.watchlistOpen !== "boolean" || typeof body.reservationUpdates !== "boolean") {
      throw httpError(422, "NOTIFICATION_SETTINGS_INVALID", "알림 설정 값을 확인해주세요.");
    }
    return executeIdempotent(db, { actorId: principal.userId, operation: "NOTIFICATION_SETTINGS_PUT", key, payload: body }, () => {
      const preferences = preferencesFor(db, principal);
      preferences.watchlistOpen = body.watchlistOpen;
      preferences.reservationUpdates = body.reservationUpdates;
      preferences.updatedAt = now();
      return settings(db, principal);
    });
  }

  function testPayload(db, principal, deviceId) {
    const device = ownedDevice(db, principal, deviceId);
    if (device.status !== "TRUSTED" || !device.pushTokenHash) {
      throw httpError(409, "PUSH_DELIVERY_UNAVAILABLE", "알림을 전달할 수 없는 기기입니다.");
    }
    return { aps: { alert: { body: "알림 수신 준비가 완료되었습니다.", title: "Ticketground" }, sound: "default" }, kind: "DEVICE_TEST" };
  }

  return { challenge, putPushToken, putSettings, revokeDeviceRegistration, revokePushToken, settings, testPayload, trust };
}
