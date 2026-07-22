import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { SellerDashboard } from "@/components/seller/seller-dashboard";

export default function SellerDashboardPage() {
  return (
    <TicketingPageShell>
      <SellerDashboard />
    </TicketingPageShell>
  );
}
