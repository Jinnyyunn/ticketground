// 대기열 진입, 좌석 홀드, 예약 초안(결제 전 상태) 관리.
// 결제 확정(#103)은 이 모듈의 범위 밖이며, reservationDrafts.status는
// PENDING_PAYMENT 까지만 다루고 CONFIRMED 전환은 결제 연동에서 담당한다.
export function createBookingHoldsBackend({
  currentTimeMs,
  eventZone,
  findUser,
  hash,
  httpError,
  id,
  isEventBookable,
  now
}) {
  const QUEUE_ADMIT_CONCURRENCY = 50;
  const QUEUE_ADMISSION_WINDOW_MS = 10 * 60 * 1000;
  const HOLD_TTL_MS = 5 * 60 * 1000;
  const HOLD_MAX_EXTENSIONS = 1;
  const HOLD_EXTENSION_MS = 5 * 60 * 1000;
  const DRAFT_TTL_MS = 10 * 60 * 1000;
  const MAX_HOLD_SEATS = 4;
  const SERVICE_FEE_PER_SEAT = 2000;

  function futureIso(ms) {
    return new Date(currentTimeMs() + ms).toISOString();
  }

  function isPast(iso) {
    return Boolean(iso) && Date.parse(iso) <= currentTimeMs();
  }

  function bookingIdempotency(kind, userId, key, payload) {
    return {
      keyDigest: hash(`booking:${kind}:${userId}:${key}`),
      requestDigest: hash(`booking:${kind}:payload:${JSON.stringify(payload)}`)
    };
  }

  // ---------------------------------------------------------------- queue --

  function reconcileQueue(db, performanceDateId) {
    const entries = db.queueEntries.filter((entry) => entry.performanceDateId === performanceDateId);
    for (const entry of entries) {
      if (entry.status === "ADMITTED" && isPast(entry.admissionExpiresAt)) {
        entry.status = "EXPIRED";
      }
    }
    const admittedCount = entries.filter((entry) => entry.status === "ADMITTED").length;
    let freeSlots = QUEUE_ADMIT_CONCURRENCY - admittedCount;
    if (freeSlots > 0) {
      const waiting = entries
        .filter((entry) => entry.status === "WAITING")
        .sort((a, b) => Date.parse(a.enteredAt) - Date.parse(b.enteredAt));
      for (const entry of waiting) {
        if (freeSlots <= 0) break;
        entry.status = "ADMITTED";
        entry.admittedAt = now();
        entry.admissionExpiresAt = futureIso(QUEUE_ADMISSION_WINDOW_MS);
        freeSlots -= 1;
      }
    }
    return entries;
  }

  function queuePosition(entries, entry) {
    if (entry.status !== "WAITING") return 0;
    return entries.filter((item) =>
      item.status === "WAITING" && Date.parse(item.enteredAt) < Date.parse(entry.enteredAt)
    ).length + 1;
  }

  function publicQueueEntry(entries, entry) {
    return {
      id: entry.id,
      performanceDateId: entry.performanceDateId,
      status: entry.status,
      position: queuePosition(entries, entry),
      admittedAt: entry.admittedAt,
      admissionExpiresAt: entry.admissionExpiresAt,
      enteredAt: entry.enteredAt
    };
  }

  function enterQueue(db, { userId, performanceDateId }) {
    const user = findUser(db, userId);
    if (!performanceDateId) throw httpError(400, "MISSING_FIELD", "performanceDateId 값이 필요합니다.");

    const reusable = db.queueEntries.find((entry) =>
      entry.userId === user.id
      && entry.performanceDateId === performanceDateId
      && ["WAITING", "ADMITTED"].includes(entry.status)
    );
    if (!reusable) {
      db.queueEntries.push({
        id: id("queue"),
        userId: user.id,
        performanceDateId,
        status: "WAITING",
        admittedAt: null,
        admissionExpiresAt: null,
        enteredAt: now()
      });
    }
    const entries = reconcileQueue(db, performanceDateId);
    const entry = reusable
      ? entries.find((item) => item.id === reusable.id)
      : entries[entries.length - 1];
    return publicQueueEntry(entries, entry);
  }

  function requireOwnQueueEntry(db, userId, entryId) {
    const entry = db.queueEntries.find((item) => item.id === entryId);
    if (!entry) throw httpError(404, "QUEUE_ENTRY_NOT_FOUND", "대기열 정보를 찾을 수 없습니다.");
    if (entry.userId !== userId) throw httpError(403, "NOT_OWNER", "본인의 대기열 정보만 조회할 수 있습니다.");
    return entry;
  }

  function getQueueEntry(db, { userId, entryId }) {
    const entry = requireOwnQueueEntry(db, userId, entryId);
    const entries = reconcileQueue(db, entry.performanceDateId);
    return publicQueueEntry(entries, entries.find((item) => item.id === entryId));
  }

  function leaveQueue(db, { userId, entryId }) {
    const entry = requireOwnQueueEntry(db, userId, entryId);
    if (["WAITING", "ADMITTED"].includes(entry.status)) entry.status = "LEFT";
    reconcileQueue(db, entry.performanceDateId);
    return { id: entry.id, status: entry.status };
  }

  // ----------------------------------------------------------- seat holds --

  function releaseHeldTickets(db, hold) {
    for (const ticketId of hold.ticketIds) {
      const ticket = db.tickets.find((item) => item.id === ticketId);
      if (ticket && ticket.status === "HELD" && ticket.heldBy === hold.id) {
        ticket.status = "ON_SALE";
        ticket.heldBy = null;
        ticket.holdExpiresAt = null;
      }
    }
  }

  function reconcileHold(db, hold) {
    if (hold.status === "ACTIVE" && isPast(hold.expiresAt)) {
      hold.status = "EXPIRED";
      hold.updatedAt = now();
      releaseHeldTickets(db, hold);
    }
    return hold;
  }

  function publicSeatHold(hold) {
    return {
      id: hold.id,
      status: hold.status,
      performanceDateId: hold.performanceDateId,
      ticketIds: hold.ticketIds,
      expiresAt: hold.expiresAt,
      extensionsUsed: hold.extensionsUsed
    };
  }

  function createSeatHold(db, { userId, performanceDateId, ticketIds, idempotencyKey }) {
    const user = findUser(db, userId);
    if (!performanceDateId) throw httpError(400, "MISSING_FIELD", "performanceDateId 값이 필요합니다.");
    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      throw httpError(400, "MISSING_FIELD", "ticketIds 값이 필요합니다.");
    }
    if (ticketIds.length > MAX_HOLD_SEATS) {
      throw httpError(422, "TOO_MANY_SEATS", `한 번에 홀드할 수 있는 좌석은 최대 ${MAX_HOLD_SEATS}석입니다.`);
    }
    const uniqueTicketIds = [...new Set(ticketIds)];
    if (uniqueTicketIds.length !== ticketIds.length) {
      throw httpError(422, "DUPLICATE_SEAT", "같은 좌석을 중복해서 선택할 수 없습니다.");
    }

    const idempotency = idempotencyKey
      ? bookingIdempotency("hold", user.id, idempotencyKey, {
          performanceDateId,
          ticketIds: [...uniqueTicketIds].sort()
        })
      : null;
    if (idempotency) {
      const existing = db.seatHolds.find((item) => item.idempotency?.keyDigest === idempotency.keyDigest);
      if (existing) {
        if (existing.idempotency.requestDigest !== idempotency.requestDigest) {
          throw httpError(409, "IDEMPOTENCY_CONFLICT", "같은 재시도 키에 다른 좌석 홀드 요청이 전달되었습니다.");
        }
        return publicSeatHold(reconcileHold(db, existing));
      }
    }

    const tickets = uniqueTicketIds.map((ticketId) => {
      const ticket = db.tickets.find((item) => item.id === ticketId);
      if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.", { ticketId });
      if (ticket.performanceDateId !== performanceDateId) {
        throw httpError(422, "SEAT_PERFORMANCE_MISMATCH", "선택한 회차와 좌석이 일치하지 않습니다.", { ticketId });
      }
      return ticket;
    });

    for (const activeHold of db.seatHolds.filter((item) => item.status === "ACTIVE")) reconcileHold(db, activeHold);

    for (const ticket of tickets) {
      if (ticket.status !== "ON_SALE") {
        throw httpError(409, "SEAT_ALREADY_HELD", "이미 다른 사용자가 선택 중이거나 판매된 좌석입니다.", { ticketId: ticket.id });
      }
    }
    const { event } = eventZone(db, tickets[0].eventId, tickets[0].zoneId);
    if (!isEventBookable(event)) {
      throw httpError(409, "EVENT_NOT_ON_SALE", "예매 가능한 공연이 아닙니다.");
    }

    const hold = {
      id: id("hold"),
      userId: user.id,
      performanceDateId,
      ticketIds: tickets.map((ticket) => ticket.id),
      status: "ACTIVE",
      expiresAt: futureIso(HOLD_TTL_MS),
      extensionsUsed: 0,
      ...(idempotency ? { idempotency } : {}),
      createdAt: now(),
      updatedAt: now()
    };
    for (const ticket of tickets) {
      ticket.status = "HELD";
      ticket.heldBy = hold.id;
      ticket.holdExpiresAt = hold.expiresAt;
    }
    db.seatHolds.push(hold);
    return publicSeatHold(hold);
  }

  function requireOwnHold(db, userId, holdId) {
    const hold = db.seatHolds.find((item) => item.id === holdId);
    if (!hold) throw httpError(404, "HOLD_NOT_FOUND", "좌석 홀드를 찾을 수 없습니다.");
    if (hold.userId !== userId) throw httpError(403, "NOT_OWNER", "본인의 좌석 홀드만 조작할 수 있습니다.");
    return reconcileHold(db, hold);
  }

  function getSeatHold(db, { userId, holdId }) {
    return publicSeatHold(requireOwnHold(db, userId, holdId));
  }

  function extendSeatHold(db, { userId, holdId }) {
    const hold = requireOwnHold(db, userId, holdId);
    if (hold.status !== "ACTIVE") throw httpError(409, "HOLD_NOT_ACTIVE", "만료되었거나 종료된 홀드는 연장할 수 없습니다.");
    if (hold.extensionsUsed >= HOLD_MAX_EXTENSIONS) {
      throw httpError(409, "HOLD_EXTENSION_LIMIT", "좌석 홀드 연장 횟수를 초과했습니다.");
    }
    hold.expiresAt = futureIso(HOLD_EXTENSION_MS);
    hold.extensionsUsed += 1;
    hold.updatedAt = now();
    for (const ticketId of hold.ticketIds) {
      const ticket = db.tickets.find((item) => item.id === ticketId);
      if (ticket) ticket.holdExpiresAt = hold.expiresAt;
    }
    return publicSeatHold(hold);
  }

  function releaseSeatHold(db, { userId, holdId }) {
    const hold = requireOwnHold(db, userId, holdId);
    if (hold.status === "ACTIVE") {
      hold.status = "RELEASED";
      hold.updatedAt = now();
      releaseHeldTickets(db, hold);
    }
    return publicSeatHold(hold);
  }

  // ----------------------------------------------------- reservation draft --

  function releaseDraftTickets(db, draft) {
    for (const ticketId of draft.ticketIds) {
      const ticket = db.tickets.find((item) => item.id === ticketId);
      if (ticket && ticket.status === "RESERVED" && ticket.reservationId === draft.id) {
        ticket.status = "ON_SALE";
        ticket.reservationId = null;
        ticket.reservationExpiresAt = null;
      }
    }
  }

  function reconcileDraft(db, draft) {
    if (draft.status === "PENDING_PAYMENT" && isPast(draft.expiresAt)) {
      draft.status = "EXPIRED";
      draft.updatedAt = now();
      releaseDraftTickets(db, draft);
    }
    return draft;
  }

  function publicReservationDraft(draft) {
    return {
      id: draft.id,
      status: draft.status,
      performanceDateId: draft.performanceDateId,
      ticketIds: draft.ticketIds,
      amount: draft.amount,
      expiresAt: draft.expiresAt
    };
  }

  function createReservationDraft(db, { userId, holdId, idempotencyKey }) {
    const user = findUser(db, userId);
    if (!holdId) throw httpError(400, "MISSING_FIELD", "holdId 값이 필요합니다.");

    const idempotency = idempotencyKey
      ? bookingIdempotency("draft", user.id, idempotencyKey, { holdId })
      : null;
    if (idempotency) {
      const existing = db.reservationDrafts.find((item) => item.idempotency?.keyDigest === idempotency.keyDigest);
      if (existing) {
        if (existing.idempotency.requestDigest !== idempotency.requestDigest) {
          throw httpError(409, "IDEMPOTENCY_CONFLICT", "같은 재시도 키에 다른 예약 초안 요청이 전달되었습니다.");
        }
        return publicReservationDraft(reconcileDraft(db, existing));
      }
    }

    const hold = requireOwnHold(db, user.id, holdId);
    if (hold.status !== "ACTIVE") throw httpError(409, "HOLD_NOT_ACTIVE", "만료되었거나 종료된 홀드는 예약으로 전환할 수 없습니다.");

    const tickets = hold.ticketIds.map((ticketId) => {
      const ticket = db.tickets.find((item) => item.id === ticketId);
      if (!ticket) throw httpError(404, "TICKET_NOT_FOUND", "티켓을 찾을 수 없습니다.");
      return ticket;
    });
    const faceValueTotal = tickets.reduce((sum, ticket) => sum + ticket.faceValue, 0);
    const serviceFee = tickets.length * SERVICE_FEE_PER_SEAT;

    hold.status = "CONVERTED";
    hold.updatedAt = now();

    const draft = {
      id: id("resv"),
      userId: user.id,
      holdId: hold.id,
      performanceDateId: hold.performanceDateId,
      ticketIds: hold.ticketIds,
      status: "PENDING_PAYMENT",
      expiresAt: futureIso(DRAFT_TTL_MS),
      amount: { faceValueTotal, serviceFee, total: faceValueTotal + serviceFee },
      ...(idempotency ? { idempotency } : {}),
      createdAt: now(),
      updatedAt: now()
    };
    for (const ticket of tickets) {
      ticket.status = "RESERVED";
      ticket.heldBy = null;
      ticket.holdExpiresAt = null;
      ticket.reservationId = draft.id;
      ticket.reservationExpiresAt = draft.expiresAt;
    }
    db.reservationDrafts.push(draft);
    return publicReservationDraft(draft);
  }

  function requireOwnDraft(db, userId, draftId) {
    const draft = db.reservationDrafts.find((item) => item.id === draftId);
    if (!draft) throw httpError(404, "RESERVATION_DRAFT_NOT_FOUND", "예약 초안을 찾을 수 없습니다.");
    if (draft.userId !== userId) throw httpError(403, "NOT_OWNER", "본인의 예약 초안만 조회할 수 있습니다.");
    return reconcileDraft(db, draft);
  }

  function getReservationDraft(db, { userId, draftId }) {
    return publicReservationDraft(requireOwnDraft(db, userId, draftId));
  }

  function cancelReservationDraft(db, { userId, draftId }) {
    const draft = requireOwnDraft(db, userId, draftId);
    if (draft.status === "PENDING_PAYMENT") {
      draft.status = "CANCELLED";
      draft.updatedAt = now();
      releaseDraftTickets(db, draft);
    }
    return publicReservationDraft(draft);
  }

  return {
    enterQueue,
    getQueueEntry,
    leaveQueue,
    createSeatHold,
    getSeatHold,
    extendSeatHold,
    releaseSeatHold,
    createReservationDraft,
    getReservationDraft,
    cancelReservationDraft
  };
}
