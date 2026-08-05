import { ticketShows } from "@/data/ticketing";

/** All Ticketground shows available for chart binding. */
export function listBindableShows(): readonly { slug: string; label: string; venue: string }[] {
  return ticketShows.map((s) => ({
    slug: s.slug,
    label: s.shortTitle || s.title,
    venue: s.venue,
  }));
}
