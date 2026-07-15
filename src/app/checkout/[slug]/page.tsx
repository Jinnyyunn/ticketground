import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckoutPanel } from "@/components/ticketing/checkout-panel";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { getShowBySlug } from "@/data/catalog-server";
import { queryParam } from "@/lib/search-params";

const serviceFeePerSeat = 2000;

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
    ticketId?: string | string[];
  }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const show = await getShowBySlug(slug);
  if (!show) notFound();

  const fallbackSchedule = show.schedules[0];
  const queryNumber = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  const lowestPrice = show.prices.reduce((min, price) => Math.min(min, price.price), Number.POSITIVE_INFINITY);
  const fallbackBase = show.sale.bookable ? show.sale.displayPrice : lowestPrice;
  const queryBase = queryNumber(queryParam(query.base) || queryParam(query.price));
  const seats = queryParam(query.seats) || queryParam(query.seat) || "";
  const count = queryNumber(queryParam(query.count)) || seats.split(",").filter(Boolean).length || 1;
  const baseAmount = queryBase || (Number.isFinite(fallbackBase) ? fallbackBase : 0);
  const feeAmount = count * serviceFeePerSeat;
  const totalAmount = baseAmount + feeAmount;
  const discountAmount = 0;

  return (
    <TicketingPageShell>
      <Suspense fallback={<div className="ticketground-container py-10 text-lg font-bold">결제 정보를 불러오는 중입니다.</div>}>
        <CheckoutPanel
          show={show}
          selection={{
            date: queryParam(query.date) || fallbackSchedule?.date || "",
            time: queryParam(query.time) || fallbackSchedule?.times[0] || "",
            seats,
            count,
            baseAmount,
            discountAmount,
            feeAmount,
            totalAmount,
            ticketId: queryParam(query.ticketId),
          }}
        />
      </Suspense>
    </TicketingPageShell>
  );
}
