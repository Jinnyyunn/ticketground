import { RankingList } from "@/components/discovery/ranking-list";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { getGeneralSaleShows } from "@/data/catalog-server";
import { rankShows } from "@/data/ranking";

export default async function RankingPage() {
  const generalSaleShows = await getGeneralSaleShows();
  return (
    <TicketingPageShell>
      <RankingList shows={rankShows(generalSaleShows)} />
    </TicketingPageShell>
  );
}
