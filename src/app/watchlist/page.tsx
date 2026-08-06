import type { Metadata } from "next";
import { WatchlistBoard } from "@/components/watchlist/watchlist-board";
import { TicketingPageShell } from "@/components/ticketing/page-shell";

export const metadata: Metadata = {
  title: "관심공연 알림 | Ticketground",
  description: "Ticketground 관심공연 예매 오픈 알림 설정",
};

export default function WatchlistPage() {
  return (
    <TicketingPageShell>
      <WatchlistBoard />
    </TicketingPageShell>
  );
}
