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
  연극: "/contents/genre/musical",
  클래식: "/contents/genre/musical",
  전시: "/contents/genre/exhibition",
  아동: "/contents/genre/exhibition",
  스포츠: "/contents/genre/sports",
  랭킹: "/contents/ranking",
  "티켓오픈 캘린더": "/open",
  지역별: "/contents/region",
  공연장: "/place",
};

function SearchBar({ className }: { className?: string }) {
  return (
    <Link
      href="/contents/search"
      className={cn(
        "flex h-10 items-center gap-2 rounded-full border border-line bg-white pl-5 pr-3",
        "transition-colors hover:border-line-strong focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className="flex-1 truncate text-sm text-ink-3">공연명, 아티스트, 공연장 검색</span>
      <SearchIcon className="size-5 text-ink" />
    </Link>
  );
}

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 110);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="relative z-50 w-full bg-white text-ink">
      <div className="border-b border-line bg-surface">
        <div className="ticketground-container flex h-8 items-center justify-end gap-4 text-[13px] font-bold text-ink-3">
          {utilityLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50">
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="ticketground-container flex h-[64px] items-center gap-3 overflow-hidden sm:gap-8">
        <Link href="/" className="flex shrink-0 items-center gap-1 text-[22px] font-black tracking-normal text-ink sm:text-[25px]">
          Ticketground
          <span className="mt-1 size-2 rounded-full bg-ticketground" aria-hidden />
        </Link>
        <SearchBar className="hidden w-full max-w-[460px] shrink sm:flex" />
        <nav aria-label="빠른 메뉴" className="ml-auto flex shrink-0 items-center gap-3 sm:gap-5">
          {iconLinks.map(({ label, href, Icon }) => (
            <Link
              key={label}
              href={href}
              className="grid min-w-10 justify-items-center gap-1 text-[12px] font-bold text-ink-2 hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-w-12 sm:text-[13px]"
            >
              <Icon className="size-[22px]" />
              {label}
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
        <div className="ticketground-container flex h-12 items-center gap-4 overflow-hidden text-[15px] md:gap-7">
          <nav aria-label="카테고리" className="no-scrollbar flex min-w-0 flex-1 items-center gap-6 overflow-x-auto md:gap-7">
            {categoryNav.map((c) => (
              <Link
                key={c}
                href={categoryHrefs[c] ?? "/contents/search"}
                className="whitespace-nowrap font-bold text-ink-2 hover:text-ticketground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {c}
              </Link>
            ))}
          </nav>
          <div className={cn("hidden flex-1 transition-opacity duration-200 lg:block", scrolled ? "opacity-100" : "pointer-events-none opacity-0")}>
            <SearchBar className="mx-auto max-w-[420px]" />
          </div>
          <nav aria-label="티켓오픈" className="ml-auto hidden shrink-0 items-center gap-5 md:flex">
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
