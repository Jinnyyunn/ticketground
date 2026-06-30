import Link from "next/link";
import type { TicketShow } from "@/types";
import { cn } from "@/lib/utils";

type OpenCalendarProps = {
  readonly shows: readonly TicketShow[];
};

const days = Array.from({ length: 31 }, (_, index) => index + 1);

const genreTone: Record<TicketShow["category"], string> = {
  뮤지컬: "bg-link text-white",
  콘서트: "bg-ticketground text-white",
  스포츠: "bg-warn text-white",
  "전시/행사": "bg-ok text-white",
};

function showForDay(shows: readonly TicketShow[], day: number) {
  return shows[(day + shows.length - 1) % shows.length];
}

export function OpenCalendar({ shows }: OpenCalendarProps) {
  const imminent = shows.slice(0, 5);

  return (
    <section className="ticketground-container py-10">
      <div className="flex flex-col gap-4 border-b border-line pb-7 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black text-ticketground">티켓오픈 캘린더</p>
          <h1 className="balanced-title mt-2 text-[32px] font-black leading-tight text-ink sm:text-5xl">2026년 7월 월별 캘린더</h1>
          <p className="mt-3 text-sm text-ink-3">장르 색상과 오픈 임박 리스트로 공식 예매 시간을 확인합니다.</p>
        </div>
        <Link href="/watchlist" className="inline-flex h-10 items-center justify-center rounded-lg bg-ink px-4 text-sm font-black text-white whitespace-nowrap">
          관심공연 알림
        </Link>
      </div>

      <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <h2 className="text-2xl font-black text-ink">월별 캘린더</h2>
          <div className="no-scrollbar mt-4 overflow-x-auto rounded-lg border border-line bg-white">
            <div className="grid min-w-[720px] grid-cols-7 overflow-hidden">
              {["월", "화", "수", "목", "금", "토", "일"].map((day) => (
                <div key={day} className="border-b border-line bg-surface px-3 py-2 text-center text-sm font-black text-ink-3">
                  {day}
                </div>
              ))}
              {days.map((day) => {
                const show = showForDay(shows, day);
                return (
                  <div key={day} className="min-h-[116px] min-w-0 border-b border-r border-line p-3 last:border-r-0">
                    <time className="text-sm font-black text-ink">{day}</time>
                    {show && day % 2 === 1 && (
                      <Link href={`/goods/${show.slug}`} data-allow-wrap="true" className={cn("clamp-2 mt-3 block rounded px-2 py-1 text-xs font-black", genreTone[show.category])}>
                        {show.shortTitle}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-2xl font-black text-ink">오픈 임박</h2>
          <div className="mt-4 grid gap-2 sm:gap-3">
            {imminent.map((show, index) => (
              <div key={show.slug} data-open-imminent-card className="grid min-w-0 grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-surface p-2 sm:grid-cols-[56px_minmax(0,1fr)_auto] sm:gap-3 sm:p-3">
                <time className="whitespace-nowrap text-[12px] font-black text-ticketground">D-{index + 1} 14:00</time>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-black text-ink">{show.shortTitle}</h3>
                  <p className="clamp-1 text-sm text-ink-3">{show.venue}</p>
                </div>
                <button className="h-8 whitespace-nowrap rounded-lg border border-line bg-white px-2 text-[13px] font-black text-ink sm:px-3 sm:text-sm" type="button">
                  알림
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
