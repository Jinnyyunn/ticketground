import { notFound } from "next/navigation";
import { VenueDetail } from "@/components/ticketing/venue-detail";
import { getGeneralSaleShows } from "@/data/catalog-server";
import { getVenue, getVenueForShow, ticketVenues } from "@/data/venues";

export function generateStaticParams() {
  return ticketVenues.map((venue) => ({ slug: venue.slug }));
}

export default async function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = getVenue(slug);
  if (!venue) notFound();

  const generalSaleShows = await getGeneralSaleShows();
  const currentShows = generalSaleShows.filter((show) => getVenueForShow(show)?.slug === venue.slug).slice(0, 3);

  return <VenueDetail venue={venue} currentShows={currentShows} />;
}
