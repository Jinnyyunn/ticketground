import { notFound } from "next/navigation";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { CategoryBrowser } from "@/components/discovery/category-browser";
import { ticketShows } from "@/data/ticketing";

const genreLabels: Record<string, string> = {
  musical: "뮤지컬",
  concert: "콘서트",
  sports: "스포츠",
  exhibition: "전시/행사",
};

export function generateStaticParams() {
  return Object.keys(genreLabels).map((genre) => ({ genre }));
}

export default async function GenrePage({ params }: { params: Promise<{ genre: string }> }) {
  const { genre } = await params;
  const label = genreLabels[genre];
  if (!label) notFound();

  const shows = ticketShows.filter((show) => show.category === label);

  return (
    <TicketingPageShell>
      <CategoryBrowser label={label} shows={shows} />
    </TicketingPageShell>
  );
}
