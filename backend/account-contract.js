import { publicSessionUser } from "./session-user.js";

export function createAccountContract({ appendLedger, executeIdempotent, findUser, httpError, now }) {
  function profile(db, principal) {
    return publicSessionUser(findUser(db, principal.userId));
  }

  function updateProfile(db, principal, key, body) {
    if (Object.keys(body).length !== 1 || !Object.hasOwn(body, "name")) {
      throw httpError(422, "PROFILE_FIELDS_INVALID", "이름만 수정할 수 있습니다.");
    }
    const name = String(body.name || "").trim();
    const length = [...name].length;
    if (length < 2 || length > 40 || /[\u0000-\u001f\u007f]/u.test(name)) {
      throw httpError(422, "PROFILE_NAME_INVALID", "이름은 2자 이상 40자 이하로 입력해주세요.");
    }
    return executeIdempotent(db, {
      actorId: principal.userId,
      operation: "PROFILE_UPDATE",
      key,
      payload: { name }
    }, () => {
      const user = findUser(db, principal.userId);
      user.name = name;
      user.profileConfirmedAt = now();
      appendLedger(db, principal.userId, "PROFILE_UPDATED", { fields: ["name"] });
      return publicSessionUser(user);
    });
  }

  function reservation(db, ticket) {
    const event = db.events.find((item) => item.id === ticket.eventId);
    const performance = event?.performanceDates?.find((item) => item.id === ticket.performanceDateId);
    return {
      ticketId: ticket.id,
      ticketStatus: ticket.status,
      event: {
        id: event?.id || ticket.eventId,
        title: event?.title || "공연 정보 확인 중",
        venue: event?.venue || null
      },
      performance: {
        id: ticket.performanceDateId,
        label: performance?.label || null,
        startsAt: performance?.startsAt || null
      },
      seat: {
        zoneId: ticket.zoneId,
        label: ticket.seatLabel
      },
      faceValue: ticket.faceValue,
      issuedAt: ticket.issuedAt || null
    };
  }

  function reservations(db, principal) {
    findUser(db, principal.userId);
    return db.tickets
      .filter((ticket) => ticket.ownerId === principal.userId)
      .map((ticket) => reservation(db, ticket))
      .sort((a, b) => String(b.issuedAt || "").localeCompare(String(a.issuedAt || "")));
  }

  function reservationDetail(db, principal, ticketId) {
    const item = reservations(db, principal).find((entry) => entry.ticketId === ticketId);
    if (!item) throw httpError(404, "RESERVATION_NOT_FOUND", "예매내역을 찾을 수 없습니다.");
    return item;
  }

  return { profile, reservationDetail, reservations, updateProfile };
}
