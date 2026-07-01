import { notFound } from "next/navigation";
import { VenueDetail } from "@/components/ticketing/venue-detail";
import { ticketShows } from "@/data/ticketing";
import { getVenue, getVenueForShow, ticketVenues } from "@/data/venues";

export function generateStaticParams() {
  return ticketVenues.map((venue) => ({ slug: venue.slug }));
}

export default async function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = getVenue(slug);
  if (!venue) notFound();

  const currentShows = ticketShows.filter((show) => getVenueForShow(show)?.slug === venue.slug).slice(0, 3);

  return <VenueDetail venue={venue} currentShows={currentShows} />;
}
