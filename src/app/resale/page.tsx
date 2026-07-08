import type { Metadata } from "next";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { ResaleEligibleBrowser } from "@/components/clean-ticket/resale-eligible-browser";
import { ticketShows } from "@/data/ticketing";

export const metadata: Metadata = {
  title: "양도 허용 티켓 | Ticketground",
  description: "판매자가 Tig 공식 풀에 실제로 등록한 양도 티켓만 카테고리별로 확인합니다.",
};

export default function ResaleEligibleTicketsPage() {
  return (
    <TicketingPageShell>
      <ResaleEligibleBrowser shows={ticketShows} />
    </TicketingPageShell>
  );
}
