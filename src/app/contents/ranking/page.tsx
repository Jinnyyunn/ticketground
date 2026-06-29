import { RankingList } from "@/components/discovery/ranking-list";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { ticketShows } from "@/data/ticketing";

export default function RankingPage() {
  return (
    <TicketingPageShell>
      <RankingList shows={ticketShows} />
    </TicketingPageShell>
  );
}
