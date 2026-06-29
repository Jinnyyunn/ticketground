import ky, { HTTPError } from "ky";

export type PublicTicket = {
  readonly id: string;
  readonly eventId: string;
  readonly performanceDateId: string;
  readonly zoneId: string;
  readonly seatLabel: string;
  readonly status: string;
  readonly faceValue: number;
  readonly minPrice: number;
  readonly maxPrice: number;
};

export type PublicResalePool = {
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

export type PublicPayment = {
  readonly method: string;
  readonly label: string;
  readonly status: string;
};

export type PublicSessionUser = {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly trustScore: number;
};

export type ResalePurchaseResult = {
  readonly pool: PublicResalePool;
  readonly ticket: PublicTicket;
  readonly fee: number;
  readonly buyerTotal: number;
  readonly sellerSettlement: number;
  readonly payment: PublicPayment;
};

export class TicketgroundApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: unknown;

  constructor({ code, message, status, detail }: { readonly code: string; readonly message: string; readonly status: number; readonly detail: unknown }) {
    super(message);
    this.name = "TicketgroundApiError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumberValue(value: unknown) {
  if (value === null || value === undefined) return null;
  return numberValue(value);
}

function nullableStringValue(value: unknown) {
  if (value === null || value === undefined) return null;
  return stringValue(value);
}

function parseTicket(value: unknown): PublicTicket {
  if (!isRecord(value)) throw new TicketgroundApiError({ code: "BAD_TICKET_RESPONSE", message: "티켓 응답을 확인해주세요.", status: 500, detail: value });
  return {
    id: stringValue(value.id),
    eventId: stringValue(value.eventId),
    performanceDateId: stringValue(value.performanceDateId),
    zoneId: stringValue(value.zoneId),
    seatLabel: stringValue(value.seatLabel),
    status: stringValue(value.status),
    faceValue: numberValue(value.faceValue),
    minPrice: numberValue(value.minPrice),
    maxPrice: numberValue(value.maxPrice),
  };
}

function parsePool(value: unknown): PublicResalePool {
  if (!isRecord(value)) throw new TicketgroundApiError({ code: "BAD_RESALE_POOL_RESPONSE", message: "재판매 풀 응답을 확인해주세요.", status: 500, detail: value });
  return {
    id: stringValue(value.id),
    eventId: stringValue(value.eventId),
    performanceDateId: stringValue(value.performanceDateId),
    zoneId: stringValue(value.zoneId),
    ticketId: stringValue(value.ticketId),
    price: numberValue(value.price),
    buyerFee: nullableNumberValue(value.buyerFee),
    buyerTotal: nullableNumberValue(value.buyerTotal),
    sellerSettlement: nullableNumberValue(value.sellerSettlement),
    buyerCount: numberValue(value.buyerCount),
    status: stringValue(value.status),
    createdAt: stringValue(value.createdAt),
    matchedAt: nullableStringValue(value.matchedAt),
  };
}

function parsePayment(value: unknown): PublicPayment {
  if (!isRecord(value)) throw new TicketgroundApiError({ code: "BAD_PAYMENT_RESPONSE", message: "결제 응답을 확인해주세요.", status: 500, detail: value });
  return {
    method: stringValue(value.method),
    label: stringValue(value.label),
    status: stringValue(value.status),
  };
}

function parseSessionUser(value: unknown): PublicSessionUser {
  if (!isRecord(value)) throw new TicketgroundApiError({ code: "BAD_SESSION_RESPONSE", message: "세션 응답을 확인해주세요.", status: 500, detail: value });
  const id = stringValue(value.id);
  if (!id) throw new TicketgroundApiError({ code: "BAD_SESSION_RESPONSE", message: "세션 사용자 ID를 확인해주세요.", status: 500, detail: value });
  return {
    id,
    name: stringValue(value.name),
    status: stringValue(value.status),
    trustScore: numberValue(value.trustScore),
  };
}

const publicApi = ky.create({
  retry: 0,
  timeout: 10000,
});

async function jsonFromError(error: HTTPError) {
  try {
    return await error.response.json<unknown>();
  } catch (cause) {
    if (cause instanceof Error) {
      throw new TicketgroundApiError({
        code: "BAD_ERROR_RESPONSE",
        message: "오류 응답을 확인해주세요.",
        status: error.response.status,
        detail: cause.message,
      });
    }
    throw new TicketgroundApiError({
      code: "BAD_ERROR_RESPONSE",
      message: "오류 응답을 확인해주세요.",
      status: error.response.status,
      detail: cause,
    });
  }
}

async function requestData(path: string, body?: Record<string, unknown>) {
  let payload: unknown;
  let status = 200;
  try {
    payload = await publicApi(path, {
      method: body ? "post" : "get",
      json: body,
    }).json<unknown>();
  } catch (error) {
    if (error instanceof HTTPError) {
      payload = await jsonFromError(error);
      status = error.response.status;
    } else if (error instanceof Error) {
      throw new TicketgroundApiError({ code: "NETWORK_ERROR", message: error.message, status: 0, detail: error.name });
    } else {
      throw new TicketgroundApiError({ code: "NETWORK_ERROR", message: "네트워크 요청을 처리하지 못했습니다.", status: 0, detail: error });
    }
  }
  if (!isRecord(payload)) {
    throw new TicketgroundApiError({ code: "BAD_API_RESPONSE", message: "API 응답을 확인해주세요.", status, detail: payload });
  }
  if (payload.ok === true) return payload.data;

  const error = isRecord(payload.error) ? payload.error : {};
  throw new TicketgroundApiError({
    code: stringValue(error.code) || "API_ERROR",
    message: stringValue(error.message) || "요청을 처리하지 못했습니다.",
    status,
    detail: error.detail,
  });
}

export async function getUserTickets(userId: string) {
  const data = await requestData(`/api/users/${encodeURIComponent(userId)}/tickets`);
  if (!Array.isArray(data)) return [];
  return data.map(parseTicket);
}

export async function getDemoSession(userId: string) {
  return parseSessionUser(await requestData(`/api/users/${encodeURIComponent(userId)}/session`));
}

export async function getPublicResalePools() {
  const data = await requestData("/api/state");
  if (!isRecord(data) || !Array.isArray(data.resalePools)) return [];
  return data.resalePools.map(parsePool);
}

export async function listTicketForResale({ sellerId, ticketId, price }: { readonly sellerId: string; readonly ticketId: string; readonly price: number }) {
  return parsePool(await requestData("/api/resale/list", { sellerId, ticketId, price }));
}

export async function purchaseResaleTicket({ buyerId, poolId }: { readonly buyerId: string; readonly poolId: string }) {
  const data = await requestData("/api/resale/purchase", { buyerId, poolId, paymentMethod: "CREDIT_CARD" });
  if (!isRecord(data)) throw new TicketgroundApiError({ code: "BAD_RESALE_PURCHASE_RESPONSE", message: "재판매 구매 응답을 확인해주세요.", status: 500, detail: data });
  return {
    pool: parsePool(data.pool),
    ticket: parseTicket(data.ticket),
    fee: numberValue(data.fee),
    buyerTotal: numberValue(data.buyerTotal),
    sellerSettlement: numberValue(data.sellerSettlement),
    payment: parsePayment(data.payment),
  } satisfies ResalePurchaseResult;
}
