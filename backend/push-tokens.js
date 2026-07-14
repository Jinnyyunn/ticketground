export function createPushTokenBackend({ findUser, httpError, id, now }) {
  function registerPushToken(db, { userId, platform, token }) {
    const user = findUser(db, userId);
    const normalizedPlatform = String(platform || "").toLowerCase();
    if (!["ios", "android"].includes(normalizedPlatform)) {
      throw httpError(422, "INVALID_PUSH_PLATFORM", "푸시 플랫폼은 ios 또는 android만 지원합니다.");
    }
    const cleanToken = String(token || "").trim();
    if (!cleanToken) throw httpError(400, "MISSING_FIELD", "token 값이 필요합니다.", { field: "token" });
    let record = db.pushTokens.find((item) => item.userId === user.id && item.platform === normalizedPlatform && item.token === cleanToken);
    if (!record) {
      record = {
        id: id("push"),
        userId: user.id,
        platform: normalizedPlatform,
        token: cleanToken,
        status: "ACTIVE",
        createdAt: now(),
        updatedAt: now()
      };
      db.pushTokens.push(record);
    } else {
      record.status = "ACTIVE";
      record.updatedAt = now();
    }
    return record;
  }

  return { registerPushToken };
}
