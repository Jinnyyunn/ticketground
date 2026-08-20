export function createWatchlistContract({ appendLedger, executeIdempotent, httpError, upsertWatchlist, userWatchlist }) {
  function watchlist(db, principal) {
    return userWatchlist(db, principal.userId);
  }

  function currentItem(db, principal, eventId) {
    return watchlist(db, principal).find((item) => item.eventId === eventId);
  }

  function putWatchlist(db, principal, eventId, key, body) {
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: `WATCHLIST_PUT:${eventId}`,
      key,
      payload: {
        calendarEnabled: body.calendarEnabled,
        channels: body.channels,
        notificationEnabled: body.notificationEnabled
      }
    }, () => {
      upsertWatchlist(db, {
        userId: principal.userId,
        eventId,
        calendarEnabled: body.calendarEnabled ?? true,
        channels: body.channels,
        notificationEnabled: body.notificationEnabled ?? true
      });
      return currentItem(db, principal, eventId);
    });
  }

  function deleteWatchlist(db, principal, eventId, key) {
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: `WATCHLIST_DELETE:${eventId}`,
      key,
      payload: { eventId }
    }, () => {
      const item = currentItem(db, principal, eventId);
      if (item) {
        for (const job of db.notificationJobs.filter((entry) => entry.watchlistId === item.id)) {
          if (job.status !== "SENT") job.status = "CANCELLED";
        }
        db.watchlist = db.watchlist.filter((entry) => entry.id !== item.id);
        appendLedger(db, principal.userId, "WATCHLIST_REMOVED", { eventId, watchlistId: item.id });
      }
      // Both keys carry the same meaning - `removed` is the current web-client
      // contract (ticketground-api-schemas.ts), `deleted` is what the already-
      // shipped iOS/Android decoders require (LiveBackendModels.swift /
      // AccountApiModels.kt). Neither installed base can be force-updated, so
      // this response satisfies both until a coordinated app release can drop
      // the older key.
      return { removed: true, deleted: true, eventId };
    });
  }

  function putWatchlistNotification(db, principal, eventId, key, body) {
    if (typeof body.enabled !== "boolean") {
      throw httpError(422, "WATCHLIST_NOTIFICATION_INVALID", "알림 설정 값을 확인해주세요.");
    }
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: `WATCHLIST_NOTIFICATION_PUT:${eventId}`,
      key,
      payload: { enabled: body.enabled }
    }, () => {
      const item = currentItem(db, principal, eventId);
      if (!item) throw httpError(404, "WATCHLIST_NOT_FOUND", "관심 공연을 찾을 수 없습니다.");
      upsertWatchlist(db, {
        userId: principal.userId,
        eventId,
        calendarEnabled: item.calendarEnabled,
        channels: item.channels,
        notificationEnabled: body.enabled
      });
      return currentItem(db, principal, eventId);
    });
  }

  return { deleteWatchlist, putWatchlist, putWatchlistNotification, watchlist };
}
