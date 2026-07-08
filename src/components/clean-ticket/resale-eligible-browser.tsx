"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, Search, ShieldCheck } from "lucide-react";
import type { TicketShow } from "@/types";
import { currency } from "@/data/ticketing";
import { cn } from "@/lib/utils";
import { getState, type ApiResalePool, type ApiTicket } from "@/lib/ticketground-api";

type ResaleEligibleBrowserProps = {
  readonly shows: readonly TicketShow[];
};

type ResaleListing = {
  readonly pool: ApiResalePool;
  readonly ticket: ApiTicket;
  readonly show: TicketShow;
};

const categoryOrder: readonly TicketShow["category"][] = ["콘서트", "뮤지컬", "연극", "클래식", "전시/행사", "아동/가족", "스포츠"];

export function ResaleEligibleBrowser({ shows }: ResaleEligibleBrowserProps) {
  const [listings, setListings] = useState<readonly ResaleListing[]>([]);
  const [status, setStatus] = useState("등록된 양도 티켓을 불러오는 중입니다.");
  const [category, setCategory] = useState<TicketShow["category"] | "전체">("전체");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let mounted = true;
    const showBySlug = new Map(shows.map((show) => [show.slug, show]));
    getState()
      .then((state) => {
        if (!mounted) return;
        const ticketById = new Map(state.tickets.map((ticket) => [ticket.id, ticket]));
        const openListings: ResaleListing[] = [];
        for (const pool of state.resalePools) {
          if (pool.status !== "OPEN" || !pool.showSlug) continue;
          const show = showBySlug.get(pool.showSlug);
          const ticket = ticketById.get(pool.ticketId);
          if (show && ticket) openListings.push({ pool, ticket, show });
        }
        setListings(openListings);
        setStatus(openListings.length ? `${openListings.length}건의 양도 티켓이 등록되어 있습니다.` : "현재 등록된 양도 티켓이 없습니다.");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setStatus(error instanceof Error ? error.message : "양도 티켓을 불러오지 못했습니다.");
      });
    return () => {
      mounted = false;
    };
  }, [shows]);

  const categories = useMemo(
    () => categoryOrder.filter((item) => listings.some((listing) => listing.show.category === item)),
    [listings],
  );

  const lowestPriceByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const listing of listings) {
      const current = map.get(listing.show.category);
      if (current === undefined || listing.pool.price < current) map.set(listing.show.category, listing.pool.price);
    }
    return map;
  }, [listings]);

  const visibleListings = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return listings.filter((listing) => {
      const matchesCategory = category === "전체" || listing.show.category === category;
      const matchesQuery =
        !normalized ||
        [listing.show.title, listing.show.shortTitle, listing.show.venue].some((value) => value.toLowerCase().includes(normalized));
      return matchesCategory && matchesQuery;
    });
  }, [listings, category, query]);

  return (
    <section className="ticketground-container py-10">
      <div className="flex flex-col gap-5 border-b border-line pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-black text-ticketground">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
            CLEAN TICKET
          </p>
          <h1 className="balanced-title mt-2 text-[32px] font-black leading-tight text-ink sm:text-5xl">양도 허용 티켓</h1>
          <p className="mt-3 max-w-[760px] text-base leading-relaxed text-ink-3">
            판매자가 Tig 공식 풀에 실제로 등록한 양도 티켓만 모았습니다. {status}
          </p>
        </div>
        <Link
          href="/mypage/resale"
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-5 text-sm font-black text-on-ink shadow-ticket-2 transition-colors hover:bg-ink-2 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <RefreshCcw className="size-4 shrink-0" aria-hidden />
          내 티켓 양도하기
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="공연 카테고리" className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={category === "전체"}
            onClick={() => setCategory("전체")}
            className={cn(
              "h-9 rounded-full border px-4 text-sm font-black transition focus-visible:ring-3 focus-visible:ring-ring/50",
              category === "전체" ? "border-ink bg-ink text-on-ink" : "border-line bg-card text-ink-2 hover:border-line-strong",
            )}
          >
            전체 {listings.length}
          </button>
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
              className={cn(
                "h-9 rounded-full border px-4 text-sm font-black transition focus-visible:ring-3 focus-visible:ring-ring/50",
                category === item ? "border-ink bg-ink text-on-ink" : "border-line bg-card text-ink-2 hover:border-line-strong",
              )}
            >
              {item} {listings.filter((listing) => listing.show.category === item).length}
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-[260px]">
          <span className="sr-only">공연명, 공연장 검색</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="공연명, 공연장 검색"
            className="h-10 w-full rounded-full border border-line bg-card pl-9 pr-4 text-sm font-bold text-ink outline-none transition-colors placeholder:text-ink-4 focus-visible:border-line-strong focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
      </div>

      <p className="mt-5 text-sm font-black text-ink-3">총 {visibleListings.length}건</p>

      {visibleListings.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleListings.map((listing) => (
            <ResaleListingTile
              key={listing.pool.id}
              listing={listing}
              isLowest={lowestPriceByCategory.get(listing.show.category) === listing.pool.price}
            />
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-lg border border-line bg-card p-8 text-center text-sm font-bold text-ink-3">
          현재 등록된 양도 티켓이 없습니다.
        </p>
      )}
    </section>
  );
}

function ResaleListingTile({ listing, isLowest }: { readonly listing: ResaleListing; readonly isLowest: boolean }) {
  const { pool, ticket, show } = listing;

  return (
    <Link
      href="/mypage/resale"
      className="group grid min-w-0 gap-4 rounded-lg border border-line bg-card p-4 transition hover:border-line-strong hover:shadow-ticket-2 focus-visible:ring-3 focus-visible:ring-ring/50 xl:grid-cols-[120px_1fr]"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-surface-2 xl:w-[120px]">
        {isLowest && (
          <span className="absolute left-1.5 top-1.5 z-10 rounded bg-ticketground px-1.5 py-0.5 text-[10px] font-black text-white">
            최저가
          </span>
        )}
        <Image
          src={show.poster}
          alt={show.title}
          fill
          sizes="(min-width: 1280px) 120px, (min-width: 640px) 25vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-ticketground px-2 py-1 text-xs font-black text-white">{show.badge ?? "양도중"}</span>
          <span className="text-sm font-black text-ink-3">{show.category}</span>
        </div>
        <h2 className="balanced-title mt-2 clamp-2 break-words text-sm font-black leading-snug text-ink-2 group-hover:underline">
          {show.title}
        </h2>
        <p className="mt-2 text-sm text-ink-3">
          {show.venue} · {ticket.seatLabel}
        </p>
        <p className="mt-1 text-sm text-ink-4">{show.period}</p>
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-bold text-ink-4">정가 {currency(ticket.faceValue)}</span>
          <span className="text-base font-black text-ink">양도가격 {currency(pool.price)}</span>
        </p>
      </div>
    </Link>
  );
}
