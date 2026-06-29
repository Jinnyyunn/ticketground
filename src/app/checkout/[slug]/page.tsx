import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckoutPanel } from "@/components/ticketing/checkout-panel";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { getReservationForShow, getShow, ticketShows } from "@/data/ticketing";
import { queryParam } from "@/lib/search-params";

export function generateStaticParams() {
  return ticketShows.map((show) => ({ slug: show.slug }));
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    date?: string | string[];
    time?: string | string[];
    seat?: string | string[];
    seats?: string | string[];
    price?: string | string[];
    base?: string | string[];
    fee?: string | string[];
    total?: string | string[];
    count?: string | string[];
  }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const show = getShow(slug);
  if (!show) notFound();
  const reservation = getReservationForShow(show.slug);
  if (!reservation) notFound();

  const fallbackSchedule = show.schedules[0];
  const queryNumber = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  const fallbackBase = Number.parseInt(reservation.price.replace(/\D/g, ""), 10);
  const baseAmount = queryNumber(queryParam(query.base)) || queryNumber(queryParam(query.price)) || fallbackBase;
  const feeAmount = queryNumber(queryParam(query.fee));
  const totalAmount = queryNumber(queryParam(query.total)) || baseAmount + feeAmount;
  const discountAmount = Math.max(0, baseAmount + feeAmount - totalAmount);
  const seats = queryParam(query.seats) || queryParam(query.seat) || reservation.seat;
  const count = queryNumber(queryParam(query.count)) || seats.split(",").filter(Boolean).length || 1;

  return (
    <TicketingPageShell>
      <Suspense fallback={<div className="ticketground-container py-10 text-[16px] font-bold">결제 정보를 불러오는 중입니다.</div>}>
        <CheckoutPanel
          show={show}
          reservation={reservation}
          selection={{
            date: queryParam(query.date) || fallbackSchedule?.date || reservation.date,
            time: queryParam(query.time) || fallbackSchedule?.times[0] || reservation.time,
            seats,
            count,
            baseAmount,
            discountAmount,
            feeAmount,
            totalAmount,
          }}
        />
      </Suspense>
    </TicketingPageShell>
  );
}
