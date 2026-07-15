import { notFound } from "next/navigation";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { CategoryBrowser } from "@/components/discovery/category-browser";
import { getGeneralSaleShows } from "@/data/catalog-server";
import { categoryEnToKo } from "@/data/show-categories";

export function generateStaticParams() {
  return Object.keys(categoryEnToKo).map((genre) => ({ genre }));
}

export default async function GenrePage({ params }: { params: Promise<{ genre: string }> }) {
  const { genre } = await params;
  const label = categoryEnToKo[genre];
  if (!label) notFound();

  const generalSaleShows = await getGeneralSaleShows();
  const shows = generalSaleShows.filter((show) => show.category === label);

  return (
    <TicketingPageShell>
      <CategoryBrowser label={label} shows={shows} />
    </TicketingPageShell>
  );
}
