import { CancelFlow } from "@/components/ticketing/cancel-flow";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { getCleanTicketReservation } from "@/data/ticketing";
import { queryParam } from "@/lib/search-params";

export default async function CancelPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly reservation?: string | string[];
    readonly reservationId?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const reservation = getCleanTicketReservation(queryParam(query.reservation) || queryParam(query.reservationId));

  return (
    <TicketingPageShell>
      <CancelFlow reservation={reservation} />
    </TicketingPageShell>
  );
}
