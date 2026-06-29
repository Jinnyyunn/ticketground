import { CancelFlow } from "@/components/ticketing/cancel-flow";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { cleanTicketReservation } from "@/data/ticketing";

export default function CancelPage() {
  return (
    <TicketingPageShell>
      <CancelFlow reservation={cleanTicketReservation} />
    </TicketingPageShell>
  );
}
