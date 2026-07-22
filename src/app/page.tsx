import { SellerDashboard } from "@/components/seller/seller-dashboard";

// This branch/port (sell_corporation) is a dedicated corporate-seller
// registration system, not a consumer storefront - landing on "/" here
// goes straight into the seller login/dashboard experience instead of the
// regular Ticketground homepage. The regular consumer routes (search,
// genre pages, /goods/[slug], etc.) still exist in the codebase for the
// published-event detail pages sellers' own listings link out to, but are
// intentionally not the front door of this deployment.
export default function Home() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <SellerDashboard />
    </div>
  );
}
