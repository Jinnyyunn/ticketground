import type { Metadata } from "next";
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
import { getDictionary } from "@/i18n/get-dictionary";
import { requestLocale } from "@/i18n/request-locale";
import { locales, ogLocaleFor } from "@/i18n/config";
import { localeHomeHref } from "@/i18n/routing";

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

export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  const dict = await getDictionary(locale);
  const languages = Object.fromEntries(locales.map((entry) => [entry, localeHomeHref(entry)]));
  return {
    title: dict.metadata.title,
    description: dict.metadata.description,
    alternates: {
      canonical: localeHomeHref(locale),
      languages: { ...languages, "x-default": "/" },
    },
    openGraph: {
      title: dict.metadata.title,
      description: dict.metadata.description,
      locale: ogLocaleFor(locale),
      url: localeHomeHref(locale),
    },
  };
}

export default async function Home() {
  const locale = await requestLocale();
  const dict = await getDictionary(locale);
  const generalSaleShows = await getGeneralSaleShows();
  const topRankings = rankShows(generalSaleShows).map(toRankingShow);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader
        locale={locale}
        dict={dict.header}
        mobileNavDict={dict.mobileNav}
        commonDict={dict.common}
        languageSwitcherDict={dict.languageSwitcher}
        languageComingSoonLabel={dict.common.languageComingSoon}
      />
      <main className="flex-1">
        <HomeHeroSection dict={dict} />
        <RealtimeTop10Section items={topRankings} dict={dict} />
        <TicketOpenSection dict={dict} locale={locale} />
        <OfficialResaleSection dict={dict} />
        <GenreRecommendationsSection dict={dict} />
        <EditorialEventsSection dict={dict} />
        <ShortcutsSection dict={dict} />
        <GroupBookingBanner dict={dict} />
      </main>
      <SiteFooter dict={dict.footer} showBusinessInformation={locale === "ko"} />
      <FloatingSide />
    </div>
  );
}
