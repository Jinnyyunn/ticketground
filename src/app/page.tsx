import { FloatingSide } from "@/components/floating-side";
import type { RankingShow } from "@/components/home/home-content";
import {
  EditorialEventsSection,
  GenreRecommendationsSection,
  GroupBookingBanner,
  HomeHeroSection,
  OfficialResaleSection,
  RealtimeTop10Section,
  ShortcutsSection,
  TicketOpenSection,
} from "@/components/home/home-sections";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getGeneralSaleShows } from "@/data/catalog-server";
import { rankShows } from "@/data/ranking";
import type { TicketShow } from "@/types";

function toRankingShow(show: TicketShow, index: number): RankingShow {
  return {
    rank: index + 1,
    title: show.shortTitle,
    venue: show.venue,
    date: show.period,
    href: `/goods/${show.slug}`,
    movement: "same",
    delta: "-",
    gradient: "g1",
    poster: show.poster,
  };
}

export default async function Home() {
  const generalSaleShows = await getGeneralSaleShows();
  const topRankings = rankShows(generalSaleShows).map(toRankingShow);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <HomeHeroSection />
        <RealtimeTop10Section items={topRankings} />
        <TicketOpenSection />
        <OfficialResaleSection />
        <GenreRecommendationsSection />
        <EditorialEventsSection />
        <ShortcutsSection />
        <GroupBookingBanner />
      </main>
      <SiteFooter />
      <FloatingSide />
    </div>
  );
}
