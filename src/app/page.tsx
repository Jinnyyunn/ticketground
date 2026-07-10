import { FloatingSide } from "@/components/floating-side";
import {
  EditorialEventsSection,
  GenreRecommendationsSection,
  HomeHeroSection,
  OfficialResaleSection,
  RealtimeTop10Section,
  SectionDivider,
  ShortcutsSection,
  TicketOpenSection,
} from "@/components/home/home-sections";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <HomeHeroSection />
        <RealtimeTop10Section />
        <SectionDivider />
        <TicketOpenSection />
        <OfficialResaleSection />
        <GenreRecommendationsSection />
        <EditorialEventsSection />
        <ShortcutsSection />
      </main>
      <SiteFooter />
      <FloatingSide />
    </div>
  );
}
