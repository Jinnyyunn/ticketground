import {
  apiBootpayConfigSchema,
  apiBootpayPurchaseResultSchema,
  apiDirectTransferResultSchema,
  apiIdentityStartSchema,
  apiIdentityStatusSchema,
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
import type { ApiIdentityStart, ApiIdentityStatus, ApiResalePool, ApiResaleResult, ApiSession, ApiTicket } from "./ticketground-api-types";
import { currentSessionUserId, DEMO_USER_ID } from "./ticketground-session-storage";
import { z, type ZodType } from "zod";

export const DEMO_BUYER_ID = "user_fan_b";
export const DEMO_SCALPER_ID = "user_scalper";
export const DEMO_EVENT_ID = "event_kpop_001";
export {
  clearSessionUser,
  currentSessionUserId,
  DEMO_AUTH_STORAGE_KEY,
  DEMO_USER_ID,
  hasStoredSessionUser,
  lastLoginProvider,
  rememberLastLoginProvider,
  rememberSessionUser,
  SESSION_USER_CHANGED_EVENT,
  SESSION_USER_STORAGE_KEY,
  SIGNED_OUT_VALUE,
  storedSessionUserId,
} from "./ticketground-session-storage";
export type { LastLoginProvider } from "./ticketground-session-storage";

export type {
  ApiBootpayConfig,
  ApiBootpayPurchaseResult,
  ApiDirectTransferResult,
  ApiEvent,
  ApiIdentityStart,
  ApiIdentityStatus,
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

export type PublicTicket = ApiTicket;
export type PublicResalePool = ApiResalePool;
export type PublicPayment = ApiResaleResult["payment"];
export type PublicSessionUser = ApiSession;
export type ResalePurchaseResult = ApiResaleResult;
export type SocialLoginProvider = "kakao" | "naver";

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
  let rawPayload: unknown;
  try {
    rawPayload = await response.json();
  } catch (error) {
    console.error("Ticketground API returned non-JSON response", { path, status: response.status, error });
    throw new TicketgroundApiError("서버 응답 형식이 일치하지 않습니다.", "INVALID_API_RESPONSE", response.status);
  }

  const parsedPayload = apiEnvelopeSchema(dataSchema).safeParse(rawPayload);
  if (!parsedPayload.success) {
    console.error("Ticketground API response validation failed", {
      path,
      status: response.status,
      issues: parsedPayload.error.issues,
    });
    throw new TicketgroundApiError("서버 응답 형식이 일치하지 않습니다.", "INVALID_API_RESPONSE", response.status);
  }

  const payload = parsedPayload.data;
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

export function getBootpayConfig() {
  return readApi("/api/payments/bootpay/config", apiBootpayConfigSchema);
}

export function buyTicketWithBootpay({
  ticketId,
  userId,
  paymentMethod,
  receiptId,
}: {
  readonly ticketId: string;
  readonly userId: string;
  readonly paymentMethod: string;
  readonly receiptId?: string;
}) {
  return post("/api/payments/bootpay/purchase", apiBootpayPurchaseResultSchema, {
    userId,
    ticketId,
    paymentMethod,
    receiptId,
  });
}

export function getIdentityStatus(userId = currentSessionUserId()) {
  return readApi(`/api/users/${encodeURIComponent(userId)}/identity`, apiIdentityStatusSchema);
}

export function startDanalIdentityVerification({
  phone,
  userId = currentSessionUserId(),
}: {
  readonly phone: string;
  readonly userId?: string;
}): Promise<ApiIdentityStart> {
  return post("/api/identity/portone-danal/start", apiIdentityStartSchema, {
    userId,
    phone,
  });
}

export function confirmDanalIdentityVerification({
  phone,
  userId = currentSessionUserId(),
  identityVerificationId,
}: {
  readonly phone: string;
  readonly userId?: string;
  readonly identityVerificationId: string;
}): Promise<ApiIdentityStatus> {
  return post("/api/identity/portone-danal/confirm", apiIdentityStatusSchema, {
    userId,
    phone,
    identityVerificationId,
  });
}

export function getUserTickets(userId = DEMO_USER_ID) {
  return readApi(`/api/users/${encodeURIComponent(userId)}/tickets`, z.array(apiTicketSchema));
}

export function getDemoSession(userId: string) {
  return getSession(userId);
}

export async function getPublicResalePools() {
  const state = await getState();
  return state.resalePools;
}

export function listTicketForResale({ sellerId, ticketId, price }: { readonly sellerId: string; readonly ticketId: string; readonly price: number }) {
  return listResale(ticketId, price, sellerId);
}

export function purchaseResaleTicket({ buyerId, poolId }: { readonly buyerId: string; readonly poolId: string }) {
  return purchaseResale(poolId, buyerId);
}

export function cancelResaleListing({ poolId, sellerId = currentSessionUserId() }: { readonly poolId: string; readonly sellerId?: string }) {
  return post("/api/resale/cancel", apiResalePoolSchema, {
    sellerId,
    poolId,
  });
}

export function listResale(ticketId: string, price: number, sellerId = DEMO_USER_ID, showSlug?: string) {
  return post("/api/resale/list", apiResalePoolSchema, {
    sellerId,
    ticketId,
    price,
    showSlug,
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

export function getSession(userId = currentSessionUserId()) {
  return readApi(`/api/users/${encodeURIComponent(userId)}/session`, apiSessionSchema);
}

export function completeSocialLogin(provider: SocialLoginProvider) {
  return readApi(`/api/auth/${provider}/session`, apiSessionSchema);
}

export function loginWithGoogle(credential: string) {
  return post("/api/auth/google", apiSessionSchema, {
    credential,
  });
}

export function updateProfile(name: string, userId = currentSessionUserId()) {
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
