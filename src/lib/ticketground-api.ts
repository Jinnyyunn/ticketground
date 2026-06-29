export const DEMO_USER_ID = "user_fan_a";
export const DEMO_BUYER_ID = "user_fan_b";
export const DEMO_SCALPER_ID = "user_scalper";
export const DEMO_EVENT_ID = "event_kpop_001";

export class TicketgroundApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "TicketgroundApiError";
    this.code = code;
    this.status = status;
  }
}

type ApiEnvelope<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: { readonly code?: string; readonly message?: string; readonly detail?: unknown } };

export type ApiEvent = {
  readonly id: string;
  readonly title: string;
  readonly venue: string;
  readonly venueId: string;
  readonly category: string;
  readonly saleState: string;
  readonly sale: {
    readonly label: string;
    readonly state: string;
    readonly bookable: boolean;
  };
};

export type ApiTicket = {
  readonly id: string;
  readonly eventId: string;
  readonly performanceDateId: string;
  readonly zoneId: string;
  readonly seatLabel: string;
  readonly status: string;
  readonly available: boolean;
  readonly faceValue: number;
  readonly minPrice: number;
  readonly maxPrice: number;
  readonly transferCount: number;
  readonly maxTransferCount: number;
  readonly issuedAt: string | null;
};

export type ApiResalePool = {
  readonly id: string;
  readonly eventId: string;
  readonly performanceDateId: string;
  readonly zoneId: string;
  readonly ticketId: string;
  readonly price: number;
  readonly buyerFee: number | null;
  readonly buyerTotal: number | null;
  readonly sellerSettlement: number | null;
  readonly buyerCount: number;
  readonly status: string;
  readonly createdAt: string;
  readonly matchedAt: string | null;
};

export type ApiState = {
  readonly events: readonly ApiEvent[];
  readonly tickets: readonly ApiTicket[];
  readonly resalePools: readonly ApiResalePool[];
  readonly backendSummary: {
    readonly events: number;
    readonly tickets: number;
  };
  readonly ledger: {
    readonly verified: boolean;
    readonly totalEntries: number;
  };
};

export type ApiSeat = {
  readonly id: string;
  readonly label: string;
  readonly displayCode: string;
  readonly zoneId: string;
  readonly zoneName: string;
  readonly price: number;
  readonly status: string;
  readonly available: boolean;
};

export type ApiSeatMap = {
  readonly event: {
    readonly id: string;
    readonly title: string;
    readonly venueId: string;
    readonly venue: string;
  };
  readonly map: {
    readonly title: string;
    readonly image: string;
    readonly description: string;
  };
  readonly zones: readonly {
    readonly id: string;
    readonly name: string;
    readonly price: number;
    readonly available: number;
  }[];
  readonly seats: readonly ApiSeat[];
};

export type ApiPurchaseResult = {
  readonly ticket: ApiTicket;
  readonly event: {
    readonly id: string;
    readonly title: string;
    readonly venue: string;
  };
  readonly payment: {
    readonly method: string;
    readonly label: string;
    readonly status: string;
  };
  readonly admission: {
    readonly status: string;
    readonly activeAt: string;
    readonly activationChannel: string;
  };
};

export type ApiResaleResult = {
  readonly pool: ApiResalePool;
  readonly ticket: ApiTicket;
  readonly fee: number;
  readonly buyerTotal: number;
  readonly sellerSettlement: number;
  readonly payment: {
    readonly method: string;
    readonly label: string;
    readonly status: string;
  };
};

export type ApiVirtualQr = {
  readonly type: string;
  readonly ticketId: string;
  readonly issuedAt: string;
  readonly eventTitle: string;
  readonly seatLabel: string;
  readonly performanceStartsAt: string;
  readonly realQrAvailableAt: string;
  readonly admissionChannel: string;
};

export type ApiSession = {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly trustScore: number;
};

export type ApiWatchlistItem = {
  readonly id: string;
  readonly eventId: string;
  readonly channels: readonly string[];
  readonly calendarEnabled: boolean;
  readonly notificationEnabled: boolean;
  readonly notificationJobs: readonly {
    readonly id: string;
    readonly type: string;
    readonly title: string;
    readonly status: string;
    readonly scheduledAt: string;
  }[];
};

export type ApiSupportThread = {
  readonly id: string;
  readonly userId: string;
  readonly subject: string;
  readonly status: "OPEN" | "ANSWERED" | "CLOSED";
  readonly updatedAt: string;
  readonly messages: readonly {
    readonly id: string;
    readonly actorId: string;
    readonly role: "CUSTOMER" | "ADMIN";
    readonly body: string;
    readonly at: string;
  }[];
};

export type ApiDirectTransferResult = {
  readonly blocked: boolean;
  readonly user: {
    readonly id: string;
    readonly name: string;
  };
  readonly ticket: ApiTicket;
};

async function readApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.ok) {
    const message = payload.ok ? "요청을 처리하지 못했습니다." : payload.error.message ?? "요청을 처리하지 못했습니다.";
    const code = payload.ok ? "HTTP_ERROR" : payload.error.code ?? "API_ERROR";
    throw new TicketgroundApiError(message, code, response.status);
  }
  return payload.data;
}

function post<T>(path: string, body: Record<string, unknown>) {
  return readApi<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getState() {
  return readApi<ApiState>("/api/state");
}

export function getSeatMap(eventId = DEMO_EVENT_ID) {
  return readApi<ApiSeatMap>(`/api/seat-map?eventId=${encodeURIComponent(eventId)}`);
}

export function buyTicket(ticketId: string, userId = DEMO_USER_ID) {
  return post<ApiPurchaseResult>("/api/tickets/buy", {
    userId,
    ticketId,
    paymentMethod: "CREDIT_CARD",
  });
}

export function getUserTickets(userId = DEMO_USER_ID) {
  return readApi<readonly ApiTicket[]>(`/api/users/${encodeURIComponent(userId)}/tickets`);
}

export function listResale(ticketId: string, price: number, sellerId = DEMO_USER_ID) {
  return post<ApiResalePool>("/api/resale/list", {
    sellerId,
    ticketId,
    price,
  });
}

export function joinResale(poolId: string, buyerId = DEMO_SCALPER_ID) {
  return post<ApiResalePool>("/api/resale/join", {
    buyerId,
    poolId,
  });
}

export function drawResale(poolId: string) {
  return post<ApiResaleResult>("/api/resale/draw", {
    poolId,
    paymentMethod: "CREDIT_CARD",
  });
}

export function purchaseResale(poolId: string, buyerId = DEMO_BUYER_ID) {
  return post<ApiResaleResult>("/api/resale/purchase", {
    buyerId,
    poolId,
    paymentMethod: "CREDIT_CARD",
  });
}

export function getVirtualQr(ticketId: string, userId = DEMO_USER_ID) {
  return post<ApiVirtualQr>("/api/tickets/virtual-qr", {
    userId,
    ticketId,
  });
}

export function directTransferAttempt(ticketId: string, targetUserId = DEMO_BUYER_ID) {
  return post<ApiDirectTransferResult>("/api/security/direct-transfer-attempt", {
    actorId: DEMO_USER_ID,
    ticketId,
    targetUserId,
    offeredPrice: 2000,
  });
}

export function getSession(userId = DEMO_USER_ID) {
  return readApi<ApiSession>(`/api/users/${encodeURIComponent(userId)}/session`);
}

export function updateProfile(name: string, userId = DEMO_USER_ID) {
  return post<ApiSession>(`/api/users/${encodeURIComponent(userId)}/profile`, {
    name,
  });
}

export function getWatchlist(userId = DEMO_USER_ID) {
  return readApi<readonly ApiWatchlistItem[]>(`/api/users/${encodeURIComponent(userId)}/watchlist`);
}

export function upsertWatchlist(eventId: string, channels: readonly string[], userId = DEMO_USER_ID) {
  return post<{ readonly watchlist: ApiWatchlistItem; readonly notificationJobs: ApiWatchlistItem["notificationJobs"] }>("/api/watchlist", {
    userId,
    eventId,
    channels,
    calendarEnabled: true,
    notificationEnabled: true,
  });
}

export function notifyWatchlist(eventId: string, userId = DEMO_USER_ID) {
  return post<{ readonly notificationJob: { readonly id: string; readonly status: string } }>("/api/watchlist/notify", {
    userId,
    eventId,
    type: "STATUS_CHANGE",
    dispatchNow: true,
  });
}

export function getSupportThreads(userId = DEMO_USER_ID) {
  return readApi<readonly ApiSupportThread[]>(`/api/support/threads?userId=${encodeURIComponent(userId)}`);
}

export function createSupportThread(message: string, subject = "1:1 실시간 문의", userId = DEMO_USER_ID) {
  return post<ApiSupportThread>("/api/support/threads", {
    userId,
    subject,
    message,
  });
}

export function addSupportMessage(threadId: string, message: string, actorId = DEMO_USER_ID) {
  return post<ApiSupportThread>("/api/support/messages", {
    threadId,
    actorId,
    message,
  });
}
