import type { Metadata } from "next";
import { WatchlistBoard } from "@/components/watchlist/watchlist-board";
import { featuredShow, genreRecommendations, miniShows, rankings, type PosterFit } from "@/components/home/home-content";
import { TicketingPageShell } from "@/components/ticketing/page-shell";
import { ticketShows } from "@/data/ticketing";

export const metadata: Metadata = {
  title: "관심공연 알림 | Ticketground",
  description: "Ticketground 관심공연 예매 오픈 알림 설정",
};

type HomePosterEntry = {
  readonly poster: string;
  readonly posterFit?: PosterFit;
};

const homePosterEntries = [featuredShow, ...miniShows, ...rankings, ...genreRecommendations.flatMap((group) => group.items)];
const homePosterBySlug = new Map<string, HomePosterEntry>(
  homePosterEntries.map((show) => [
    show.href.replace("/goods/", ""),
    { poster: show.poster, posterFit: "posterFit" in show ? show.posterFit : undefined },
  ]),
);

export default function WatchlistPage() {
  const watchShows = ticketShows.slice(0, 3).map((show, index) => ({
    ...(homePosterBySlug.get(show.slug) ?? { poster: show.poster }),
    slug: show.slug,
    title: show.shortTitle,
    venue: show.venue,
    category: show.category,
    openLabel: ["2026.05.10 14:00", "2026.05.13 20:00", "2026.05.24 18:00"][index] ?? "2026.06.01 14:00",
    dDayLabel: ["D-3", "D-DAY", "D-12"][index] ?? "D-7",
    defaultEnabled: index < 2,
  }));

  return (
    <TicketingPageShell>
      <WatchlistBoard shows={watchShows} />
    </TicketingPageShell>
  );
}
