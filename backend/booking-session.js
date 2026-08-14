const QUEUE_TTL_MS = 10 * 60 * 1000;
const HOLD_TTL_MS = 5 * 60 * 1000;

export function createBookingSession({ appendLedger, currentTimeMs, executeIdempotent, httpError, id, now }) {
  function expire(db) {
    const timestamp = currentTimeMs();
    for (const queue of db.bookingQueues) {
      if (queue.status === "READY" && Date.parse(queue.expiresAt) <= timestamp) queue.status = "EXPIRED";
    }
    for (const hold of db.seatHolds) {
      if (hold.status === "ACTIVE" && Date.parse(hold.expiresAt) <= timestamp) {
        hold.status = "EXPIRED";
        hold.updatedAt = now();
        db.bookingInventoryRevision += 1;
      }
    }
  }

  function eventPerformance(db, eventId, performanceId) {
    const event = db.events.find((item) => item.id === eventId);
    if (!event) throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
    const performance = event.dates?.find((item) => item.id === performanceId);
    if (!performance) throw httpError(404, "EVENT_DATE_NOT_FOUND", "예매 회차를 찾을 수 없습니다.");
    return { event, performance };
  }

  function ownedQueue(db, principal, queueId) {
    expire(db);
    const queue = db.bookingQueues.find((item) => item.id === queueId && item.userId === principal.userId);
    if (!queue) throw httpError(404, "BOOKING_QUEUE_NOT_FOUND", "대기열을 찾을 수 없습니다.");
    return queue;
  }

  function ownedHold(db, principal, holdId) {
    expire(db);
    const hold = db.seatHolds.find((item) => item.id === holdId && item.userId === principal.userId);
    if (!hold) throw httpError(404, "SEAT_HOLD_NOT_FOUND", "좌석 홀드를 찾을 수 없습니다.");
    return hold;
  }

  function queueView(queue) {
    return {
      id: queue.id,
      eventId: queue.eventId,
      performanceId: queue.performanceId,
      status: queue.status,
      position: queue.status === "READY" ? 0 : queue.position,
      expiresAt: queue.expiresAt,
      updatedAt: queue.updatedAt
    };
  }

  function holdView(hold) {
    return {
      id: hold.id,
      queueId: hold.queueId,
      ticketId: hold.ticketId,
      status: hold.status,
      expiresAt: hold.expiresAt,
      revision: hold.revision,
      updatedAt: hold.updatedAt
    };
  }

  function joinQueue(db, principal, key, body) {
    eventPerformance(db, body.eventId, body.performanceId);
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: `BOOKING_QUEUE_JOIN:${body.eventId}:${body.performanceId}`,
      key,
      payload: { eventId: body.eventId, performanceId: body.performanceId }
    }, () => {
      const at = now();
      const queue = {
        id: id("queue"),
        userId: principal.userId,
        eventId: body.eventId,
        performanceId: body.performanceId,
        status: "READY",
        position: 0,
        expiresAt: new Date(currentTimeMs() + QUEUE_TTL_MS).toISOString(),
        createdAt: at,
        updatedAt: at
      };
      db.bookingQueues.push(queue);
      appendLedger(db, principal.userId, "BOOKING_QUEUE_READY", { queueId: queue.id, eventId: queue.eventId });
      return queueView(queue);
    });
  }

  function queue(db, principal, queueId) {
    return queueView(ownedQueue(db, principal, queueId));
  }

  function seats(db, principal, { eventId, performanceId, queueId }) {
    const queue = ownedQueue(db, principal, queueId);
    if (queue.status !== "READY") throw httpError(409, "BOOKING_QUEUE_INACTIVE", "대기열 세션이 만료되었습니다.");
    if (queue.eventId !== eventId || queue.performanceId !== performanceId) {
      throw httpError(403, "BOOKING_QUEUE_SCOPE_MISMATCH", "대기열과 공연 회차가 일치하지 않습니다.");
    }
    const { event } = eventPerformance(db, eventId, performanceId);
    const activeByTicket = new Map(db.seatHolds.filter((item) => item.status === "ACTIVE").map((item) => [item.ticketId, item]));
    return {
      event: { id: event.id, title: event.title, venue: event.venue },
      performanceId,
      queue: queueView(queue),
      revision: db.bookingInventoryRevision,
      seats: db.tickets
        .filter((ticket) => ticket.eventId === eventId && ticket.performanceDateId === performanceId)
        .map((ticket) => {
          const hold = activeByTicket.get(ticket.id);
          return {
            ticketId: ticket.id,
            zoneId: ticket.zoneId,
            label: ticket.seatLabel,
            price: ticket.faceValue,
            state: ticket.status !== "ON_SALE"
              ? "UNAVAILABLE"
              : hold?.userId === principal.userId
                ? "HELD_BY_YOU"
                : hold
                  ? "HELD"
                  : "SELECTABLE",
            holdExpiresAt: hold?.userId === principal.userId ? hold.expiresAt : null
          };
        })
    };
  }

  function createHold(db, principal, key, body) {
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: `SEAT_HOLD_CREATE:${body.ticketId}`,
      key,
      payload: { queueId: body.queueId, ticketId: body.ticketId, revision: body.revision }
    }, () => {
      const queue = ownedQueue(db, principal, body.queueId);
      if (queue.status !== "READY") throw httpError(409, "BOOKING_QUEUE_INACTIVE", "대기열 세션이 만료되었습니다.");
      if (body.revision !== db.bookingInventoryRevision) {
        throw httpError(409, "INVENTORY_REVISION_MISMATCH", "좌석 상태가 변경되었습니다.", { revision: db.bookingInventoryRevision });
      }
      const ticket = db.tickets.find((item) => item.id === body.ticketId);
      if (!ticket || ticket.eventId !== queue.eventId || ticket.performanceDateId !== queue.performanceId) {
        throw httpError(404, "SEAT_NOT_FOUND", "좌석을 찾을 수 없습니다.");
      }
      if (ticket.status !== "ON_SALE" || db.seatHolds.some((item) => item.ticketId === ticket.id && item.status === "ACTIVE")) {
        throw httpError(409, "SEAT_ALREADY_HELD", "다른 사용자가 선택한 좌석입니다.");
      }
      db.bookingInventoryRevision += 1;
      const at = now();
      const hold = {
        id: id("hold"),
        queueId: queue.id,
        userId: principal.userId,
        ticketId: ticket.id,
        status: "ACTIVE",
        expiresAt: new Date(currentTimeMs() + HOLD_TTL_MS).toISOString(),
        revision: db.bookingInventoryRevision,
        createdAt: at,
        updatedAt: at
      };
      db.seatHolds.push(hold);
      appendLedger(db, principal.userId, "SEAT_HELD", { holdId: hold.id, ticketId: ticket.id });
      return holdView(hold);
    });
  }

  function renewHold(db, principal, holdId, key) {
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: `SEAT_HOLD_RENEW:${holdId}`,
      key,
      payload: { holdId }
    }, () => {
      const hold = ownedHold(db, principal, holdId);
      if (hold.status !== "ACTIVE") throw httpError(409, "HOLD_INACTIVE", "좌석 홀드가 만료되었거나 해제되었습니다.");
      hold.expiresAt = new Date(Math.max(currentTimeMs(), Date.parse(hold.expiresAt)) + HOLD_TTL_MS).toISOString();
      hold.updatedAt = now();
      return holdView(hold);
    });
  }

  function releaseHold(db, principal, holdId, key) {
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: `SEAT_HOLD_RELEASE:${holdId}`,
      key,
      payload: { holdId }
    }, () => {
      const hold = ownedHold(db, principal, holdId);
      if (hold.status === "ACTIVE") {
        hold.status = "RELEASED";
        hold.updatedAt = now();
        db.bookingInventoryRevision += 1;
      }
      return holdView(hold);
    });
  }

  function createDraft(db, principal, key, body) {
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: `RESERVATION_DRAFT_CREATE:${body.holdId}`,
      key,
      payload: { holdId: body.holdId }
    }, () => {
      const hold = ownedHold(db, principal, body.holdId);
      if (hold.status !== "ACTIVE") throw httpError(409, "HOLD_INACTIVE", "좌석 홀드가 만료되었거나 해제되었습니다.");
      const ticket = db.tickets.find((item) => item.id === hold.ticketId);
      const at = now();
      const draft = {
        id: id("draft"),
        userId: principal.userId,
        holdId: hold.id,
        ticketId: hold.ticketId,
        eventId: ticket.eventId,
        performanceId: ticket.performanceDateId,
        seat: { zoneId: ticket.zoneId, label: ticket.seatLabel },
        amount: ticket.faceValue,
        status: "AWAITING_PAYMENT",
        expiresAt: hold.expiresAt,
        createdAt: at,
        updatedAt: at
      };
      db.reservationDrafts.push(draft);
      appendLedger(db, principal.userId, "RESERVATION_DRAFT_CREATED", { draftId: draft.id, holdId: hold.id });
      return draftView(draft);
    });
  }

  function draftView(draft) {
    const safe = { ...draft };
    delete safe.userId;
    return safe;
  }

  function draft(db, principal, draftId) {
    expire(db);
    const item = db.reservationDrafts.find((entry) => entry.id === draftId && entry.userId === principal.userId);
    if (!item) throw httpError(404, "RESERVATION_DRAFT_NOT_FOUND", "예약 초안을 찾을 수 없습니다.");
    const hold = db.seatHolds.find((entry) => entry.id === item.holdId);
    if (item.status === "AWAITING_PAYMENT" && hold?.status !== "ACTIVE") item.status = "EXPIRED";
    return draftView(item);
  }

  return { createDraft, createHold, draft, joinQueue, queue, releaseHold, renewHold, seats };
}
