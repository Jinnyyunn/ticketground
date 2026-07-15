import { SearchPanels } from "@/components/discovery/search-panels";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { getGeneralSaleShows, searchShowsAsync } from "@/data/catalog-server";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  const [results, generalSaleShows] = await Promise.all([searchShowsAsync(query), getGeneralSaleShows()]);

  return (
    <TicketingPageShell showHeaderSearchBar={false}>
      <SearchPanels query={query} results={results} fallbackShows={generalSaleShows} />
    </TicketingPageShell>
  );
}
