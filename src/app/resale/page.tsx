import type { Metadata } from "next";
import { ResaleFlow } from "@/components/clean-ticket/resale-flow";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { cleanTicketReservation, ticketShows } from "@/data/ticketing";

export const metadata: Metadata = {
  title: "공식 재판매 | Ticketground",
  description: "Ticketground 클린 티켓 공식 재판매 풀",
};

export default function ResalePage() {
  const show = ticketShows.find((item) => item.slug === cleanTicketReservation.showSlug);

  return (
    <TicketingPageShell>
      <ResaleFlow reservation={cleanTicketReservation} showTitle={show?.title ?? cleanTicketReservation.showTitle} />
    </TicketingPageShell>
  );
}
