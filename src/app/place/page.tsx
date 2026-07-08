import { VenueDetail } from "@/components/ticketing/venue-detail";
import { generalSaleShows } from "@/data/ticketing";
import { getVenueForShow, ticketVenues } from "@/data/venues";

export default function PlacePage() {
  const venue = ticketVenues[0];
  const currentShows = generalSaleShows.filter((show) => getVenueForShow(show)?.slug === venue.slug).slice(0, 3);

  return <VenueDetail venue={venue} currentShows={currentShows} />;
}
