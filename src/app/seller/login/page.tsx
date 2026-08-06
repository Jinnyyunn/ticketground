import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { SellerLoginForm } from "@/components/seller/seller-login-form";

export default function SellerLoginPage() {
  return (
    <TicketingPageShell>
      <SellerLoginForm />
    </TicketingPageShell>
  );
}
