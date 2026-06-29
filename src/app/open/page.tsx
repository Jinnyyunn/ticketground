import { OpenCalendar } from "@/components/discovery/open-calendar";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { ticketShows } from "@/data/ticketing";

export default function OpenPage() {
  return (
    <TicketingPageShell>
      <OpenCalendar shows={ticketShows} />
    </TicketingPageShell>
  );
}
