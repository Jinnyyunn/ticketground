const PLATFORMS = new Set(["ios", "android"]);
const AUDIENCES = new Set(["ALL", "WATCHLIST", "TICKET_HOLDERS"]);
const DECISIONS = new Set(["APPROVED", "REJECTED"]);

export function createMobileAdminBackend({ appendLedger, clone, httpError, id, idempotentMutation, now }) {
  function compareVersions(left, right) {
    const a = left.split(/[+-]/)[0].split(".").map(Number);
    const b = right.split(/[+-]/)[0].split(".").map(Number);
    for (let index = 0; index < 3; index += 1) {
      if (a[index] !== b[index]) return a[index] - b[index];
    }
    return 0;
  }

  function cleanText(value, field, maxLength) {
    const result = String(value || "").trim();
    if (!result || result.length > maxLength) {
      throw httpError(422, "INVALID_MOBILE_ADMIN_INPUT", `${field} 값을 확인해 주세요.`);
    }
    return result;
  }

  function isoDate(value, field, optional = false) {
    if (optional && !value) return null;
    const result = String(value || "").trim();
    if (!result || !Number.isFinite(Date.parse(result))) {
      throw httpError(422, "INVALID_MOBILE_ADMIN_INPUT", `${field} 일시를 확인해 주세요.`);
    }
    return result;
  }

  function releasePolicies(db) {
    return ["ios", "android"].map((platform) => db.mobileReleasePolicies.find((item) => item.platform === platform) || {
      platform,
      minimumVersion: "1.0.0",
      recommendedVersion: "1.0.0",
      storeUrl: "",
      updatedAt: null,
      updatedBy: null
    });
  }

  function mobileWorkspace(db, actor) {
    const users = new Map(db.users.map((user) => [user.id, user]));
    const tickets = new Map(db.tickets.map((ticket) => [ticket.id, ticket]));
    const events = new Map(db.events.map((event) => [event.id, event]));
    const cancellationRequests = db.cancellationRequests.slice().reverse().map((request) => {
      const ticket = tickets.get(request.ticketId);
      return {
        id: request.id,
        ticketId: request.ticketId,
        userName: users.get(request.userId)?.name || "확인 필요",
        eventTitle: events.get(ticket?.eventId)?.title || ticket?.eventId || "공연 확인 필요",
        seatLabel: ticket?.seatLabel || "좌석 확인 필요",
        reason: request.reason,
        status: request.status,
        refundStatus: request.refundStatus || "NOT_REVIEWED",
        reviewNote: request.reviewNote || null,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt
      };
    });
    return {
      releasePolicies: clone(releasePolicies(db)),
      maintenance: clone(db.mobileMaintenance),
      pushCampaigns: clone(db.mobilePushCampaigns.slice(-50).reverse()),
      trustedDevices: db.trustedDevices.slice(-50).reverse().map((device) => ({
        id: device.id,
        userName: users.get(device.userId)?.name || "확인 필요",
        deviceName: device.deviceName,
        platform: device.platform,
        status: device.status,
        lastVerifiedAt: device.lastVerifiedAt,
        revokedAt: device.revokedAt || null,
        revokeReason: device.revokeReason || null
      })),
      qrAudit: db.qrIssueLogs.slice(-50).reverse().map((entry) => ({
        id: entry.id,
        ticketId: entry.ticketId,
        channel: entry.channel,
        traceCode: entry.traceCode || null,
        issuedAt: entry.issuedAt || entry.createdAt,
        expiresAt: entry.expiresAt,
        status: entry.status || "ISSUED"
      })),
      cancellationRequests: cancellationRequests.slice(0, 50),
      payments: actor.permissions?.includes("mobile.finance.read") ? db.paymentTransactions.slice(-50).reverse().map((transaction) => ({
        id: transaction.id,
        ticketId: transaction.ticketId,
        method: transaction.method,
        status: transaction.status,
        amount: transaction.amount,
        createdAt: transaction.createdAt
      })) : [],
      audit: db.ledger.filter((entry) => String(entry.action).startsWith("MOBILE_ADMIN_")).slice(-50).reverse().map((entry) => ({
        index: entry.index,
        actorId: entry.actorId,
        action: entry.action,
        at: entry.at
      }))
    };
  }

  function mutate(db, actor, kind, key, payload, operation) {
    return idempotentMutation(db, {
      kind: `mobile-admin-${kind}`,
      userId: actor.id,
      key: cleanText(key, "idempotencyKey", 120),
      payload
    }, operation);
  }

  function updateReleasePolicy(db, body, actor) {
    const platform = String(body.platform || "").toLowerCase();
    if (!PLATFORMS.has(platform)) throw httpError(422, "INVALID_PLATFORM", "앱 플랫폼을 확인해 주세요.");
    const input = {
      platform,
      minimumVersion: cleanText(body.minimumVersion, "minimumVersion", 32),
      recommendedVersion: cleanText(body.recommendedVersion, "recommendedVersion", 32),
      storeUrl: cleanText(body.storeUrl, "storeUrl", 300)
    };
    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(input.minimumVersion)
      || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(input.recommendedVersion)) {
      throw httpError(422, "INVALID_APP_VERSION", "앱 버전은 semantic version 형식으로 입력해 주세요.");
    }
    if (compareVersions(input.minimumVersion, input.recommendedVersion) > 0) {
      throw httpError(422, "INVALID_APP_VERSION_RANGE", "권장 버전은 최소 지원 버전보다 낮을 수 없습니다.");
    }
    let storeUrl;
    try { storeUrl = new URL(input.storeUrl); } catch { throw httpError(422, "INVALID_STORE_URL", "스토어 URL을 확인해 주세요."); }
    const expectedHost = platform === "ios" ? "apps.apple.com" : "play.google.com";
    if (storeUrl.protocol !== "https:" || storeUrl.hostname !== expectedHost || storeUrl.username || storeUrl.password) {
      throw httpError(422, "INVALID_STORE_URL", `${platform.toUpperCase()} 공식 스토어 HTTPS URL을 입력해 주세요.`);
    }
    return mutate(db, actor, "release-policy", body.idempotencyKey, input, () => {
      const timestamp = now();
      const policy = { ...input, updatedAt: timestamp, updatedBy: actor.id };
      const index = db.mobileReleasePolicies.findIndex((item) => item.platform === platform);
      if (index >= 0) db.mobileReleasePolicies[index] = policy;
      else db.mobileReleasePolicies.push(policy);
      appendLedger(db, actor.id, "MOBILE_ADMIN_RELEASE_POLICY_UPDATED", { platform, minimumVersion: input.minimumVersion, recommendedVersion: input.recommendedVersion });
      return clone(policy);
    });
  }

  function updateMaintenance(db, body, actor) {
    const input = {
      enabled: body.enabled === true,
      title: cleanText(body.title, "title", 80),
      message: cleanText(body.message, "message", 500),
      startsAt: isoDate(body.startsAt, "startsAt", true),
      endsAt: isoDate(body.endsAt, "endsAt", true)
    };
    if ((input.startsAt && !input.endsAt) || (!input.startsAt && input.endsAt)
      || (input.startsAt && Date.parse(input.startsAt) >= Date.parse(input.endsAt))) {
      throw httpError(422, "INVALID_MAINTENANCE_WINDOW", "점검 시작·종료 시간을 확인해 주세요.");
    }
    return mutate(db, actor, "maintenance", body.idempotencyKey, input, () => {
      db.mobileMaintenance = { ...input, updatedAt: now(), updatedBy: actor.id };
      appendLedger(db, actor.id, "MOBILE_ADMIN_MAINTENANCE_UPDATED", { enabled: input.enabled, startsAt: input.startsAt, endsAt: input.endsAt });
      return clone(db.mobileMaintenance);
    });
  }

  function createPushCampaign(db, body, actor) {
    const audience = String(body.audience || "").toUpperCase();
    if (!AUDIENCES.has(audience)) throw httpError(422, "INVALID_PUSH_AUDIENCE", "푸시 대상을 확인해 주세요.");
    const input = {
      title: cleanText(body.title, "title", 80),
      message: cleanText(body.message, "message", 300),
      audience,
      scheduledAt: isoDate(body.scheduledAt, "scheduledAt")
    };
    if (Date.parse(input.scheduledAt) <= Date.parse(now())) {
      throw httpError(422, "INVALID_PUSH_SCHEDULE", "푸시 예약 시간은 현재 이후여야 합니다.");
    }
    return mutate(db, actor, "push-campaign", body.idempotencyKey, input, () => {
      const campaign = { id: id("push_campaign"), ...input, status: "SCHEDULED", createdAt: now(), createdBy: actor.id };
      db.mobilePushCampaigns.push(campaign);
      appendLedger(db, actor.id, "MOBILE_ADMIN_PUSH_CAMPAIGN_SCHEDULED", { campaignId: campaign.id, audience, scheduledAt: campaign.scheduledAt });
      return clone(campaign);
    });
  }

  function revokeDevice(db, body, actor) {
    const deviceId = cleanText(body.deviceId, "deviceId", 120);
    const reason = cleanText(body.reason, "reason", 200);
    return mutate(db, actor, "device-revoke", body.idempotencyKey, { deviceId, reason }, () => {
      const device = db.trustedDevices.find((item) => item.id === deviceId);
      if (!device) throw httpError(404, "DEVICE_NOT_FOUND", "신뢰 기기를 찾을 수 없습니다.");
      device.status = "REVOKED";
      device.revokedAt = now();
      device.revokeReason = reason;
      appendLedger(db, actor.id, "MOBILE_ADMIN_DEVICE_REVOKED", { deviceId: device.id, reason });
      return { id: device.id, status: device.status, revokedAt: device.revokedAt };
    });
  }

  function reviewCancellation(db, body, actor) {
    const cancellationRequestId = cleanText(body.cancellationRequestId, "cancellationRequestId", 120);
    const decision = String(body.decision || "").toUpperCase();
    if (!DECISIONS.has(decision)) throw httpError(422, "INVALID_CANCELLATION_DECISION", "취소 검토 결정을 확인해 주세요.");
    const reviewNote = cleanText(body.reviewNote, "reviewNote", 300);
    return mutate(db, actor, "cancellation-review", body.idempotencyKey, { cancellationRequestId, decision, reviewNote }, () => {
      const request = db.cancellationRequests.find((item) => item.id === cancellationRequestId);
      if (!request) throw httpError(404, "CANCELLATION_REQUEST_NOT_FOUND", "취소 요청을 찾을 수 없습니다.");
      if (request.status !== "PENDING_REVIEW") throw httpError(409, "CANCELLATION_ALREADY_REVIEWED", "이미 검토된 취소 요청입니다.");
      request.status = decision;
      request.refundStatus = decision === "APPROVED" ? "PENDING_OPERATOR_ACTION" : "NOT_REQUIRED";
      request.reviewNote = reviewNote;
      request.reviewedBy = actor.id;
      request.updatedAt = now();
      appendLedger(db, actor.id, "MOBILE_ADMIN_CANCELLATION_REVIEWED", { cancellationRequestId, decision, refundStatus: request.refundStatus });
      return { id: request.id, status: request.status, refundStatus: request.refundStatus, updatedAt: request.updatedAt };
    });
  }

  return { createPushCampaign, mobileWorkspace, reviewCancellation, revokeDevice, updateMaintenance, updateReleasePolicy };
}
