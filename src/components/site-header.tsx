"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Baby, CalendarDays, Drama, Home, Image as ImageIcon, Mic2, Music2, RefreshCcw, Theater, Trophy, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useSessionAuth } from "@/lib/use-session-auth";
import { categoryNav, categoryNavHighlight } from "@/data/content";
import { categoryHrefs, loginLink, publicIconLinks, signedInIconLinks, signedInUtilityLinks, signupLink, utilityLinksBeforeAuth } from "@/components/header-links";
import { MobileNav } from "@/components/mobile-nav";
import { SiteSearchBar } from "@/components/site-search-bar";
import { ThemeToggle } from "@/components/theme-toggle";

const utilityLinkClassName = "hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50";
const desktopActionIcons: Record<string, LucideIcon> = {
  "티켓 양도": RefreshCcw,
  "티켓오픈 캘린더": CalendarDays,
};
const categoryNavIcons: Record<string, LucideIcon> = {
  홈: Home,
  콘서트: Mic2,
  뮤지컬: Theater,
  연극: Drama,
  클래식: Music2,
  전시: ImageIcon,
  아동: Baby,
  스포츠: Trophy,
  "티켓 양도": RefreshCcw,
  "티켓오픈 캘린더": CalendarDays,
};
const categoryNavMobileLabels: Record<string, string> = {
  "티켓오픈 캘린더": "캘린더",
};
const categoryNavDesktopHighlightLabels: Record<string, string> = {
  "티켓 양도": "CLEAN 티켓 공식 양도",
};

function HeaderAuthLinks({ signedIn, signOut }: { readonly signedIn: boolean; readonly signOut: () => void }) {
  if (!signedIn) {
    return (
      <>
        <Link href={signupLink.href} className={utilityLinkClassName}>
          {signupLink.label}
        </Link>
        <Link
          href={loginLink.href}
          className="inline-flex h-7 items-center rounded-full border-2 border-ink bg-ticketground px-3.5 text-xs font-black text-ink shadow-[2px_2px_0_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
        >
          {loginLink.label}
        </Link>
      </>
    );
  }

  return (
    <>
      {signedInUtilityLinks.map((link) => (
        <Link key={link.href} href={link.href} className={utilityLinkClassName}>
          {link.label}
        </Link>
      ))}
      <button type="button" className={utilityLinkClassName} onClick={signOut}>
        로그아웃
      </button>
    </>
  );
}

function MobileHeaderAuthControl({ signedIn, signOut }: { readonly signedIn: boolean; readonly signOut: () => void }) {
  const className =
    "inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-line bg-card px-3 text-xs font-black text-ink transition-colors hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50 sm:hidden";

  if (signedIn) {
    return (
      <button type="button" className={className} onClick={signOut}>
        로그아웃
      </button>
    );
  }

  return (
    <Link href={loginLink.href} className={className}>
      {loginLink.label}
    </Link>
  );
}

type SiteHeaderProps = {
  readonly showSearchBar?: boolean;
};

export function SiteHeader({ showSearchBar = true }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const { signedIn, signOut } = useSessionAuth();
  const visibleIconLinks = signedIn ? [...publicIconLinks, ...signedInIconLinks] : [];
  const desktopOnlyIconHrefs = new Set<string>(signedInIconLinks.map((link) => link.href));
  const pathname = usePathname();
  const isActiveCategory = (label: string) => {
    const href = categoryHrefs[label];
    if (!href) return false;
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  };

  useEffect(() => {
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
            <Link key={link.href} href={link.href} className={utilityLinkClassName}>
              {link.label}
            </Link>
          ))}
          <HeaderAuthLinks signedIn={signedIn} signOut={signOut} />
          <ThemeToggle />
        </div>
      </div>

      <div className="ticketground-container flex h-auto flex-wrap items-center gap-x-3 gap-y-3 py-3 md:h-[64px] md:flex-nowrap md:gap-8 md:py-0">
        <Link href="/" className="flex shrink-0 items-center gap-1 whitespace-nowrap text-2xl font-black tracking-normal text-ink md:text-[25px]">
          Ticketground
          <span className="mt-1 size-2 rounded-full bg-ticketground" aria-hidden />
        </Link>
        {showSearchBar && <SiteSearchBar key={`primary-${pathname}`} className="order-3 w-full max-w-none shrink-0 md:order-none md:max-w-[460px] md:shrink" />}
        <nav aria-label="빠른 메뉴" className="ml-auto flex shrink-0 items-center gap-2 md:gap-5">
          {visibleIconLinks.map(({ label, href, Icon }) => (
            <Link
              key={label}
              href={href}
              aria-label={label}
              className={cn(
                "grid min-w-[42px] justify-items-center gap-0.5 whitespace-nowrap text-[11px] font-bold text-ink-2 hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50 md:min-w-12 md:gap-1 md:text-sm",
                desktopOnlyIconHrefs.has(href) && "hidden sm:grid",
              )}
            >
              <Icon className="size-[22px]" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <MobileHeaderAuthControl signedIn={signedIn} signOut={signOut} />
        <MobileNav className="sm:hidden" />
      </div>

      <div
        className={cn(
          "sticky top-0 z-50 border-y-[3px] border-ink bg-background transition-shadow",
          scrolled && "shadow-ticket-1",
        )}
      >
        <div className="ticketground-container flex items-center gap-3 py-1.5 text-sm sm:h-12 sm:gap-5 sm:py-0 sm:text-base">
          <nav aria-label="카테고리" className="grid grow grid-cols-5 gap-x-1 gap-y-1.5 sm:hidden">
            {[...categoryNav, ...categoryNavHighlight].map((c) => {
              const Icon = categoryNavIcons[c] ?? Home;
              const highlighted = categoryNavHighlight.includes(c);
              const active = isActiveCategory(c);
              return (
                <Link
                  key={c}
                  href={categoryHrefs[c] ?? (highlighted ? "/open" : "/contents/search")}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "text-ticketground" : "text-ink-2 hover:text-ticketground",
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className={cn("clamp-1 text-[11px] font-bold leading-none", active && "underline underline-offset-4")}>
                    {categoryNavMobileLabels[c] ?? c}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="relative hidden min-w-0 flex-1 sm:block">
            <nav aria-label="카테고리" className="no-scrollbar flex min-w-0 items-center gap-5 overflow-x-auto">
              {categoryNav.map((c) => (
                <Link
                  key={c}
                  href={categoryHrefs[c] ?? "/contents/search"}
                  className={cn(
                    "whitespace-nowrap font-bold hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50",
                    c !== "홈" && isActiveCategory(c) ? "text-ticketground underline underline-offset-4" : "text-ink-2",
                  )}
                >
                  {c}
                </Link>
              ))}
            </nav>
          </div>
          {showSearchBar && (
            <div className={cn("hidden flex-1 transition-opacity duration-200 lg:block", scrolled ? "opacity-100" : "pointer-events-none opacity-0")}>
              <SiteSearchBar key={`sticky-${pathname}`} className="mx-auto max-w-[420px]" keyboardReachable={scrolled} />
            </div>
          )}
          <nav aria-label="티켓오픈" className="ml-auto hidden shrink-0 items-center gap-5 sm:flex">
            {categoryNavHighlight.map((c) => {
              const ActionIcon = desktopActionIcons[c] ?? CalendarDays;
              const isResale = c === "티켓 양도";
              return (
                <Link
                  key={c}
                  href={categoryHrefs[c] ?? "/open"}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-ink px-3 text-sm font-black transition-transform focus-visible:ring-3 focus-visible:ring-ring/50",
                    isResale
                      ? "bg-accent-2 text-on-accent-2 shadow-ticket-pop hover:-translate-y-0.5"
                      : "bg-card text-ink hover:bg-surface",
                  )}
                >
                  <ActionIcon className="size-4 shrink-0" aria-hidden />
                  <span>{categoryNavDesktopHighlightLabels[c] ?? c}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
