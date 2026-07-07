import type { Metadata } from "next";
import { ResaleFlow } from "@/components/clean-ticket/resale-flow";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { getCleanTicketReservation, ticketShows } from "@/data/ticketing";
import { queryParam } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Tig 공식 양도 티켓 | Ticketground",
  description: "Ticketground 클린 티켓 Tig 공식 양도 티켓 풀",
};

const defaultDemoUserId = "user_fan_a";

export default async function ResalePage({
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
