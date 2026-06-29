import type { Metadata } from "next";
import { ResaleFlow } from "@/components/clean-ticket/resale-flow";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { cleanTicketReservation, ticketShows } from "@/data/ticketing";

export const metadata: Metadata = {
  title: "공식 재판매 | Ticketground",
  description: "Ticketground 클린 티켓 공식 재판매 풀",
};

const defaultDemoUserId = "user_fan_a";

function firstQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function ResalePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ sessionUserId?: string | string[]; userId?: string | string[] }>;
}) {
  const query = await searchParams;
  const sessionUserId = firstQueryValue(query.sessionUserId) || firstQueryValue(query.userId) || defaultDemoUserId;
  const show = ticketShows.find((item) => item.slug === cleanTicketReservation.showSlug);

  return (
    <TicketingPageShell>
      <ResaleFlow
        reservation={cleanTicketReservation}
        sessionUserId={sessionUserId}
        showTitle={show?.title ?? cleanTicketReservation.showTitle}
      />
    </TicketingPageShell>
  );
}
