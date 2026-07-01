import { FloatingSide } from "@/components/floating-side";
import {
  EditorialEventsSection,
  GenreRecommendationsSection,
  HomeHeroSection,
  OfficialResaleSection,
  RealtimeTop10Section,
  ShortcutsSection,
  TicketOpenSection,
} from "@/components/home/home-sections";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <HomeHeroSection />
        <RealtimeTop10Section />
        <TicketOpenSection />
        <OfficialResaleSection />
        <EditorialEventsSection />
        <GenreRecommendationsSection />
        <ShortcutsSection />
      </main>
      <SiteFooter />
      <FloatingSide />
    </div>
  );
}
