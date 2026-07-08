"use client";

import { useState } from "react";
import Link from "next/link";
import { CarouselRow } from "@/components/carousel-row";
import { cn } from "@/lib/utils";
import { GradientPoster } from "./home-cards";
import type { Recommendation, RecommendationGroup } from "./home-content";

function GenreItemCard({ item, index }: { readonly item: Recommendation; readonly index: number }) {
  return (
    <Link
      href={item.href}
      data-card="genre-recommendation"
      className="group block min-w-0 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="relative">
        <GradientPoster title={item.title} gradient={item.gradient} poster={item.poster} fit={item.posterFit} priority={index === 0} />
        <span
          className="pointer-events-none absolute bottom-1 left-1.5 text-4xl font-black italic leading-none text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.55)] sm:text-5xl"
          aria-hidden="true"
        >
          {index + 1}
        </span>
      </div>
      <h4 className="clamp-2 mt-3 text-sm font-black leading-snug text-ink-2 group-hover:underline sm:text-base">{item.title}</h4>
      <p className="clamp-1 mt-1 text-sm text-ink-3">{item.venue}</p>
      <p className="mt-1 text-sm text-ink-4">{item.date}</p>
    </Link>
  );
}

export function GenreRecommendationsTabs({ groups }: { readonly groups: readonly RecommendationGroup[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeGroup = groups[activeIndex];

  return (
    <div>
      <div role="tablist" aria-label="장르별 추천 탭" className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {groups.map((group, index) => (
          <button
            key={group.title}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            onClick={() => setActiveIndex(index)}
            className={cn(
              "h-10 shrink-0 rounded-full px-4 text-sm font-black transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              index === activeIndex
                ? "bg-ink text-on-ink"
                : "border border-line bg-card text-ink-2 hover:border-line-strong",
            )}
          >
            {group.title}
          </button>
        ))}
      </div>
      {activeGroup.items.length === 0 ? (
        <p className="mt-6 rounded-lg border border-line bg-card p-8 text-center text-sm font-bold text-ink-3">
          {activeGroup.title} 공연을 준비 중입니다.
        </p>
      ) : (
        <div role="tabpanel" className="mt-6">
          <div className="lg:hidden">
            <CarouselRow className="min-w-0 pb-1">
              {activeGroup.items.map((item, index) => (
                <div key={item.title} className="w-[136px] shrink-0 sm:w-[160px]">
                  <GenreItemCard item={item} index={index} />
                </div>
              ))}
            </CarouselRow>
          </div>
          <div className="hidden lg:grid lg:grid-cols-5 lg:gap-4">
            {activeGroup.items.map((item, index) => (
              <GenreItemCard key={item.title} item={item} index={index} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
