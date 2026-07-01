import { SearchPanels } from "@/components/discovery/search-panels";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { searchShows, ticketShows } from "@/data/ticketing";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  const results = searchShows(query);

  return (
    <TicketingPageShell showHeaderSearchBar={false}>
      <SearchPanels query={query} results={results} fallbackShows={ticketShows} />
    </TicketingPageShell>
  );
}
