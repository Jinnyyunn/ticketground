import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingPanel } from "@/components/ticketing/booking-panel";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { getShow, ticketShows } from "@/data/ticketing";
import { queryParam } from "@/lib/search-params";

export function generateStaticParams() {
  return ticketShows.map((show) => ({ slug: show.slug }));
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string | string[]; time?: string | string[]; timer?: string | string[] }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const show = getShow(slug);
  if (!show) notFound();
  const timerParam = Number(queryParam(query.timer));
  const initialTimerSeconds = Number.isFinite(timerParam) ? Math.max(0, Math.min(7 * 60, Math.floor(timerParam))) : undefined;

  return (
    <TicketingPageShell>
      <Suspense fallback={<div className="ticketground-container py-10 text-[16px] font-bold">좌석 선택 정보를 불러오는 중입니다.</div>}>
        <BookingPanel show={show} initialSelection={{ date: queryParam(query.date), time: queryParam(query.time) }} initialTimerSeconds={initialTimerSeconds} />
      </Suspense>
    </TicketingPageShell>
  );
}
