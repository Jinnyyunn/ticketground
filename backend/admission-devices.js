export function createAdmissionDeviceBackend({
  appendLedger,
  findUser,
  hash,
  hmac,
  httpError,
  now,
  stableId
}) {
  function deviceTokenFor(userId, deviceId) {
    return hmac(`device:${userId}:${deviceId}`);
  }

  function trustDevice(db, { userId, deviceId, deviceName, platform, biometricVerified, attestationVerified = false }) {
    const user = findUser(db, userId);
    const cleanDeviceId = String(deviceId || "").trim();
    if (!cleanDeviceId) throw httpError(400, "MISSING_FIELD", "deviceId 값이 필요합니다.");
    if (biometricVerified !== true) {
      throw httpError(403, "DEVICE_VERIFICATION_REQUIRED", "OS 생체인증 또는 기기 잠금 인증이 필요합니다.");
    }
    if (attestationVerified !== true) {
      throw httpError(403, "APP_ATTESTATION_REQUIRED", "전용앱 인증 서명이 필요합니다.");
    }
    const deviceToken = deviceTokenFor(user.id, cleanDeviceId);
    const tokenHash = hash(deviceToken);
    let device = db.trustedDevices.find((item) => item.userId === user.id && item.deviceId === cleanDeviceId);
    if (!device) {
      device = {
        id: stableId("device", user.id, cleanDeviceId),
        userId: user.id,
        deviceId: cleanDeviceId,
        tokenHash,
        deviceName: String(deviceName || cleanDeviceId).slice(0, 80),
        platform: String(platform || "APP").slice(0, 40),
        status: "TRUSTED",
        createdAt: now(),
        lastVerifiedAt: now()
      };
      db.trustedDevices.push(device);
    } else {
      device.tokenHash = tokenHash;
      device.status = "TRUSTED";
      device.deviceName = String(deviceName || device.deviceName || cleanDeviceId).slice(0, 80);
      device.platform = String(platform || device.platform || "APP").slice(0, 40);
      device.lastVerifiedAt = now();
    }
    appendLedger(db, user.id, "TRUSTED_DEVICE_REGISTERED", {
      deviceId: cleanDeviceId,
      platform: device.platform,
      policy: "os-biometric-or-device-lock-result-only"
    });
    return {
      device: {
        id: device.id,
        userId: device.userId,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        platform: device.platform,
        status: device.status,
        lastVerifiedAt: device.lastVerifiedAt
      },
      deviceToken
    };
  }

  function requireTrustedDevice(db, { user, deviceId, deviceToken }) {
    const cleanDeviceId = String(deviceId || "").trim();
    if (!cleanDeviceId || !deviceToken) {
      throw httpError(403, "TRUSTED_DEVICE_REQUIRED", "입장 QR은 신뢰 기기에서만 발급할 수 있습니다.");
    }
    const device = db.trustedDevices.find((item) =>
      item.userId === user.id
      && item.deviceId === cleanDeviceId
      && item.tokenHash === hash(deviceToken)
      && item.status === "TRUSTED"
    );
    if (!device) throw httpError(403, "TRUSTED_DEVICE_REQUIRED", "등록된 신뢰 기기를 확인할 수 없습니다.");
    device.lastVerifiedAt = now();
    return device;
  }

  return { requireTrustedDevice, trustDevice };
}
