import { OpenCalendar } from "@/components/discovery/open-calendar";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { getGeneralSaleShows } from "@/data/catalog-server";

export default async function OpenPage() {
  const generalSaleShows = await getGeneralSaleShows();
  return (
    <TicketingPageShell>
      <OpenCalendar shows={generalSaleShows} />
    </TicketingPageShell>
  );
}
