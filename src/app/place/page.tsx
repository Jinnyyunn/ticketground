import { VenueDetail } from "@/components/ticketing/venue-detail";
import { ticketShows } from "@/data/ticketing";
import { getVenueForShow, ticketVenues } from "@/data/venues";

export default function PlacePage() {
  const venue = ticketVenues[0];
  const currentShows = ticketShows.filter((show) => getVenueForShow(show)?.slug === venue.slug).slice(0, 3);

  return <VenueDetail venue={venue} currentShows={currentShows} />;
}
