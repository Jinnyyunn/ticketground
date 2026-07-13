import { RankingList } from "@/components/discovery/ranking-list";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { getGeneralSaleShows } from "@/data/catalog-server";

export default async function RankingPage() {
  const generalSaleShows = await getGeneralSaleShows();
  return (
    <TicketingPageShell>
      <RankingList shows={generalSaleShows} />
    </TicketingPageShell>
  );
}
