// Public and admin response DTOs.
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
    status: payment.status
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

function publicPurchaseResult(result) {
  return {
    ticket: publicTicket(result.ticket),
    event: {
      id: result.event.id,
      title: result.event.title,
      venue: result.event.venue
    },
    performanceDate: result.performanceDate,
    payment: publicPayment(result.payment),
    admission: publicAdmissionState(result.admissionCredential)
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
    price: pool.price,
    buyerFee: pool.buyerFee || null,
    buyerTotal: pool.buyerTotal || null,
    sellerSettlement: pool.sellerSettlement || null,
    status: pool.status,
    createdAt: pool.createdAt,
    matchedAt: pool.matchedAt || null
  };
}

function publicState(db) {
  return {
    events: db.events.map((event) => ({
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
      verified: verifyLedger(db).ok
    }
  };
}

  return {
    adminTicket,
    publicDirectTransferResult,
    publicPayment,
    publicPurchaseResult,
    publicResaleDrawResult,
    publicResalePool,
    publicState,
    publicTicket,
    publicUser
  };
}
