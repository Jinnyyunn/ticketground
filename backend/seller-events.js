// Corporate seller self-service catalog management: an approved seller
// account can create/edit only the events it owns (event.sellerAccountId).
// Reuses the admin catalog validation/ticket-minting path as-is
// (createEventDraft/updateEventSale from backend/admin.js) rather than
// duplicating it - the seller-facing routes just constrain which payload
// fields are forwarded and force the review gate below.
export function createSellerEventsBackend({ appendLedger, createEventDraft, httpError, now, updateEventSale }) {
  function eventTicketCounts(db, eventId) {
    const tickets = db.tickets.filter((ticket) => ticket.eventId === eventId);
    return {
      ticketCount: tickets.length,
      soldCount: tickets.filter((ticket) => ticket.status !== "ON_SALE").length
    };
  }

  function pricesFromZones(event) {
    return (event.zones || []).map((zone) => ({
      grade: zone.name.replace(/석$/, ""),
      seat: zone.name,
      price: zone.faceValue,
      seatCount: zone.seatCount
    }));
  }

  // Full editable shape for the seller's own dashboard - a seller has few
  // enough events that there's no separate summary/detail split like the
  // admin console's paginated event picker.
  function sellerEventDetailDto(db, event) {
    const counts = eventTicketCounts(db, event.id);
    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      shortTitle: event.shortTitle || "",
      category: event.category,
      venueId: event.venueId,
      venue: event.venue,
      date: event.date,
      schedules: event.schedules || [],
      prices: pricesFromZones(event),
      casts: event.casts || [],
      notices: event.notices || [],
      summary: event.summary || "",
      publishStatus: event.publishStatus,
      ticketCount: counts.ticketCount,
      soldCount: counts.soldCount,
      updatedAt: event.updatedAt || event.createdAt || null
    };
  }

  // Lightweight shape for the admin review queue - no need for the full
  // editable content there, just enough to identify and preview the event.
  function sellerEventSummaryDto(db, event) {
    const counts = eventTicketCounts(db, event.id);
    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      category: event.category,
      venue: event.venue,
      date: event.date,
      publishStatus: event.publishStatus,
      sellerAccountId: event.sellerAccountId,
      ticketCount: counts.ticketCount,
      soldCount: counts.soldCount
    };
  }

  function findOwnedEvent(db, eventId, sellerId) {
    const event = db.events.find((item) => item.id === eventId);
    // Treat "exists but belongs to someone else" the same as "doesn't
    // exist" - a seller should never learn another company's event ids.
    if (!event || event.sellerAccountId !== sellerId) {
      throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
    }
    return event;
  }

  function listSellerEvents(db, sellerId) {
    return db.events
      .filter((event) => event.sellerAccountId === sellerId)
      .map((event) => sellerEventDetailDto(db, event));
  }

  function sanitizedContentPayload(payload) {
    // Only the catalog-content fields a seller may set. Admin-only knobs
    // (pinnedRank, badge, saleNote, saleState) are deliberately left out so
    // normalizeAdminEventInput/normalizeContent fall back to their own
    // defaults instead of trusting seller input for anything promotional
    // or operational. Keys are only copied over when the caller actually
    // provided them - normalizeContent's optional fields (casts, notices,
    // summary, shortTitle...) use Object.hasOwn to decide whether a field
    // was intentionally set, so a key present with value undefined is
    // treated as "clear this field", not "leave it alone".
    const allowedKeys = ["title", "shortTitle", "category", "startsAt", "venueId", "schedules", "prices", "imageDataUrl", "casts", "notices", "summary"];
    const sanitized = {};
    for (const key of allowedKeys) {
      if (Object.hasOwn(payload, key)) sanitized[key] = payload[key];
    }
    return sanitized;
  }

  async function createSellerEvent(db, payload, seller) {
    const result = await createEventDraft(db, { ...sanitizedContentPayload(payload), saleState: "OPEN_SOON" });
    const event = db.events.find((item) => item.id === result.event.id);
    event.sellerAccountId = seller.id;
    event.publishStatus = "PENDING_ADMIN_REVIEW";
    event.updatedAt = now();
    appendLedger(db, seller.id, "SELLER_EVENT_CREATED", { eventId: event.id, sellerAccountId: seller.id });
    return sellerEventDetailDto(db, event);
  }

  async function updateSellerEvent(db, payload, seller) {
    const event = findOwnedEvent(db, payload.eventId, seller.id);
    await updateEventSale(db, { eventId: event.id, ...sanitizedContentPayload(payload) });
    // Any seller edit - even to an already-published listing - re-enters
    // the review queue before it's visible to the public again.
    event.publishStatus = "PENDING_ADMIN_REVIEW";
    event.updatedAt = now();
    appendLedger(db, seller.id, "SELLER_EVENT_UPDATED", { eventId: event.id, sellerAccountId: seller.id });
    return sellerEventDetailDto(db, event);
  }

  function listPendingSellerEvents(db) {
    return db.events
      .filter((event) => event.sellerAccountId && event.publishStatus === "PENDING_ADMIN_REVIEW")
      .map((event) => sellerEventSummaryDto(db, event));
  }

  function reviewSellerEvent(db, { eventId, action, reviewNote }, actor) {
    const event = db.events.find((item) => item.id === eventId);
    if (!event || !event.sellerAccountId) {
      throw httpError(404, "EVENT_NOT_FOUND", "공연을 찾을 수 없습니다.");
    }
    if (event.publishStatus !== "PENDING_ADMIN_REVIEW") {
      throw httpError(409, "EVENT_NOT_PENDING_REVIEW", "검토 대기 상태의 공연이 아닙니다.");
    }
    if (action === "publish") {
      event.publishStatus = "PUBLISHED";
      appendLedger(db, actor?.id || "ADMIN", "SELLER_EVENT_PUBLISHED", { eventId: event.id, sellerAccountId: event.sellerAccountId });
    } else {
      const note = String(reviewNote || "").trim();
      if (!note) throw httpError(400, "MISSING_FIELD", "반려 사유를 입력해주세요.");
      event.publishStatus = "DRAFT";
      appendLedger(db, actor?.id || "ADMIN", "SELLER_EVENT_REJECTED", { eventId: event.id, sellerAccountId: event.sellerAccountId, reviewNote: note });
    }
    event.updatedAt = now();
    return sellerEventSummaryDto(db, event);
  }

  return {
    createSellerEvent,
    listPendingSellerEvents,
    listSellerEvents,
    reviewSellerEvent,
    updateSellerEvent
  };
}
