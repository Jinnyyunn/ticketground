import type {
  AdminLedgerRow,
  CleanTicketReservation,
  QrStateStage,
  Reservation,
  ResalePolicy,
  TicketShow,
  TransferRecipientField,
  WatchlistAlert,
  InquiryThread,
} from "@/types";
import { homeTicketShows } from "./home-ticketing-catalog";
import { supportingReservations, supportingTicketShows } from "./ticketing-catalog";

const P = "/images/posters";

export const cleanTicketResalePolicy: ResalePolicy = {
  minPercent: 90,
  maxPercent: 100,
  feeMinPercent: 3,
  feeMaxPercent: 5,
  defaultFeePercent: 4,
};

export const cleanTicketQrStages: readonly QrStateStage[] = [
  {
    code: "virtual",
    label: "가상 티켓",
    timing: "구매 직후",
    description: "소유 확인 전용이며 입장 QR로 사용할 수 없습니다.",
  },
  {
    code: "precheck",
    label: "QR 준비",
    timing: "공연 1일 전",
    description: "앱 설치와 본인 기기 확인을 진행합니다.",
  },
  {
    code: "active",
    label: "동적 QR",
    timing: "공연 2~3시간 전",
    description: "앱 전용 20초 갱신 입장 QR이 활성화됩니다.",
  },
];

export const transferRecipientFields: readonly TransferRecipientField[] = [
  { id: "kakao", label: "카카오톡", placeholder: "받는 사람 카카오톡 ID", required: true },
  { id: "email", label: "이메일", placeholder: "recipient@example.com", required: true },
  { id: "phone", label: "휴대폰", placeholder: "010-0000-0000", required: true },
];

export const cleanTicketAdminLedgerRows: readonly AdminLedgerRow[] = [
  {
    seq: 10513,
    at: "2026-05-13T10:04:29+09:00",
    reservationId: "CTI-260513-A4F2K9",
    event: "reservation.confirmed",
    previousHash: "0x8f01c2aa",
    hash: "0x4a5f2k9b",
    verified: true,
  },
  {
    seq: 10514,
    at: "2026-05-13T10:04:31+09:00",
    reservationId: "CTI-260513-A4F2K9",
    event: "ledger.clean-ticket-issued",
    previousHash: "0x4a5f2k9b",
    hash: "0x7ce91340",
    verified: true,
  },
];

export const ticketShows: TicketShow[] = [
  {
    slug: "les-miserables",
    code: "CTI-LM40",
    category: "뮤지컬",
    title: "레미제라블 40주년 (Les Miserables 40th Anniversary)",
    shortTitle: "레미제라블",
    venue: "블루스퀘어 신한카드홀",
    period: "2026.05.13 ~ 2026.08.30",
    runtime: "170분(인터미션 20분 포함)",
    ageLimit: "8세 이상 관람가",
    poster: `${P}/26006232_p.gif`,
    ranking: "뮤지컬 주간 1위",
    badge: "클린티켓",
    artistSlug: "les-miserables-cast",
    prices: [
      { grade: "VIP", seat: "VIP석", price: 190000 },
      { grade: "R", seat: "R석", price: 160000 },
      { grade: "S", seat: "S석", price: 120000 },
      { grade: "A", seat: "A석", price: 80000 },
    ],
    schedules: [
      { label: "5월 13일", date: "2026.05.13", times: ["19:30"] },
      { label: "5월 14일", date: "2026.05.14", times: ["14:30", "19:30"] },
      { label: "5월 16일", date: "2026.05.16", times: ["14:00", "19:00"] },
    ],
    casts: ["민우혁", "최재림", "김소현", "조정은", "박강현", "카이"],
    notices: [
      "공식 재판매는 정가의 90~100% 범위에서만 등록할 수 있습니다.",
      "구매 직후 QR은 소유 확인용 가상 티켓이며 입장에 사용할 수 없습니다.",
      "동반자 입장은 공식 양도 흐름을 통해 받는 사람 정보를 등록해야 합니다.",
    ],
    summary: "블루스퀘어에서 만나는 레미제라블 40주년 대표 회차입니다. CTI 클린티켓 데이터의 기준 공연입니다.",
  },
  ...supportingTicketShows,
  ...homeTicketShows,
];

export const cleanTicketReservation: CleanTicketReservation = {
  id: "CTI-260513-A4F2K9",
  showSlug: "les-miserables",
  showTitle: "레미제라블 40주년",
  venue: "블루스퀘어 신한카드홀",
  date: "2026.05.13",
  time: "19:30",
  seat: "VIP H-14 / VIP H-15",
  price: "346,000원",
  status: "예매완료",
  seats: [
    { id: "VIP-H-14", grade: "VIP", label: "VIP H-14", row: "H", number: 14, faceValue: 190000 },
    { id: "VIP-H-15", grade: "VIP", label: "VIP H-15", row: "H", number: 15, faceValue: 190000 },
  ],
  subtotalAmount: 380000,
  discountAmount: 38000,
  serviceFeeAmount: 4000,
  totalAmount: 346000,
  paymentMethod: "신한카드 10% 할인",
  qr: {
    currentStage: "virtual",
    stages: cleanTicketQrStages,
  },
  resale: {
    policy: cleanTicketResalePolicy,
    eligibleSeatIds: ["VIP-H-14", "VIP-H-15"],
  },
  transfer: {
    recipientFields: transferRecipientFields,
    maxAmountPercent: 10,
  },
  ledger: cleanTicketAdminLedgerRows,
};

export const appOnlyQrReservation: Reservation = {
  id: "CTI-260629-DAYQR",
  showSlug: "dracula",
  showTitle: "뮤지컬 드라큘라 (Dracula：The Musical)",
  venue: "LG아트센터 서울 LG SIGNATURE 홀",
  date: "2026.06.29",
  time: "19:30",
  seat: "VIP A열 12번",
  price: "180,000원",
  status: "예매완료",
};

export const watchlistAlerts: readonly WatchlistAlert[] = [
  {
    id: "watch-les-miserables-d3",
    showSlug: "les-miserables",
    timing: "D-3",
    channels: ["kakao", "appPush", "email"],
    message: "레미제라블 40주년 예매 오픈 3일 전 알림",
  },
  {
    id: "watch-les-miserables-day",
    showSlug: "les-miserables",
    timing: "same-day",
    channels: ["kakao", "appPush", "sms"],
    message: "레미제라블 40주년 예매 오픈 당일 알림",
  },
];

export const inquiryThreads: readonly InquiryThread[] = [
  {
    id: "inq-cti-260513-a4f2k9-transfer",
    reservationId: "CTI-260513-A4F2K9",
    showSlug: "les-miserables",
    status: "answered",
    subject: "동반자 티켓 양도 가능 시간 문의",
    messages: [
      {
        author: "member",
        at: "2026-05-14T09:12:00+09:00",
        body: "VIP H-15 좌석을 동반자에게 따로 전달하고 싶습니다.",
      },
      {
        author: "agent",
        at: "2026-05-14T09:25:00+09:00",
        body: "공식 양도에서 받는 사람 카카오톡, 이메일, 휴대폰을 등록하면 QR 직접 전달 없이 입장할 수 있습니다.",
      },
    ],
  },
  {
    id: "inq-cti-260710-entry",
    reservationId: "CTI-260710-001",
    showSlug: "dracula",
    status: "open",
    subject: "공연 당일 입장 QR 활성화 문의",
    messages: [
      {
        author: "member",
        at: "2026-07-10T16:20:00+09:00",
        body: "오늘 19:30 공연인데 앱에서 QR 준비 상태로만 보입니다.",
      },
      {
        author: "system",
        at: "2026-07-10T16:20:01+09:00",
        body: "공연 당일 입장 문의로 우선 분류되었습니다. 예매정보가 상담원에게 함께 전달됩니다.",
      },
    ],
  },
  {
    id: "inq-cti-26007850-refund",
    reservationId: "CTI-26007850-001",
    showSlug: "palette-festival",
    status: "closed",
    subject: "우천 시 취소 수수료 확인",
    messages: [
      {
        author: "member",
        at: "2026-08-09T11:05:00+09:00",
        body: "야외 공연인데 우천 예보가 있을 때 취소 수수료가 어떻게 적용되나요?",
      },
      {
        author: "agent",
        at: "2026-08-09T11:42:00+09:00",
        body: "주최 측 취소가 아닌 일반 취소는 취소/환불 화면의 관람일 기준 수수료 정책이 적용됩니다.",
      },
    ],
  },
];

export const reservations: Reservation[] = [
  cleanTicketReservation,
  ...supportingReservations,
];

export const popularKeywords = ["싸이흠뻑쇼", "MSI", "보이넥스트도어", "야구", "스트레이키즈", "데이식스", "KBO 올스타전"];

export function getShow(slug: string) {
  return ticketShows.find((show) => show.slug === slug);
}

export function getReservation(id: string) {
  return reservations.find((reservation) => reservation.id === id);
}

export function getReservationForShow(slug: string) {
  return reservations.find((reservation) => reservation.showSlug === slug);
}

export function searchShows(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return ticketShows.filter((show) =>
    [show.title, show.shortTitle, show.venue, show.category].some((value) => value.toLowerCase().includes(normalized)),
  );
}

export function currency(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}
