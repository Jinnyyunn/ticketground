"use client";

import Image from "next/image";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { WatchlistToggleButton } from "./watchlist-toggle-button";

export type WatchShow = {
  readonly slug: string;
  readonly title: string;
  readonly venue: string;
  readonly category: string;
  readonly poster: string;
  readonly posterFit?: "cover" | "contain";
  readonly openLabel: string;
  readonly dDayLabel: string;
  readonly defaultEnabled: boolean;
};

export function WatchlistShowCard({
  enabled,
  onRecordNotification,
  onToggle,
  show,
}: {
  readonly enabled: boolean;
  readonly onRecordNotification: () => void;
  readonly onToggle: () => void;
  readonly show: WatchShow;
}) {
  return (
    <article className="rounded-lg border border-line bg-white p-5 shadow-ticket-1">
      <div className="grid gap-4 sm:grid-cols-[112px_1fr] md:grid-cols-[128px_1fr]">
        <Link
          href={`/goods/${show.slug}`}
          aria-label={`${show.title} 상세보기`}
          className="group/poster relative block aspect-[16/9] overflow-hidden rounded-lg bg-surface-2 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:aspect-[3/4]"
        >
          <Image
            src={show.poster}
            alt={`${show.title} 포스터`}
            fill
            unoptimized
            sizes="(max-width: 639px) 100vw, 128px"
            className={cn(
              "transition-transform duration-300 group-hover/poster:scale-[1.03]",
              show.posterFit === "contain" ? "bg-surface object-contain" : "object-cover",
            )}
          />
        </Link>

        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface px-3 py-1 text-sm font-black text-ink-2">{show.category}</span>
              <span className="rounded-full bg-tint-red px-3 py-1 text-sm font-black text-ticketground">{show.dDayLabel}</span>
            </div>
            <h2 className="mt-3 text-[22px] font-black text-ink">{show.title}</h2>
            <p className="mt-2 text-sm text-ink-3">{show.venue}</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-bold text-ink-2">
              <CalendarDays className="size-4" aria-hidden />
              예매 오픈 {show.openLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <Link href={`/goods/${show.slug}`} className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-black text-ink hover:border-line-strong">
              상세보기
            </Link>
            <WatchlistToggleButton active={enabled} label={`${show.title} 알림`} onToggle={onToggle} />
            {enabled && (
              <button type="button" onClick={onRecordNotification} className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-black text-white">
                즉시 알림 기록
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
