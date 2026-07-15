import { VenueDetail } from "@/components/ticketing/venue-detail";
import { getGeneralSaleShows } from "@/data/catalog-server";
import { getVenueForShow, ticketVenues } from "@/data/venues";

export default async function PlacePage() {
  const venue = ticketVenues[0];
  const generalSaleShows = await getGeneralSaleShows();
  const currentShows = generalSaleShows.filter((show) => getVenueForShow(show)?.slug === venue.slug).slice(0, 3);

  return <VenueDetail venue={venue} currentShows={currentShows} />;
}
