import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { TransferFlow } from "@/components/transfer/transfer-flow";
import { cleanTicketReservation } from "@/data/ticketing";

export default function TransferPage() {
  return (
    <TicketingPageShell>
      <TransferFlow reservation={cleanTicketReservation} />
    </TicketingPageShell>
  );
}
