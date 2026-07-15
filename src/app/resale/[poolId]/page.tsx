import type { Metadata } from "next";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { ResaleCheckoutPanel } from "@/components/clean-ticket/resale-checkout-panel";
import { getTicketShows } from "@/data/catalog-server";
import { queryParam } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "양도 티켓 결제 | Ticketground",
  description: "등록된 양도 티켓을 확인하고 결제합니다.",
};

export default async function ResaleCheckoutPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ poolId: string }>;
  readonly searchParams: Promise<{
    readonly sessionUserId?: string | string[];
    readonly userId?: string | string[];
  }>;
}) {
  const { poolId } = await params;
  const query = await searchParams;
  const sessionUserId = queryParam(query.sessionUserId) || queryParam(query.userId);
  const ticketShows = await getTicketShows();

  return (
    <TicketingPageShell>
      <ResaleCheckoutPanel poolId={poolId} shows={ticketShows} sessionUserId={sessionUserId} />
    </TicketingPageShell>
  );
}
