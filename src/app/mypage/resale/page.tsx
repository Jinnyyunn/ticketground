import type { Metadata } from "next";
import { ResaleFlow } from "@/components/clean-ticket/resale-flow";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { getCleanTicketReservation, ticketShows } from "@/data/ticketing";
import { queryParam } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "CLEAN 티켓 공식 양도 | Ticketground",
  description: "내 예약을 CLEAN 티켓 공식 풀에 등록하고 거래 현황을 확인합니다.",
};

const defaultDemoUserId = "user_fan_a";

export default async function MyResalePage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly reservation?: string | string[];
    readonly sessionUserId?: string | string[];
    readonly userId?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const sessionUserId = queryParam(query.sessionUserId) || queryParam(query.userId) || defaultDemoUserId;
  const reservationId = queryParam(query.reservation);
  const reservation = getCleanTicketReservation(reservationId);
  const show = ticketShows.find((item) => item.slug === reservation.showSlug);

  return (
    <TicketingPageShell>
      <ResaleFlow reservation={reservation} sessionUserId={sessionUserId} showPoster={show?.poster} showTitle={show?.title ?? reservation.showTitle} />
    </TicketingPageShell>
  );
}
