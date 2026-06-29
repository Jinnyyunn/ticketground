"use client";

import { useMemo, useState } from "react";
import type { TicketShow } from "@/types";
import { currency } from "@/data/ticketing";
import { cn } from "@/lib/utils";
import { ShowTile } from "./show-tile";

type LayoutMode = "grid" | "list" | "magazine";
type SortMode = "popular" | "date" | "price";
type FilterMode = "전체" | "클린티켓" | "좌석우위";

type CategoryBrowserProps = {
  readonly label: string;
  readonly shows: readonly TicketShow[];
};

const layouts: readonly { readonly id: LayoutMode; readonly label: string }[] = [
  { id: "grid", label: "그리드" },
  { id: "list", label: "리스트" },
  { id: "magazine", label: "매거진" },
];

const filters: readonly FilterMode[] = ["전체", "클린티켓", "좌석우위"];

const sortOptions: readonly { readonly id: SortMode; readonly label: string }[] = [
  { id: "popular", label: "인기순" },
  { id: "date", label: "공연임박순" },
  { id: "price", label: "낮은가격순" },
];

function lowestPrice(show: TicketShow) {
  return Math.min(...show.prices.map((price) => price.price));
}

function toSortMode(value: string): SortMode {
  switch (value) {
    case "popular":
    case "date":
    case "price":
      return value;
    default:
      return "popular";
  }
}

export function CategoryBrowser({ label, shows }: CategoryBrowserProps) {
  const [layout, setLayout] = useState<LayoutMode>("grid");
  const [filter, setFilter] = useState<FilterMode>("전체");
  const [sort, setSort] = useState<SortMode>("popular");

  const visibleShows = useMemo(() => {
    const filtered = filter === "전체" ? shows : shows.filter((show) => show.badge === filter);
    return [...filtered].sort((left, right) => {
      switch (sort) {
        case "popular":
          return shows.indexOf(left) - shows.indexOf(right);
        case "date":
          return left.period.localeCompare(right.period, "ko-KR");
        case "price":
          return lowestPrice(left) - lowestPrice(right);
      }
    });
  }, [filter, shows, sort]);

  return (
    <section className="ticketground-container py-10">
      <div className="cat-head border-b border-line pb-7">
        <p className="text-sm font-black text-ticketground">Ticketground</p>
        <h1 className="mt-2 text-5xl font-black text-ink">{label} 예매</h1>
        <p className="mt-3 max-w-[760px] text-base leading-relaxed text-ink-3">
          공식 재판매와 동적 QR 정책이 연결된 대표 공연을 필터와 레이아웃으로 빠르게 비교합니다.
        </p>
      </div>

      <div className="filterbar mt-6 flex flex-wrap items-center gap-2">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
            className={cn(
              "h-9 rounded-full border px-4 text-sm font-black transition focus-visible:ring-3 focus-visible:ring-ring/50",
              filter === item ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2 hover:border-line-strong",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="toolbar mt-5 flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-black text-ink-3">총 {visibleShows.length}개 공연</p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="정렬"
            value={sort}
            onChange={(event) => setSort(toSortMode(event.target.value))}
            className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-black text-ink"
          >
            {sortOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-line bg-white p-1" aria-label="레이아웃">
            {layouts.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={layout === item.id}
                onClick={() => setLayout(item.id)}
                className={cn(
                  "h-8 rounded-md px-3 text-sm font-black transition focus-visible:ring-3 focus-visible:ring-ring/50",
                  layout === item.id ? "bg-ink text-white" : "text-ink-3 hover:text-ink",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        data-layout={layout}
        className={cn(
          "listing mt-8 gap-4",
          layout === "grid" && "grid sm:grid-cols-2 lg:grid-cols-4",
          layout === "list" && "grid",
          layout === "magazine" && "grid auto-rows-[220px] lg:grid-cols-6",
        )}
      >
        {visibleShows.map((show, index) =>
          layout === "magazine" ? (
            <a
              key={show.slug}
              href={`/goods/${show.slug}`}
              className={cn(
                "group relative overflow-hidden rounded-lg bg-ink text-white shadow-ticket-1 focus-visible:ring-3 focus-visible:ring-ring/50",
                index === 0 ? "lg:col-span-3 lg:row-span-2" : "lg:col-span-3",
              )}
            >
              <img src={show.poster} alt={show.title} className="absolute inset-0 size-full object-cover opacity-70 transition group-hover:scale-[1.03]" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/70 to-transparent p-5">
                <span className="text-sm font-black text-accent-2">{show.badge ?? show.category}</span>
                <h2 className="mt-2 clamp-2 text-2xl font-black leading-tight">{show.shortTitle}</h2>
                <p className="mt-2 text-sm text-white/80">{show.venue}</p>
                <p className="mt-3 text-sm font-black">최저 {currency(lowestPrice(show))}</p>
              </div>
            </a>
          ) : (
            <ShowTile key={show.slug} show={show} compact={layout === "list"} />
          ),
        )}
      </div>
    </section>
  );
}
