export function createEngagementBackend({
  appendLedger,
  findUser,
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
    const jobs = watch.notificationEnabled ? scheduleWatchlistNotifications(db, watch) : [];
    appendLedger(db, user.id, "WATCHLIST_UPSERTED", {
      watchlistId: watch.id,
      eventId: event.id,
      channels: cleanChannels,
      calendarEnabled: watch.calendarEnabled,
      scheduledJobs: jobs.length
    });
    return { watchlist: watch, event, notificationJobs: jobs };
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

  function createSupportThread(db, { userId, subject, message }) {
    const user = findUser(db, userId);
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) throw httpError(400, "EMPTY_SUPPORT_MESSAGE", "문의 내용을 입력해주세요.");
    const thread = {
      id: id("support"),
      userId: user.id,
      subject: String(subject || "1:1 실시간 문의").trim().slice(0, 80) || "1:1 실시간 문의",
      status: "OPEN",
      priority: "NORMAL",
      createdAt: now(),
      updatedAt: now(),
      messages: [
        {
          id: id("msg"),
          actorId: user.id,
          role: "CUSTOMER",
          body: cleanMessage.slice(0, 1000),
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

  function addSupportMessage(db, { threadId, actorId, role, message }) {
    const thread = db.supportThreads.find((item) => item.id === threadId);
    if (!thread) throw httpError(404, "SUPPORT_THREAD_NOT_FOUND", "문의 내역을 찾을 수 없습니다.");
    const cleanMessage = String(message || "").trim();
    if (!cleanMessage) throw httpError(400, "EMPTY_SUPPORT_MESSAGE", "메시지를 입력해주세요.");
    const normalizedRole = role === "ADMIN" ? "ADMIN" : "CUSTOMER";
    if (normalizedRole === "CUSTOMER" && actorId !== thread.userId) {
      throw httpError(403, "SUPPORT_FORBIDDEN", "본인 문의에만 메시지를 남길 수 있습니다.");
    }
    if (normalizedRole === "CUSTOMER") findUser(db, actorId);
    const entry = {
      id: id("msg"),
      actorId: normalizedRole === "ADMIN" ? "ADMIN" : actorId,
      role: normalizedRole,
      body: cleanMessage.slice(0, 1000),
      at: now()
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

  return {
    addSupportMessage,
    createSupportThread,
    notifyWatchlist,
    supportThreadForUser,
    updateSupportStatus,
    upsertWatchlist,
    userWatchlist
  };
}
