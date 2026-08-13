"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Baby, CalendarDays, Drama, Home, Image as ImageIcon, Mic2, Music2, RefreshCcw, Theater, Trophy, type LucideIcon } from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSessionAuth } from "@/lib/use-session-auth";
import { categoryNav, categoryNavHighlight } from "@/data/content";
import { categoryHrefs, highlightCategoryHrefs, loginLink, publicIconLinks, signedInIconLinks, signedInUtilityLinks, signupLink, utilityLinksBeforeAuth, type CategoryId, type HighlightCategoryId } from "@/components/header-links";
import { MobileNav } from "@/components/mobile-nav";
import { SiteSearchBar } from "@/components/site-search-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BrandLogo } from "@/components/brand-logo";
import { dictionary as koDictionary } from "@/i18n/dictionaries/ko";
import type { Dictionary } from "@/i18n/get-dictionary";
import { defaultLocale, type Locale } from "@/i18n/config";
import { localizeHref, stripLocalePrefix } from "@/i18n/routing";

const utilityLinkClassName = "hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50";
const desktopActionIcons: Record<HighlightCategoryId, LucideIcon> = {
  resale: RefreshCcw,
  calendar: CalendarDays,
};
const categoryNavIcons: Record<CategoryId | HighlightCategoryId, LucideIcon> = {
  home: Home,
  concert: Mic2,
  musical: Theater,
  theater: Drama,
  classical: Music2,
  exhibition: ImageIcon,
  kids: Baby,
  sports: Trophy,
  resale: RefreshCcw,
  calendar: CalendarDays,
};

function HeaderAuthLinks({
  signedIn,
  signOut,
  dict,
  locale,
}: {
  readonly signedIn: boolean;
  readonly signOut: () => void;
  readonly dict: Dictionary["header"];
  readonly locale: Locale;
}) {
  if (!signedIn) {
    return (
      <>
        <Link href={localizeHref(locale, loginLink.href)} className={utilityLinkClassName}>
          {dict.login}
        </Link>
        <Link href={localizeHref(locale, signupLink.href)} className={utilityLinkClassName}>
          {dict.signup}
        </Link>
      </>
    );
  }

  return (
    <>
      {signedInUtilityLinks.map((link) => (
        <Link key={link.href} href={localizeHref(locale, link.href)} className={utilityLinkClassName}>
          {dict.utilityMy}
        </Link>
      ))}
      <button type="button" className={utilityLinkClassName} onClick={signOut}>
        {dict.logout}
      </button>
    </>
  );
}

function MobileHeaderAuthControl({
  signedIn,
  signOut,
  dict,
  locale,
}: {
  readonly signedIn: boolean;
  readonly signOut: () => void;
  readonly dict: Dictionary["header"];
  readonly locale: Locale;
}) {
  const className =
    "inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-line bg-card px-3 text-xs font-black text-ink transition-colors hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50 sm:hidden";

  if (signedIn) {
    return (
      <button type="button" className={className} onClick={signOut}>
        {dict.logout}
      </button>
    );
  }

  return (
    <Link href={localizeHref(locale, loginLink.href)} className={className}>
      {dict.login}
    </Link>
  );
}

const iconLinkLabel = (id: string, dict: Dictionary["header"]): string => {
  if (id === "watchlist") return dict.watchlist;
  if (id === "reservations") return dict.reservations;
  return dict.utilityMy;
};

type SiteHeaderProps = {
  readonly showSearchBar?: boolean;
  readonly locale?: Locale;
  readonly dict?: Dictionary["header"];
  readonly mobileNavDict?: Dictionary["mobileNav"];
  readonly commonDict?: Dictionary["common"];
  readonly languageSwitcherDict?: Dictionary["languageSwitcher"];
  readonly languageComingSoonLabel?: string;
};

export function SiteHeader({
  showSearchBar = true,
  locale = defaultLocale,
  dict = koDictionary.header,
  mobileNavDict = koDictionary.mobileNav,
  commonDict = koDictionary.common,
  languageSwitcherDict = koDictionary.languageSwitcher,
  languageComingSoonLabel = koDictionary.common.languageComingSoon,
}: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const { signedIn, signOut } = useSessionAuth();
  const visibleIconLinks = signedIn ? [...publicIconLinks, ...signedInIconLinks] : [];
  const desktopOnlyIconHrefs = new Set<string>(signedInIconLinks.map((link) => link.href));
  const pathname = usePathname();
  const categoryLabels: Record<CategoryId | HighlightCategoryId, string> = { ...dict.categories, ...dict.highlightCategories };
  const barePathname = stripLocalePrefix(pathname);
  const isActiveCategory = (id: CategoryId) => {
    const href = categoryHrefs[id];
    if (!href) return false;
    return href === "/" ? barePathname === "/" : barePathname.startsWith(href);
  };

  useLayoutEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 110);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="relative z-50 w-full bg-background text-ink">
      <div className="hidden border-b border-line bg-surface sm:block">
        <div className="ticketground-container flex h-8 items-center justify-end gap-4 text-sm font-bold text-ink-3">
          {utilityLinksBeforeAuth.map((link) => (
            link.external ? (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={utilityLinkClassName}>
                카카오톡 문의
              </a>
            ) : (
              <Link key={link.href} href={localizeHref(locale, link.href)} className={utilityLinkClassName}>
                {dict.utilityHelp}
              </Link>
            )
          ))}
          <HeaderAuthLinks signedIn={signedIn} signOut={signOut} dict={dict} locale={locale} />
          <LanguageSwitcher
            currentLocale={locale}
            label={languageSwitcherDict.label}
            names={languageSwitcherDict.names}
            comingSoonLabel={languageComingSoonLabel}
          />
          <ThemeToggle lightLabel={commonDict.themeToggleLight} darkLabel={commonDict.themeToggleDark} />
        </div>
      </div>

      <div className="ticketground-container flex h-auto flex-wrap items-center gap-x-3 gap-y-3 py-3 md:h-[64px] md:flex-nowrap md:gap-8 md:py-0">
        <Link href={localizeHref(locale, "/")} aria-label="Ticketground" className="flex shrink-0 items-center">
          <BrandLogo priority />
        </Link>
        {showSearchBar && (
          <SiteSearchBar
            key={`primary-${pathname}`}
            className="order-3 w-full max-w-none shrink-0 md:order-none md:max-w-[460px] md:shrink"
            ariaLabel={commonDict.searchPlaceholder}
            buttonLabel={commonDict.searchButtonLabel}
          />
        )}
        <nav aria-label={dict.ariaQuickMenu} className="ml-auto flex shrink-0 items-center gap-2 md:gap-5">
          {visibleIconLinks.map(({ id, href, Icon }) => (
            <Link
              key={href}
              href={localizeHref(locale, href)}
              aria-label={iconLinkLabel(id, dict)}
              className={cn(
                "grid min-w-[42px] justify-items-center gap-0.5 whitespace-nowrap text-[11px] font-bold text-ink-2 hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50 md:min-w-12 md:gap-1 md:text-sm",
                desktopOnlyIconHrefs.has(href) && "hidden sm:grid",
              )}
            >
              <Icon className="size-[22px]" />
              <span>{iconLinkLabel(id, dict)}</span>
            </Link>
          ))}
        </nav>
        <MobileHeaderAuthControl signedIn={signedIn} signOut={signOut} dict={dict} locale={locale} />
        <MobileNav
          className="sm:hidden"
          dict={dict}
          mobileNavDict={mobileNavDict}
          commonDict={commonDict}
          locale={locale}
          languageSwitcherDict={languageSwitcherDict}
          languageComingSoonLabel={languageComingSoonLabel}
        />
      </div>

      <div
        className={cn(
          "sticky top-0 z-50 border-y border-line bg-background transition-shadow",
          scrolled && "shadow-ticket-1",
        )}
      >
        <div className="ticketground-container flex items-center gap-3 py-1.5 text-sm sm:h-12 sm:gap-5 sm:py-0 sm:text-base">
          <nav aria-label={dict.ariaCategoryNav} className="grid grow grid-cols-5 gap-x-1 gap-y-1.5 sm:hidden">
            {[...categoryNav, ...categoryNavHighlight].map((c) => {
              const Icon = categoryNavIcons[c] ?? Home;
              const highlighted = (categoryNavHighlight as readonly string[]).includes(c);
              const active = !highlighted && isActiveCategory(c as CategoryId);
              const href = highlighted ? highlightCategoryHrefs[c as HighlightCategoryId] : categoryHrefs[c as CategoryId];
              return (
                <Link
                  key={c}
                  href={localizeHref(locale, href ?? "/contents/search")}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "text-ticketground" : "text-ink-2 hover:text-ticketground",
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className={cn("clamp-1 text-[11px] font-bold leading-none", active && "underline underline-offset-4")}>
                    {c === "calendar" ? dict.calendarMobileLabel : categoryLabels[c]}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="relative hidden min-w-0 flex-1 sm:block">
            <nav aria-label={dict.ariaCategoryNav} className="no-scrollbar flex min-w-0 items-center justify-center-safe gap-5 overflow-x-auto">
              {categoryNav.map((c) => (
                <Link
                  key={c}
                  href={localizeHref(locale, categoryHrefs[c] ?? "/contents/search")}
                  className={cn(
                    "whitespace-nowrap font-bold hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50",
                    c !== "home" && isActiveCategory(c) ? "text-ticketground underline underline-offset-4" : "text-ink-2",
                  )}
                >
                  {categoryLabels[c]}
                </Link>
              ))}
            </nav>
          </div>
          {showSearchBar && (
            <div
              className={cn(
                "hidden transition-[flex-grow,flex-shrink,opacity] duration-200 lg:block",
                scrolled ? "flex-1 opacity-100" : "flex-none basis-0 overflow-hidden pointer-events-none opacity-0",
              )}
            >
              <SiteSearchBar
                key={`sticky-${pathname}`}
                className="mx-auto max-w-[420px]"
                keyboardReachable={scrolled}
                ariaLabel={commonDict.searchPlaceholder}
                buttonLabel={commonDict.searchButtonLabel}
              />
            </div>
          )}
          <nav aria-label={dict.ariaTicketOpenNav} className="ml-auto hidden shrink-0 items-center gap-5 sm:flex">
            {categoryNavHighlight.map((c) => {
              const ActionIcon = desktopActionIcons[c] ?? CalendarDays;
              const isResale = c === "resale";
              return (
                <Link
                  key={c}
                  href={localizeHref(locale, highlightCategoryHrefs[c] ?? "/open")}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-sm font-black shadow-ticket-1 transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                    isResale
                      ? "border-accent-2 bg-accent-2 text-[#3A2929] hover:bg-accent-2/85"
                      : "border-line bg-card text-ink hover:border-ticketground hover:bg-ticketground hover:text-white",
                  )}
                >
                  <ActionIcon className="size-4 shrink-0" aria-hidden />
                  <span>{isResale ? dict.resaleDesktopLabel : categoryLabels[c]}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
