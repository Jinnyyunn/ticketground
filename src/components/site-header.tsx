"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { categoryNav, categoryNavHighlight } from "@/data/content";
import { SearchIcon, StarIcon, TicketIcon, UserIcon } from "@/components/icons";

const utilityLinks = [
  { label: "고객센터", href: "/help" },
  { label: "마이", href: "/mypage" },
  { label: "로그인", href: "/login" },
  { label: "회원가입", href: "/signup" },
] as const;

const iconLinks = [
  { label: "관심공연", href: "/watchlist", Icon: StarIcon },
  { label: "예매내역", href: "/mypage#reservations", Icon: TicketIcon },
  { label: "마이", href: "/mypage", Icon: UserIcon },
] as const;

const categoryHrefs: Record<string, string> = {
  홈: "/",
  뮤지컬: "/contents/genre/musical",
  콘서트: "/contents/genre/concert",
  연극: "/contents/genre/theater",
  클래식: "/contents/genre/classic",
  전시: "/contents/genre/exhibition",
  아동: "/contents/genre/children",
  스포츠: "/contents/genre/sports",
  랭킹: "/contents/ranking",
  "티켓오픈 캘린더": "/open",
  "티켓 재판매": "/resale",
  지역별: "/contents/region",
  공연장: "/place",
};

function SearchBar({ className }: { className?: string }) {
  return (
    <Link
      href="/contents/search"
      className={cn(
        "flex h-10 min-w-0 items-center gap-2 rounded-full border border-line bg-white pl-5 pr-3",
        "transition-colors hover:border-line-strong focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className="flex-1 truncate text-sm text-ink-3">공연명, 아티스트, 공연장 검색</span>
      <SearchIcon className="size-5 text-ink" />
    </Link>
  );
}

type SiteHeaderProps = {
  readonly showSearchBar?: boolean;
};

export function SiteHeader({ showSearchBar = true }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 110);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="relative z-50 w-full bg-white text-ink">
      <div className="hidden border-b border-line bg-surface sm:block">
        <div className="ticketground-container flex h-8 items-center justify-end gap-4 text-[13px] font-bold text-ink-3">
          {utilityLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50">
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="ticketground-container flex h-auto flex-wrap items-center gap-x-3 gap-y-3 py-3 md:h-[64px] md:flex-nowrap md:gap-8 md:py-0">
        <Link href="/" className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[22px] font-black tracking-normal text-ink md:text-[25px]">
          Ticketground
          <span className="mt-1 size-2 rounded-full bg-ticketground" aria-hidden />
        </Link>
        {showSearchBar && <SearchBar className="order-3 w-full max-w-none shrink-0 md:order-none md:max-w-[460px] md:shrink" />}
        <nav aria-label="빠른 메뉴" className="ml-auto flex shrink-0 items-center gap-2 md:gap-5">
          {iconLinks.map(({ label, href, Icon }) => (
            <Link
              key={label}
              href={href}
              aria-label={label}
              className="grid min-w-[42px] justify-items-center gap-0.5 whitespace-nowrap text-[11px] font-bold text-ink-2 hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50 md:min-w-12 md:gap-1 md:text-[13px]"
            >
              <Icon className="size-[22px]" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div
        className={cn(
          "sticky top-0 z-50 border-y border-line bg-white transition-shadow",
          scrolled && "shadow-ticket-1",
        )}
      >
        <div className="ticketground-container flex h-11 items-center gap-4 text-[14px] sm:h-12 sm:gap-7 sm:text-[15px]">
          <nav aria-label="카테고리" className="no-scrollbar flex min-w-0 flex-1 items-center gap-5 overflow-x-auto sm:gap-7">
            {categoryNav.map((c) => (
              <Link
                key={c}
                href={categoryHrefs[c] ?? "/contents/search"}
                className="whitespace-nowrap font-bold text-ink-2 hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {c}
              </Link>
            ))}
            {categoryNavHighlight.map((c) => (
              <Link
                key={c}
                href={categoryHrefs[c] ?? "/open"}
                className="whitespace-nowrap font-black text-ticketground hover:text-ticketground-strong focus-visible:ring-3 focus-visible:ring-ring/50 sm:hidden"
              >
                {c}
              </Link>
            ))}
          </nav>
          {showSearchBar && (
            <div className={cn("hidden flex-1 transition-opacity duration-200 lg:block", scrolled ? "opacity-100" : "pointer-events-none opacity-0")}>
              <SearchBar className="mx-auto max-w-[420px]" />
            </div>
          )}
          <nav aria-label="티켓오픈" className="ml-auto hidden shrink-0 items-center gap-5 sm:flex">
            {categoryNavHighlight.map((c) => (
              <Link
                key={c}
                href={categoryHrefs[c] ?? "/open"}
                className="whitespace-nowrap font-black text-ticketground hover:text-ticketground-strong focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {c}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
