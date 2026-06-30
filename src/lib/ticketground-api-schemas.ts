import { z, type ZodType } from "zod";
import type {
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
  ApiWatchlistBase,
  ApiWatchlistItem,
  ApiWatchlistUpsertResult,
} from "./ticketground-api-types";

export const apiEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  venue: z.string(),
  venueId: z.string(),
  category: z.string(),
  saleState: z.string(),
  sale: z.object({
    label: z.string(),
    state: z.string(),
    bookable: z.boolean(),
  }),
}) satisfies ZodType<ApiEvent>;

export const apiTicketSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  performanceDateId: z.string(),
  zoneId: z.string(),
  seatLabel: z.string(),
  status: z.string(),
  available: z.boolean(),
  faceValue: z.number(),
  minPrice: z.number(),
  maxPrice: z.number(),
  transferCount: z.number(),
  maxTransferCount: z.number(),
  issuedAt: z.string().nullable(),
}) satisfies ZodType<ApiTicket>;

export const apiResalePoolSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  performanceDateId: z.string(),
  zoneId: z.string(),
  ticketId: z.string(),
  price: z.number(),
  buyerFee: z.number().nullable(),
  buyerTotal: z.number().nullable(),
  sellerSettlement: z.number().nullable(),
  buyerCount: z.number(),
  status: z.string(),
  createdAt: z.string(),
  matchedAt: z.string().nullable(),
}) satisfies ZodType<ApiResalePool>;

export const apiStateSchema = z.object({
  events: z.array(apiEventSchema),
  tickets: z.array(apiTicketSchema),
  resalePools: z.array(apiResalePoolSchema),
  backendSummary: z.object({
    events: z.number(),
    tickets: z.number(),
  }),
  ledger: z.object({
    verified: z.boolean(),
    totalEntries: z.number(),
  }),
}) satisfies ZodType<ApiState>;

export const apiSeatSchema = z.object({
  id: z.string(),
  label: z.string(),
  displayCode: z.string(),
  zoneId: z.string(),
  zoneName: z.string(),
  price: z.number(),
  status: z.string(),
  available: z.boolean(),
}) satisfies ZodType<ApiSeat>;

export const apiSeatMapSchema = z.object({
  event: z.object({
    id: z.string(),
    title: z.string(),
    venueId: z.string(),
    venue: z.string(),
  }),
  map: z.object({
    title: z.string(),
    image: z.string(),
    description: z.string(),
  }),
  zones: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    available: z.number(),
  })),
  seats: z.array(apiSeatSchema),
}) satisfies ZodType<ApiSeatMap>;

export const apiPurchaseResultSchema = z.object({
  ticket: apiTicketSchema,
  event: z.object({
    id: z.string(),
    title: z.string(),
    venue: z.string(),
  }),
  payment: z.object({
    method: z.string(),
    label: z.string(),
    status: z.string(),
  }),
  admission: z.object({
    status: z.string(),
    activeAt: z.string(),
    activationChannel: z.string(),
  }),
}) satisfies ZodType<ApiPurchaseResult>;

export const apiResaleResultSchema = z.object({
  pool: apiResalePoolSchema,
  ticket: apiTicketSchema,
  fee: z.number(),
  buyerTotal: z.number(),
  sellerSettlement: z.number(),
  payment: z.object({
    method: z.string(),
    label: z.string(),
    status: z.string(),
  }),
}) satisfies ZodType<ApiResaleResult>;

export const apiVirtualQrSchema = z.object({
  type: z.string(),
  ticketId: z.string(),
  issuedAt: z.string(),
  eventTitle: z.string(),
  seatLabel: z.string(),
  performanceStartsAt: z.string(),
  realQrAvailableAt: z.string(),
  admissionChannel: z.string(),
}) satisfies ZodType<ApiVirtualQr>;

export const apiSessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  trustScore: z.number(),
}) satisfies ZodType<ApiSession>;

const apiNotificationJobSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  status: z.string(),
  scheduledAt: z.string(),
});

export const apiWatchlistBaseSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  channels: z.array(z.string()),
  calendarEnabled: z.boolean(),
  notificationEnabled: z.boolean(),
}) satisfies ZodType<ApiWatchlistBase>;

export const apiWatchlistItemSchema = apiWatchlistBaseSchema.extend({
  notificationJobs: z.array(apiNotificationJobSchema),
}) satisfies ZodType<ApiWatchlistItem>;

export const apiSupportThreadSchema = z.object({
  id: z.string(),
  userId: z.string(),
  subject: z.string(),
  status: z.enum(["OPEN", "ANSWERED", "CLOSED"]),
  updatedAt: z.string(),
  messages: z.array(z.object({
    id: z.string(),
    actorId: z.string(),
    role: z.enum(["CUSTOMER", "ADMIN"]),
    body: z.string(),
    at: z.string(),
  })),
}) satisfies ZodType<ApiSupportThread>;

export const apiDirectTransferResultSchema = z.object({
  blocked: z.boolean(),
  user: z.object({
    id: z.string(),
    name: z.string(),
  }),
  ticket: apiTicketSchema,
}) satisfies ZodType<ApiDirectTransferResult>;

export const upsertWatchlistResultSchema = z.object({
  watchlist: apiWatchlistBaseSchema,
  notificationJobs: z.array(apiNotificationJobSchema),
}) satisfies ZodType<ApiWatchlistUpsertResult>;

export const notifyWatchlistResultSchema = z.object({
  notificationJob: z.object({
    id: z.string(),
    status: z.string(),
  }),
});
