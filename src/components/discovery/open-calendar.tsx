"use client";

import Link from "next/link";
import { BellRing } from "lucide-react";
import { useState } from "react";
import type { TicketShow } from "@/types";
import { cn } from "@/lib/utils";
import { OpenAlertButton } from "./open-alert-button";

type OpenCalendarProps = {
  readonly shows: readonly TicketShow[];
};

const days = Array.from({ length: 31 }, (_, index) => index + 1);
const eventDays = new Set([1, 2, 4, 5, 7, 8, 10, 11, 13, 15, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31]);
const calendarGenres: readonly TicketShow["category"][] = ["뮤지컬", "콘서트", "연극", "클래식", "스포츠", "전시/행사", "아동/가족"];

const genreTone: Record<TicketShow["category"], string> = {
  뮤지컬: "bg-link text-white",
  콘서트: "bg-ticketground text-white",
  연극: "bg-ink text-on-ink",
  클래식: "bg-accent-2 text-on-accent-2",
  스포츠: "bg-warn text-white",
  "전시/행사": "bg-ok text-white",
  "아동/가족": "bg-accent-2 text-on-accent-2",
};

function showForDay(shows: readonly TicketShow[], day: number, hiddenGenres: ReadonlySet<TicketShow["category"]>) {
  if (!eventDays.has(day)) return undefined;
  const show = shows[(day * 3 + shows.length - 1) % shows.length];
  if (!show || hiddenGenres.has(show.category)) return undefined;
  return show;
}

export function OpenCalendar({ shows }: OpenCalendarProps) {
  const imminent = shows.slice(0, 5);
  const [hiddenGenres, setHiddenGenres] = useState<ReadonlySet<TicketShow["category"]>>(() => new Set());

  const toggleGenre = (genre: TicketShow["category"]) => {
    setHiddenGenres((current) => {
      const next = new Set(current);
      if (next.has(genre)) {
        next.delete(genre);
      } else {
        next.add(genre);
      }
      return next;
    });
  };

  return (
    <section className="ticketground-container py-10">
      <div className="flex flex-col gap-4 border-b border-line pb-7 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-ticketground">티켓오픈 캘린더</p>
          <h1 className="balanced-title mt-2 text-[32px] font-black leading-tight text-ink sm:text-5xl">2026년 7월 월별 캘린더</h1>
          <p className="mt-3 text-sm text-ink-3">장르 색상과 오픈 임박 리스트로 공식 예매 시간을 확인합니다.</p>
        </div>
        <Link href="/watchlist" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ticketground px-4 text-sm font-black text-white whitespace-nowrap transition-colors hover:bg-ink hover:text-on-ink focus-visible:ring-3 focus-visible:ring-ring/50">
          <BellRing className="size-4" aria-hidden />
          관심공연 알림
        </Link>
      </div>

      <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <h2 className="text-2xl font-black text-ink">월별 캘린더</h2>
          <div data-open-genre-legend className="mt-4 flex flex-wrap gap-2">
            {calendarGenres.map((genre) => {
              const hidden = hiddenGenres.has(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  aria-pressed={hidden}
                  data-open-genre-chip={genre}
                  data-open-genre-hidden={hidden ? "true" : "false"}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    hidden ? "border-line text-on-accent-2" : cn("border-transparent", genreTone[genre]),
                  )}
                  style={hidden ? { backgroundColor: "rgb(255, 255, 255)" } : undefined}
                  onClick={() => toggleGenre(genre)}
                >
                  {genre}
                </button>
              );
            })}
          </div>
          <div data-open-calendar-scroll className="no-scrollbar mt-4 overflow-x-auto rounded-lg border border-line bg-card">
            <div data-open-calendar-grid className="grid grid-cols-7 overflow-hidden md:min-w-[720px]">
              {["월", "화", "수", "목", "금", "토", "일"].map((day) => (
                <div key={day} className="border-b border-line bg-surface px-1.5 py-2 text-center text-xs font-black text-ink-3 sm:px-3 sm:text-sm">
                  {day}
                </div>
              ))}
              {days.map((day) => {
                const show = showForDay(shows, day, hiddenGenres);
                return (
                  <div key={day} data-open-day={day} className="min-h-[88px] min-w-0 border-b border-r border-line p-1.5 sm:min-h-[96px] sm:p-2 md:min-h-[116px] md:p-3 last:border-r-0">
                    <time className="text-sm font-black text-ink">{day}</time>
                    {show && (
                      <Link
                        href={`/goods/${show.slug}`}
                        data-allow-wrap="true"
                        data-open-show-category={show.category}
                        className={cn("clamp-2 mt-1.5 block rounded px-1 py-1 text-[10px] font-black leading-tight sm:px-1.5 sm:text-[11px] md:mt-3 md:px-2 md:text-xs", genreTone[show.category])}
                      >
                        {show.shortTitle}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-line bg-card p-5">
          <h2 className="text-2xl font-black text-ink">오픈 임박</h2>
          <div className="mt-4 grid gap-2 sm:gap-3">
            {imminent.map((show, index) => (
              <div key={show.slug} data-open-imminent-card className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-surface p-2 sm:grid-cols-[84px_minmax(0,1fr)_auto] sm:gap-3 sm:p-3">
                <time className="whitespace-nowrap text-[11px] font-black text-ticketground sm:text-xs">D-{index + 1} 14:00</time>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black text-ink">{show.shortTitle}</h3>
                  <p className="clamp-1 text-sm text-ink-3">{show.venue}</p>
                </div>
                <OpenAlertButton />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
