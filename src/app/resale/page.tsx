import type { Metadata } from "next";
import { ResaleFlow } from "@/components/clean-ticket/resale-flow";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import {
  cleanTicketAdminLedgerRows,
  cleanTicketQrStages,
  cleanTicketResalePolicy,
  cleanTicketReservation,
  appOnlyQrReservation,
  getReservation,
  ticketShows,
  transferRecipientFields,
} from "@/data/ticketing";
import { queryParam } from "@/lib/search-params";
import type { CleanTicketReservation, Reservation } from "@/types";

export const metadata: Metadata = {
  title: "공식 재판매 | Ticketground",
  description: "Ticketground 클린 티켓 공식 재판매 풀",
};

export default async function ResalePage({
  searchParams,
}: {
  searchParams: Promise<{ reservation?: string | string[] }>;
}) {
  const query = await searchParams;
  const reservationId = queryParam(query.reservation);
  const reservation = cleanReservationFromQuery(reservationId);
  const show = ticketShows.find((item) => item.slug === reservation.showSlug);

  return (
    <TicketingPageShell>
      <ResaleFlow reservation={reservation} showTitle={show?.title ?? reservation.showTitle} />
    </TicketingPageShell>
  );
}

function cleanReservationFromQuery(reservationId: string | undefined): CleanTicketReservation {
  if (!reservationId || reservationId === cleanTicketReservation.id) return cleanTicketReservation;
  if (reservationId === appOnlyQrReservation.id) return toCleanTicketReservation(appOnlyQrReservation);

  const reservation = getReservation(reservationId);
  if (!reservation) return cleanTicketReservation;
  if (isCleanTicketReservation(reservation)) return reservation;
  return toCleanTicketReservation(reservation);
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
