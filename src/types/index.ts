export interface NavItem {
  label: string;
  highlight?: boolean;
}

export interface RankingItem {
  rank: number;
  title: string;
  venue: string;
  date: string;
  poster: string;
  badge?: string;
}

export interface OpenItem {
  time: string;
  title: string;
  type: string;
  poster: string;
  hot?: boolean;
  tag?: string;
}

export interface PlayItem {
  title: string;
  thumb: string;
  poster: string;
  duration: string;
}

export interface DealItem {
  badge: "타임딜" | "파이널콜";
  countdown: string;
  title: string;
  venue: string;
  date: string;
  discountLabel: string;
  percent: string;
  price: string;
  poster: string;
}

export interface ProductItem {
  title: string;
  venue: string;
  date: string;
  poster: string;
}

export interface ReviewItem {
  show: string;
  headline: string;
  body: string;
  user: string;
  score: string;
  avatar: string;
  poster: string;
}

export interface TicketShow {
  readonly slug: string;
  readonly code: string;
  readonly backendEventId: string;
  readonly category: "뮤지컬" | "콘서트" | "연극" | "클래식" | "스포츠" | "전시/행사" | "아동/가족";
  readonly title: string;
  readonly shortTitle: string;
  readonly venue: string;
  readonly period: string;
  readonly runtime: string;
  readonly ageLimit: string;
  readonly poster: string;
  readonly ranking?: string;
  readonly badge?: string;
  readonly prices: readonly TicketPrice[];
  readonly schedules: ReadonlyArray<{
    readonly label: string;
    readonly date: string;
    readonly times: readonly string[];
  }>;
  readonly casts: readonly string[];
  readonly notices: readonly string[];
  readonly summary: string;
}

export type TicketSeatGrade = "OP" | "VIP" | "R" | "S" | "A" | "PASS" | "ADULT" | "YOUTH";

export interface TicketPrice {
  readonly grade: TicketSeatGrade;
  readonly seat: string;
  readonly price: number;
}

export interface TicketSeat {
  readonly id: string;
  readonly grade: Extract<TicketSeatGrade, "VIP" | "R" | "S" | "A">;
  readonly label: string;
  readonly row: string;
  readonly number: number;
  readonly faceValue: number;
}

export type QrStageCode = "virtual" | "precheck" | "active";

export interface QrStateStage {
  readonly code: QrStageCode;
  readonly label: string;
  readonly timing: string;
  readonly description: string;
}

export interface ResalePolicy {
  readonly minPercent: number;
  readonly maxPercent: number;
  readonly feeMinPercent: number;
  readonly feeMaxPercent: number;
  readonly defaultFeePercent: number;
}

export interface TransferRecipientField {
  readonly id: "kakao" | "email" | "phone";
  readonly label: string;
  readonly placeholder: string;
  readonly required: boolean;
}

export interface WatchlistAlert {
  readonly id: string;
  readonly showSlug: string;
  readonly timing: "D-3" | "same-day";
  readonly channels: readonly ("kakao" | "appPush" | "email" | "sms")[];
  readonly message: string;
}

export interface InquiryMessage {
  readonly author: "member" | "agent" | "system";
  readonly at: string;
  readonly body: string;
}

export interface InquiryThread {
  readonly id: string;
  readonly reservationId: string;
  readonly showSlug: string;
  readonly status: "open" | "answered" | "closed";
  readonly subject: string;
  readonly messages: readonly InquiryMessage[];
}

export interface AdminLedgerRow {
  readonly seq: number;
  readonly at: string;
  readonly reservationId: string;
  readonly event: string;
  readonly previousHash: string;
  readonly hash: string;
  readonly verified: boolean;
}

export interface Reservation {
  readonly id: string;
  readonly showSlug: string;
  readonly showTitle: string;
  readonly venue: string;
  readonly date: string;
  readonly time: string;
  readonly seat: string;
  readonly price: string;
  readonly status: "예매완료" | "취소요청";
}

export interface CleanTicketReservation extends Reservation {
  readonly seats: readonly TicketSeat[];
  readonly subtotalAmount: number;
  readonly discountAmount: number;
  readonly serviceFeeAmount: number;
  readonly totalAmount: number;
  readonly paymentMethod: string;
  readonly qr: {
    readonly currentStage: QrStageCode;
    readonly stages: readonly QrStateStage[];
  };
  readonly resale: {
    readonly policy: ResalePolicy;
    readonly eligibleSeatIds: readonly string[];
  };
  readonly transfer: {
    readonly recipientFields: readonly TransferRecipientField[];
    readonly maxAmountPercent: number;
  };
  readonly ledger: readonly AdminLedgerRow[];
}

export interface BookingSelection {
  readonly date: string;
  readonly time: string;
  readonly seat: string;
  readonly price: number;
}
