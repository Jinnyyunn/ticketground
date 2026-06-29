import {
  apiDirectTransferResultSchema,
  apiPurchaseResultSchema,
  apiResalePoolSchema,
  apiResaleResultSchema,
  apiSeatMapSchema,
  apiSessionSchema,
  apiStateSchema,
  apiSupportThreadSchema,
  apiTicketSchema,
  apiVirtualQrSchema,
  apiWatchlistItemSchema,
  notifyWatchlistResultSchema,
  upsertWatchlistResultSchema,
} from "./ticketground-api-schemas";
import { z, type ZodType } from "zod";

export const DEMO_USER_ID = "user_fan_a";
export const DEMO_BUYER_ID = "user_fan_b";
export const DEMO_SCALPER_ID = "user_scalper";
export const DEMO_EVENT_ID = "event_kpop_001";

export type {
  ApiDirectTransferResult,
  ApiEvent,
  ApiPurchaseResult,
  ApiResalePool,
  ApiResaleResult,
  ApiSeat,
  ApiSeatMap,
  ApiSession,
  ApiState,
  ApiSupportThread,
  ApiTicket,
  ApiVirtualQr,
  ApiWatchlistItem,
} from "./ticketground-api-types";

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

function apiEnvelopeSchema<T>(dataSchema: ZodType<T>) {
  return z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), data: dataSchema }),
    z.object({
      ok: z.literal(false),
      error: z.object({
        code: z.string().optional(),
        message: z.string().optional(),
        detail: z.unknown().optional(),
      }),
    }),
  ]) satisfies ZodType<ApiEnvelope<T>>;
}

async function readApi<T>(path: string, dataSchema: ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = apiEnvelopeSchema(dataSchema).parse(await response.json());
  if (!response.ok || !payload.ok) {
    const message = payload.ok ? "요청을 처리하지 못했습니다." : payload.error.message ?? "요청을 처리하지 못했습니다.";
    const code = payload.ok ? "HTTP_ERROR" : payload.error.code ?? "API_ERROR";
    throw new TicketgroundApiError(message, code, response.status);
  }
  return payload.data;
}

function post<T>(path: string, dataSchema: ZodType<T>, body: Record<string, unknown>) {
  return readApi(path, dataSchema, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getState() {
  return readApi("/api/state", apiStateSchema);
}

export function getSeatMap(eventId = DEMO_EVENT_ID) {
  return readApi(`/api/seat-map?eventId=${encodeURIComponent(eventId)}`, apiSeatMapSchema);
}

export function buyTicket(ticketId: string, userId = DEMO_USER_ID) {
  return post("/api/tickets/buy", apiPurchaseResultSchema, {
    userId,
    ticketId,
    paymentMethod: "CREDIT_CARD",
  });
}

export function getUserTickets(userId = DEMO_USER_ID) {
  return readApi(`/api/users/${encodeURIComponent(userId)}/tickets`, z.array(apiTicketSchema));
}

export function listResale(ticketId: string, price: number, sellerId = DEMO_USER_ID) {
  return post("/api/resale/list", apiResalePoolSchema, {
    sellerId,
    ticketId,
    price,
  });
}

export function joinResale(poolId: string, buyerId = DEMO_SCALPER_ID) {
  return post("/api/resale/join", apiResalePoolSchema, {
    buyerId,
    poolId,
  });
}

export function drawResale(poolId: string) {
  return post("/api/resale/draw", apiResaleResultSchema, {
    poolId,
    paymentMethod: "CREDIT_CARD",
  });
}

export function purchaseResale(poolId: string, buyerId = DEMO_BUYER_ID) {
  return post("/api/resale/purchase", apiResaleResultSchema, {
    buyerId,
    poolId,
    paymentMethod: "CREDIT_CARD",
  });
}

export function getVirtualQr(ticketId: string, userId = DEMO_USER_ID) {
  return post("/api/tickets/virtual-qr", apiVirtualQrSchema, {
    userId,
    ticketId,
  });
}

export function directTransferAttempt(ticketId: string, targetUserId = DEMO_BUYER_ID) {
  return post("/api/security/direct-transfer-attempt", apiDirectTransferResultSchema, {
    actorId: DEMO_USER_ID,
    ticketId,
    targetUserId,
    offeredPrice: 2000,
  });
}

export function getSession(userId = DEMO_USER_ID) {
  return readApi(`/api/users/${encodeURIComponent(userId)}/session`, apiSessionSchema);
}

export function updateProfile(name: string, userId = DEMO_USER_ID) {
  return post(`/api/users/${encodeURIComponent(userId)}/profile`, apiSessionSchema, {
    name,
  });
}

export function getWatchlist(userId = DEMO_USER_ID) {
  return readApi(`/api/users/${encodeURIComponent(userId)}/watchlist`, z.array(apiWatchlistItemSchema));
}

export function upsertWatchlist(eventId: string, channels: readonly string[], userId = DEMO_USER_ID) {
  return post("/api/watchlist", upsertWatchlistResultSchema, {
    userId,
    eventId,
    channels,
    calendarEnabled: true,
    notificationEnabled: true,
  });
}

export function notifyWatchlist(eventId: string, userId = DEMO_USER_ID) {
  return post("/api/watchlist/notify", notifyWatchlistResultSchema, {
    userId,
    eventId,
    type: "STATUS_CHANGE",
    dispatchNow: true,
  });
}

export function getSupportThreads(userId = DEMO_USER_ID) {
  return readApi(`/api/support/threads?userId=${encodeURIComponent(userId)}`, z.array(apiSupportThreadSchema));
}

export function createSupportThread(message: string, subject = "1:1 실시간 문의", userId = DEMO_USER_ID) {
  return post("/api/support/threads", apiSupportThreadSchema, {
    userId,
    subject,
    message,
  });
}

export function addSupportMessage(threadId: string, message: string, actorId = DEMO_USER_ID) {
  return post("/api/support/messages", apiSupportThreadSchema, {
    threadId,
    actorId,
    message,
  });
}
