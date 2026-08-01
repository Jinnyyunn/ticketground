export function createEngagementBackend({
  appendLedger,
  findUser,
  hash,
  httpError,
  id,
  now,
  offsetIso,
  primaryDate,
  stableId
}) {
  function userWatchlist(db, userId) {
    findUser(db, userId);
    return db.watchlist
      .filter((item) => item.userId === userId)
      .map((item) => ({
        ...item,
        event: db.events.find((event) => event.id === item.eventId) || null,
        notificationJobs: db.notificationJobs.filter((job) => job.watchlistId === item.id)
      }))
      .sort((a, b) => new Date(a.event?.date || a.createdAt) - new Date(b.event?.date || b.createdAt));
  }

  function publicWatchlistItem(db, watch) {
    return {
      id: watch.id,
      eventId: watch.eventId,
      channels: watch.channels,
      calendarEnabled: watch.calendarEnabled,
      notificationEnabled: watch.notificationEnabled,
      createdAt: watch.createdAt,
      updatedAt: watch.updatedAt,
      event: db.events.find((event) => event.id === watch.eventId) || null,
      notificationJobs: db.notificationJobs.filter((job) => job.watchlistId === watch.id)
    };
  }

  function userWatchlistForPrincipal(db, userId) {
    findUser(db, userId);
    return db.watchlist
      .filter((item) => item.userId === userId)
      .map((item) => publicWatchlistItem(db, item))
      .sort((a, b) => new Date(a.event?.date || a.createdAt) - new Date(b.event?.date || b.createdAt));
  }

  function notificationScheduleForEvent(event) {
    const firstStartsAt = primaryDate(event).startsAt;
    return {
      bookingOpensAt: offsetIso(firstStartsAt, 30 * 24 * 60 * 60 * 1000),
      d3NotifyAt: offsetIso(firstStartsAt, 33 * 24 * 60 * 60 * 1000),
      dayOfNotifyAt: offsetIso(firstStartsAt, 30 * 24 * 60 * 60 * 1000 - 60 * 60 * 1000)
    };
  }

  function scheduleWatchlistNotifications(db, watch) {
    const event = db.events.find((item) => item.id === watch.eventId);
    if (!event) return [];
    const schedule = notificationScheduleForEvent(event);
    const templates = [
      { type: "BOOKING_D3", scheduledAt: schedule.d3NotifyAt, title: "예매 오픈 D-3 알림" },
      { type: "BOOKING_DAY_OF", scheduledAt: schedule.dayOfNotifyAt, title: "예매 오픈 당일 알림" }
    ];
    const jobs = [];
    for (const template of templates) {
      let job = db.notificationJobs.find((item) => item.watchlistId === watch.id && item.type === template.type);
      if (!job) {
        job = {
          id: stableId("notify", watch.id, template.type),
          watchlistId: watch.id,
          userId: watch.userId,
          eventId: watch.eventId,
          type: template.type,
          title: template.title,
          channels: watch.channels,
          scheduledAt: template.scheduledAt,
          status: "SCHEDULED",
          createdAt: now(),
          updatedAt: now()
        };
        db.notificationJobs.push(job);
      } else {
        job.channels = watch.channels;
        job.scheduledAt = template.scheduledAt;
        job.status = job.status === "SENT" ? "SENT" : "SCHEDULED";
        job.updatedAt = now();
      }
      jobs.push(job);
    }
    return jobs;
  }

  function cancelWatchlistNotifications(db, watch) {
    const jobs = db.notificationJobs.filter((job) => job.watchlistId === watch.id);
    for (const job of jobs) {
      if (job.status === "SCHEDULED") {
        job.status = "CANCELED";
        job.updatedAt = now();
      }
    }
    return jobs;
  }

  function upsertWatchlist(db, { userId, eventId, channels = ["APP_PUSH"], calendarEnabled = true, notificationEnabled = true }) {
    const user = findUser(db, userId);
    const event = db.events.find((item) => item.id === eventId);
    if (!event) throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
    const cleanChannels = Array.isArray(channels) && channels.length
      ? [...new Set(channels.map((channel) => String(channel).toUpperCase()).filter(Boolean))]
      : ["APP_PUSH"];
    let watch = db.watchlist.find((item) => item.userId === user.id && item.eventId === event.id);
    if (!watch) {
      watch = {
        id: stableId("watch", user.id, event.id),
        userId: user.id,
        eventId: event.id,
        channels: cleanChannels,
        calendarEnabled: Boolean(calendarEnabled),
        notificationEnabled: Boolean(notificationEnabled),
        createdAt: now(),
        updatedAt: now()
      };
      db.watchlist.push(watch);
    } else {
      watch.channels = cleanChannels;
      watch.calendarEnabled = Boolean(calendarEnabled);
      watch.notificationEnabled = Boolean(notificationEnabled);
      watch.updatedAt = now();
    }
    const jobs = watch.notificationEnabled
      ? scheduleWatchlistNotifications(db, watch)
      : cancelWatchlistNotifications(db, watch);
    appendLedger(db, user.id, "WATCHLIST_UPSERTED", {
      watchlistId: watch.id,
      eventId: event.id,
      channels: cleanChannels,
      calendarEnabled: watch.calendarEnabled,
      scheduledJobs: jobs.filter((job) => job.status === "SCHEDULED").length,
      canceledJobs: jobs.filter((job) => job.status === "CANCELED").length
    });
    return { watchlist: watch, event, notificationJobs: jobs };
  }

  function upsertWatchlistForPrincipal(db, userId, eventId, preferences) {
    for (const field of ["calendarEnabled", "notificationEnabled"]) {
      if (Object.hasOwn(preferences, field) && typeof preferences[field] !== "boolean") {
        throw httpError(400, "INVALID_WATCHLIST_PREFERENCES", "관심공연 설정값을 확인해주세요.");
      }
    }
    const result = upsertWatchlist(db, { ...preferences, userId, eventId });
    return publicWatchlistItem(db, result.watchlist);
  }

  function removeWatchlistForPrincipal(db, userId, eventId) {
    findUser(db, userId);
    const index = db.watchlist.findIndex((item) => item.userId === userId && item.eventId === eventId);
    if (index < 0) return { deleted: true, eventId };
    const [watch] = db.watchlist.splice(index, 1);
    cancelWatchlistNotifications(db, watch);
    appendLedger(db, userId, "WATCHLIST_REMOVED", {
      watchlistId: watch.id,
      eventId
    });
    return { deleted: true, eventId };
  }

  function notifyWatchlist(db, { watchlistId, userId, eventId, type = "STATUS_CHANGE", dispatchNow = false }) {
    const watch = watchlistId
      ? db.watchlist.find((item) => item.id === watchlistId)
      : db.watchlist.find((item) => item.userId === userId && item.eventId === eventId);
    if (!watch) throw httpError(404, "WATCHLIST_NOT_FOUND", "관심 공연을 찾을 수 없습니다.");
    const event = db.events.find((item) => item.id === watch.eventId);
    const normalizedType = String(type || "STATUS_CHANGE").toUpperCase();
    const job = {
      id: id("notify"),
      watchlistId: watch.id,
      userId: watch.userId,
      eventId: watch.eventId,
      type: normalizedType,
      title: event ? `${event.title} 알림` : "관심 공연 알림",
      channels: watch.channels,
      scheduledAt: dispatchNow || !event ? now() : notificationScheduleForEvent(event).dayOfNotifyAt,
      status: dispatchNow ? "SENT" : "SCHEDULED",
      createdAt: now(),
      updatedAt: now()
    };
    db.notificationJobs.push(job);
    appendLedger(db, "SYSTEM", "WATCHLIST_NOTIFICATION_RECORDED", {
      watchlistId: watch.id,
      eventId: watch.eventId,
      type: normalizedType,
      status: job.status,
      channels: job.channels
    });
    return { watchlist: watch, event, notificationJob: job };
  }

  function supportThreadForUser(db, userId) {
    findUser(db, userId);
    return db.supportThreads
      .filter((thread) => thread.userId === userId)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function publicSupportContent() {
    return {
      version: "1",
      faqs: [
        { id: "booking", question: "예매 내역은 어디에서 확인하나요?", answer: "로그인 후 마이페이지의 예매내역에서 확인할 수 있습니다." },
        { id: "cancel", question: "취소 가능 여부는 어떻게 확인하나요?", answer: "공연별 취소 정책과 예매 상세의 서버 상태를 확인해주세요." },
        { id: "ticket", question: "모바일 티켓은 언제 표시되나요?", answer: "서버에서 예매가 확정된 뒤 모바일 티켓 상태가 표시됩니다." }
      ],
      notices: [
        { id: "secure-support", title: "안전한 1:1 문의", body: "로그인 세션의 본인 문의만 조회하고 작성할 수 있습니다." },
        { id: "reply-status", title: "답변 상태 안내", body: "문의 목록에서 답변 상태를 확인하세요." }
      ]
    };
  }

  function publicSupportThread(thread) {
    return {
      id: thread.id,
      subject: thread.subject,
      status: thread.status,
      category: thread.category,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      messages: thread.messages.map((message) => ({
        id: message.id,
        role: message.role,
        body: message.body,
        at: message.at
      }))
    };
  }

  function supportIdempotency(kind, userId, key, payload) {
    return {
      keyDigest: hash(`support:${kind}:${userId}:${key}`),
      requestDigest: hash(`support:${kind}:payload:${JSON.stringify(payload)}`)
    };
  }

  function createSupportThread(db, { userId, subject, message, category, idempotencyKey }) {
    const user = findUser(db, userId);
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) throw httpError(400, "EMPTY_SUPPORT_MESSAGE", "문의 내용을 입력해주세요.");
    if (cleanMessage.length > 1000) throw httpError(422, "SUPPORT_MESSAGE_TOO_LONG", "문의 내용은 1,000자 이하로 입력해주세요.");
    const allowedCategories = ["GENERAL", "PAYMENT", "TICKET_QR", "URGENT"];
    const normalizedCategory = allowedCategories.includes(String(category || "").toUpperCase()) ? String(category).toUpperCase() : "GENERAL";
    const cleanSubject = String(subject || "1:1 실시간 문의").trim() || "1:1 실시간 문의";
    if (cleanSubject.length > 80) throw httpError(422, "SUPPORT_SUBJECT_TOO_LONG", "문의 제목은 80자 이하로 입력해주세요.");
    const idempotency = idempotencyKey
      ? supportIdempotency("thread", user.id, idempotencyKey, { subject: cleanSubject, message: cleanMessage, category: normalizedCategory })
      : null;
    if (idempotency) {
      const existing = db.supportThreads.find((item) => item.idempotency?.keyDigest === idempotency.keyDigest);
      if (existing) {
        if (existing.idempotency.requestDigest !== idempotency.requestDigest) {
          throw httpError(409, "IDEMPOTENCY_CONFLICT", "같은 재시도 키에 다른 문의 내용이 전달되었습니다.");
        }
        return existing;
      }
    }
    const thread = {
      id: id("support"),
      userId: user.id,
      subject: cleanSubject,
      status: "OPEN",
      priority: "NORMAL",
      category: normalizedCategory,
      createdAt: now(),
      updatedAt: now(),
      ...(idempotency ? { idempotency } : {}),
      messages: [
        {
          id: id("msg"),
          actorId: user.id,
          role: "CUSTOMER",
          body: cleanMessage,
          at: now()
        }
      ]
    };
    db.supportThreads.unshift(thread);
    db.operatorAlerts.unshift({
      id: id("alert"),
      type: "SUPPORT_INBOUND",
      channel: "KAKAO_OR_SMS_PLACEHOLDER",
      status: "PENDING",
      threadId: thread.id,
      userId: user.id,
      message: `${thread.subject}: ${cleanMessage.slice(0, 80)}`,
      createdAt: now()
    });
    appendLedger(db, user.id, "SUPPORT_THREAD_CREATED", {
      threadId: thread.id,
      subject: thread.subject,
      operatorAlert: "KAKAO_OR_SMS_PLACEHOLDER"
    });
    return thread;
  }

  function addSupportMessage(db, { threadId, actorId, role, message, idempotencyKey }) {
    const thread = db.supportThreads.find((item) => item.id === threadId);
    if (!thread) throw httpError(404, "SUPPORT_THREAD_NOT_FOUND", "문의 내역을 찾을 수 없습니다.");
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) throw httpError(400, "EMPTY_SUPPORT_MESSAGE", "메시지를 입력해주세요.");
    if (cleanMessage.length > 1000) throw httpError(422, "SUPPORT_MESSAGE_TOO_LONG", "메시지는 1,000자 이하로 입력해주세요.");
    const normalizedRole = role === "ADMIN" ? "ADMIN" : "CUSTOMER";
    if (normalizedRole === "CUSTOMER" && actorId !== thread.userId) {
      throw httpError(403, "SUPPORT_FORBIDDEN", "본인 문의에만 메시지를 남길 수 있습니다.");
    }
    if (normalizedRole === "CUSTOMER") findUser(db, actorId);
    const idempotency = idempotencyKey
      ? supportIdempotency("message", actorId, idempotencyKey, { threadId, message: cleanMessage })
      : null;
    if (idempotency) {
      const existing = thread.messages.find((item) => item.idempotency?.keyDigest === idempotency.keyDigest);
      if (existing) {
        if (existing.idempotency.requestDigest !== idempotency.requestDigest) {
          throw httpError(409, "IDEMPOTENCY_CONFLICT", "같은 재시도 키에 다른 메시지가 전달되었습니다.");
        }
        return thread;
      }
    }
    const entry = {
      id: id("msg"),
      actorId: normalizedRole === "ADMIN" ? "ADMIN" : actorId,
      role: normalizedRole,
      body: cleanMessage,
      at: now(),
      ...(idempotency ? { idempotency } : {})
    };
    thread.messages.push(entry);
    thread.status = normalizedRole === "ADMIN" ? "ANSWERED" : "OPEN";
    thread.updatedAt = now();
    db.operatorAlerts.unshift({
      id: id("alert"),
      type: normalizedRole === "ADMIN" ? "SUPPORT_ADMIN_REPLY" : "SUPPORT_CUSTOMER_REPLY",
      channel: normalizedRole === "ADMIN" ? "APP_OR_SMS_PLACEHOLDER" : "KAKAO_OR_SMS_PLACEHOLDER",
      status: "PENDING",
      threadId: thread.id,
      userId: thread.userId,
      message: cleanMessage.slice(0, 100),
      createdAt: now()
    });
    appendLedger(db, entry.actorId, "SUPPORT_MESSAGE_ADDED", {
      threadId: thread.id,
      role: entry.role
    });
    return thread;
  }

  function updateSupportStatus(db, { threadId, status }) {
    const allowed = ["OPEN", "ANSWERED", "CLOSED"];
    if (!allowed.includes(status)) throw httpError(422, "INVALID_SUPPORT_STATUS", "지원하지 않는 문의 상태입니다.");
    const thread = db.supportThreads.find((item) => item.id === threadId);
    if (!thread) throw httpError(404, "SUPPORT_THREAD_NOT_FOUND", "문의 내역을 찾을 수 없습니다.");
    thread.status = status;
    thread.updatedAt = now();
    appendLedger(db, "ADMIN", "SUPPORT_STATUS_UPDATED", {
      threadId: thread.id,
      status
    });
    return thread;
  }

  function supportThreadsForPrincipal(db, userId) {
    return supportThreadForUser(db, userId).map(publicSupportThread);
  }

  function createSupportThreadForPrincipal(db, userId, body, idempotencyKey) {
    return publicSupportThread(createSupportThread(db, { ...body, userId, idempotencyKey }));
  }

  function addSupportMessageForPrincipal(db, userId, body, idempotencyKey) {
    const thread = db.supportThreads.find((item) => item.id === body.threadId);
    if (!thread) throw httpError(404, "SUPPORT_THREAD_NOT_FOUND", "문의 내역을 찾을 수 없습니다.");
    if (thread.userId !== userId) throw httpError(403, "SUPPORT_FORBIDDEN", "본인 문의에만 메시지를 남길 수 있습니다.");
    return publicSupportThread(addSupportMessage(db, {
      threadId: body.threadId,
      actorId: userId,
      role: "CUSTOMER",
      message: body.message,
      idempotencyKey
    }));
  }

  return {
    addSupportMessage,
    addSupportMessageForPrincipal,
    createSupportThread,
    createSupportThreadForPrincipal,
    notifyWatchlist,
    publicSupportContent,
    removeWatchlistForPrincipal,
    supportThreadForUser,
    supportThreadsForPrincipal,
    updateSupportStatus,
    upsertWatchlist,
    upsertWatchlistForPrincipal,
    userWatchlistForPrincipal,
    userWatchlist
  };
}
