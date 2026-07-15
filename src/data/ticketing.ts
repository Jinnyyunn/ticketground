import type {
  AdminLedgerRow,
  CleanTicketReservation,
  QrStateStage,
  Reservation,
  ResalePolicy,
  TransferRecipientField,
  WatchlistAlert,
} from "@/types";
import { supportingReservations } from "./ticketing-reservations";

export const cleanTicketResalePolicy: ResalePolicy = {
  minPercent: 90,
  maxPercent: 110,
  feeMinPercent: 3,
  feeMaxPercent: 5,
  defaultFeePercent: 4,
};

export const cleanTicketQrStages: readonly QrStateStage[] = [
  {
    code: "virtual",
    label: "가상 티켓",
    timing: "구매 직후",
    description: "입장 QR이 아닌 소유 확인용 티켓입니다.",
  },
  {
    code: "precheck",
    label: "QR 준비",
    timing: "공연 1일 전",
    description: "앱 설치 및 기기 확인 단계입니다.",
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

export const reservations: Reservation[] = [
  cleanTicketReservation,
  ...supportingReservations,
];

export const popularKeywords = ["싸이흠뻑쇼", "MSI", "보이넥스트도어", "야구", "스트레이키즈", "데이식스", "KBO 올스타전"];

export function getReservation(id: string) {
  return reservations.find((reservation) => reservation.id === id);
}

export function getReservationForShow(slug: string) {
  return reservations.find((reservation) => reservation.showSlug === slug);
}

export function getCleanTicketReservation(reservationId: string | undefined): CleanTicketReservation {
  if (!reservationId || reservationId === cleanTicketReservation.id) return cleanTicketReservation;
  if (reservationId === appOnlyQrReservation.id) return toCleanTicketReservation(appOnlyQrReservation);

  const reservation = getReservation(reservationId);
  if (!reservation) return cleanTicketReservation;
  if (isCleanTicketReservation(reservation)) return reservation;
  return toCleanTicketReservation(reservation);
}

export function currency(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function isCleanTicketReservation(reservation: Reservation): reservation is CleanTicketReservation {
  return "seats" in reservation && "resale" in reservation;
}

function toCleanTicketReservation(reservation: Reservation): CleanTicketReservation {
  const grade = gradeForSeat(reservation.seat);
  const faceValue = priceFromReservation(reservation.price);
  const seat = {
    id: `${reservation.id}-SEAT-1`,
    grade,
    label: reservation.seat,
    row: "A",
    number: 1,
    faceValue,
  };

  return {
    ...reservation,
    seats: [seat],
    subtotalAmount: faceValue,
    discountAmount: 0,
    serviceFeeAmount: 0,
    totalAmount: faceValue,
    paymentMethod: "기존 결제 정보",
    qr: {
      currentStage: "virtual",
      stages: cleanTicketQrStages,
    },
    resale: {
      policy: cleanTicketResalePolicy,
      eligibleSeatIds: [seat.id],
    },
    transfer: {
      recipientFields: transferRecipientFields,
      maxAmountPercent: 10,
    },
    ledger: cleanTicketAdminLedgerRows,
  };
}

function gradeForSeat(seat: string): "VIP" | "R" | "S" | "A" {
  if (seat.includes("VIP")) return "VIP";
  if (seat.includes("R석")) return "R";
  if (seat.includes("S석")) return "S";
  return "A";
}

function priceFromReservation(price: string): number {
  const parsed = Number.parseInt(price.replaceAll(/[^0-9]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
