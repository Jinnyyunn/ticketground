// Public and admin response DTOs.
import { defaultCheckoutNotice } from "./admin-event-content.js";

export function createDtoBackend({ saleSummary, verifyLedger }) {
function publicTicket(ticket) {
  return {
    id: ticket.id,
    eventId: ticket.eventId,
    performanceDateId: ticket.performanceDateId,
    zoneId: ticket.zoneId,
    seatLabel: ticket.seatLabel,
    status: ticket.status,
    available: ticket.status === "ON_SALE",
    faceValue: ticket.faceValue,
    minPrice: ticket.minPrice,
    maxPrice: ticket.maxPrice,
    transferCount: ticket.transferCount,
    maxTransferCount: ticket.maxTransferCount,
    issuedAt: ticket.issuedAt,
    virtualQr: ticket.virtualQr ? {
      type: ticket.virtualQr.type,
      issuedAt: ticket.virtualQr.issuedAt
    } : null
  };
}

function adminTicket(ticket) {
  return {
    ...publicTicket(ticket),
    ownerId: ticket.ownerId,
    admissionCredentialId: ticket.admissionCredentialId || null,
    institutional: ticket.institutional === true,
    groupBookingRequestId: ticket.groupBookingRequestId || null,
    currentQr: ticket.currentQr ? {
      type: ticket.currentQr.type,
      issuedAt: ticket.currentQr.issuedAt,
      expiresAt: ticket.currentQr.expiresAt,
      traceCode: ticket.currentQr.traceCode,
      used: Boolean(ticket.currentQr.usedAt)
    } : null
  };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name
  };
}

function publicPayment(payment) {
  return {
    method: payment.key,
    label: payment.label,
    status: payment.status,
    ...(Number.isFinite(payment.amount) ? { amount: payment.amount } : {})
  };
}

function publicAdmissionState(credential) {
  return {
    status: credential.status,
    preparedAt: credential.preparedAt,
    activeAt: credential.activeAt,
    activationChannel: credential.activationChannel,
    riskStatus: credential.riskStatus
  };
}

// Handles both the single-ticket buyPrimary() result shape ({ ticket,
// admissionCredential }) and the multi-ticket buyPrimaryGroup() shape
// ({ tickets, admissionCredentials }) - the plural fields are always present
// so callers that only care about "the tickets in this order" never need to
// branch on which purchase path produced the result. `ticket`/`admission`
// stay as the first item for existing single-ticket callers.
function publicPurchaseResult(result) {
  const tickets = result.tickets ?? [result.ticket];
  const admissionCredentials = result.admissionCredentials ?? [result.admissionCredential];
  return {
    ticket: publicTicket(tickets[0]),
    tickets: tickets.map(publicTicket),
    event: {
      id: result.event.id,
      title: result.event.title,
      venue: result.event.venue
    },
    performanceDate: result.performanceDate,
    payment: publicPayment(result.payment),
    admission: publicAdmissionState(admissionCredentials[0]),
    admissions: admissionCredentials.map(publicAdmissionState)
  };
}

function publicResaleDrawResult(result) {
  return {
    pool: publicResalePool(result.pool),
    ticket: publicTicket(result.ticket),
    fee: result.fee,
    buyerTotal: result.buyerTotal,
    sellerSettlement: result.sellerSettlement,
    payment: publicPayment(result.payment),
    admission: publicAdmissionState(result.admissionCredential)
  };
}

function publicDirectTransferResult(result) {
  return {
    blocked: result.blocked,
    user: publicUser(result.user),
    ticket: publicTicket(result.ticket)
  };
}

function publicResalePool(pool) {
  return {
    id: pool.id,
    eventId: pool.eventId,
    performanceDateId: pool.performanceDateId,
    zoneId: pool.zoneId,
    ticketId: pool.ticketId,
    sellerId: pool.sellerId,
    showSlug: pool.showSlug || null,
    price: pool.price,
    buyerFee: pool.buyerFee || null,
    buyerTotal: pool.buyerTotal || null,
    sellerSettlement: pool.sellerSettlement || null,
    buyerCount: pool.buyers?.length || 0,
    status: pool.status,
    createdAt: pool.createdAt,
    matchedAt: pool.matchedAt || null
  };
}

function soldCountByEventId(db) {
  const counts = new Map();
  for (const ticket of db.tickets) {
    if (ticket.status === "ON_SALE") continue;
    counts.set(ticket.eventId, (counts.get(ticket.eventId) || 0) + 1);
  }
  return counts;
}

function publicCatalog(db, { limit, offset = 0 } = {}) {
  const soldCounts = soldCountByEventId(db);
  // Legacy engine blueprint events (event_kpop_001 etc.) predate the admin
  // catalog schema and never carry a prices[] array - they power internal
  // ticket/resale-engine demos, not the public show listing. Events a
  // corporate seller registered directly stay hidden until an admin
  // reviews and publishes them (see backend/seller-events.js).
  const visibleEvents = db.events.filter((event) => (
    Array.isArray(event.prices) && event.prices.length > 0 && (event.publishStatus ?? "PUBLISHED") === "PUBLISHED"
  ));
  const selectedEvents = limit === undefined ? visibleEvents : visibleEvents.slice(offset, offset + limit);
  return {
    events: selectedEvents.map((event) => ({
      id: event.id,
      slug: event.slug,
      category: event.category,
      title: event.title,
      shortTitle: event.shortTitle,
      venueId: event.venueId,
      venue: event.venue,
      date: event.date,
      dates: event.dates,
      schedules: event.schedules,
      period: event.period,
      runtime: event.runtime,
      ageLimit: event.ageLimit,
      image: event.image,
      badge: event.badge,
      artistSlug: event.artistSlug,
      summary: event.summary,
      casts: event.casts,
      notices: event.notices,
      prices: event.prices,
      zones: (event.zones || []).map(({ id, name, faceValue, seatCount }) => ({ id, name, faceValue, seatCount })),
      saleState: event.saleState,
      saleNote: event.saleNote,
      checkoutNotice: event.checkoutNotice || defaultCheckoutNotice,
      pinnedRank: event.pinnedRank ?? null,
      soldCount: soldCounts.get(event.id) || 0,
      sale: saleSummary(event)
    })),
    venues: db.venues.map(({ id, name, address, map }) => ({
      id,
      name,
      address,
      mapType: map?.type,
      imageUrl: map?.imageUrl || ""
    })),
    ...(limit === undefined ? {} : {
      total: visibleEvents.length,
      nextCursor: offset + selectedEvents.length < visibleEvents.length
        ? String(offset + selectedEvents.length)
        : null,
    }),
  };
}

function publicState(db) {
  return {
    events: db.events.filter((event) => (event.publishStatus ?? "PUBLISHED") === "PUBLISHED").map((event) => ({
      ...event,
      sale: saleSummary(event)
    })),
    venues: db.venues.map(({ id, name, address, map }) => ({
      id,
      name,
      address,
      mapType: map?.type,
      imageUrl: map?.imageUrl || ""
    })),
    users: db.users.map(publicUser),
    tickets: db.tickets.map(publicTicket),
    resalePools: db.resalePools.map(publicResalePool),
    backendSummary: {
      events: db.events.length,
      tickets: db.tickets.length
    },
    ledger: {
      verified: verifyLedger(db).ok,
      totalEntries: db.ledger.length
    }
  };
}

function publicTicketsForUser(db, userId) {
  return db.tickets
    .filter((ticket) => ticket.ownerId === userId)
    .map(publicTicket);
}

function accountTicketsForUser(db, userId) {
  return db.tickets
    .filter((ticket) => ticket.ownerId === userId)
    .map((ticket) => {
      const event = db.events.find((item) => item.id === ticket.eventId);
      const performance = event?.dates?.find((item) => item.id === ticket.performanceDateId);
      const payment = db.paymentTransactions
        .filter((item) => item.ticketId === ticket.id && item.userId === userId)
        .at(-1);
      return {
        ...publicTicket(ticket),
        event: event ? {
          id: event.id,
          title: event.title,
          venue: event.venue,
          performance: performance ? {
            id: performance.id,
            label: performance.label,
            startsAt: performance.startsAt
          } : null
        } : null,
        payment: payment ? {
          amount: payment.amount,
          method: payment.method,
          status: payment.status
        } : null
      };
    });
}

  return {
    accountTicketsForUser,
    adminTicket,
    publicCatalog,
    publicDirectTransferResult,
    publicPayment,
    publicPurchaseResult,
    publicResaleDrawResult,
    publicResalePool,
    publicState,
    publicTicket,
    publicTicketsForUser,
    publicUser
  };
}
