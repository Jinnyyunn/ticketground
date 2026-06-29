"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type DetailSchedule = {
  readonly label: string;
  readonly date: string;
  readonly times: readonly string[];
};

type DetailBookingPanelProps = {
  readonly slug: string;
  readonly title: string;
  readonly schedules: readonly DetailSchedule[];
};

export function DetailBookingPanel({ slug, title, schedules }: DetailBookingPanelProps) {
  const [selectedDate, setSelectedDate] = useState(schedules[0]?.date ?? "");
  const selectedSchedule = schedules.find((schedule) => schedule.date === selectedDate) ?? schedules[0];
  const [selectedTime, setSelectedTime] = useState(selectedSchedule?.times[0] ?? "");

  const availableTimes = selectedSchedule?.times ?? [];
  const queueHref = useMemo(() => {
    const query = new URLSearchParams({ date: selectedDate, time: selectedTime });
    return `/queue/${slug}?${query.toString()}`;
  }, [selectedDate, selectedTime, slug]);

  const chooseDate = (schedule: DetailSchedule) => {
    setSelectedDate(schedule.date);
    setSelectedTime(schedule.times[0] ?? "");
  };

  return (
    <aside
      data-testid="detail-booking-panel"
      className="h-fit w-full rounded-lg border border-line bg-card p-5 shadow-ticket-2 lg:sticky lg:top-[124px] lg:w-[360px]"
      aria-label={`${title} 예매 선택`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-ticketground">공식 예매</p>
          <h2 className="mt-1 text-xl font-black text-ink">상품 예매하기</h2>
        </div>
        <span className="rounded bg-tint-yellow px-2 py-1 text-xs font-black text-ink">대기열 입장</span>
      </div>

      <div className="mt-5">
        <p className="text-sm font-bold text-ink-3">관람일</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {schedules.map((schedule) => {
            const active = schedule.date === selectedDate;
            return (
              <button
                key={schedule.date}
                type="button"
                aria-pressed={active}
                onClick={() => chooseDate(schedule)}
                className={cn(
                  "rounded-sm border px-3 py-3 text-left text-sm font-bold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px",
                  active ? "border-ink bg-ink text-white" : "border-line bg-background text-ink-2 hover:border-line-strong hover:bg-surface",
                )}
              >
                <span className="block">{schedule.label}</span>
                <span className={cn("mt-1 block text-xs", active ? "text-white/70" : "text-ink-4")}>{schedule.date}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-sm font-bold text-ink-3">회차</p>
        <div className="mt-2 grid gap-2">
          {availableTimes.map((time, index) => {
            const active = time === selectedTime;
            return (
              <button
                key={`${selectedDate}-${time}`}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedTime(time)}
                className={cn(
                  "flex items-center justify-between rounded-sm border px-3 py-3 text-sm font-bold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px",
                  active ? "border-ticketground bg-tint-red text-ticketground" : "border-line bg-background text-ink-2 hover:border-line-strong hover:bg-surface",
                )}
              >
                <span>{index + 1}회</span>
                <span>{time}</span>
              </button>
            );
          })}
        </div>
      </div>

      <dl className="mt-5 rounded-sm bg-surface px-4 py-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-3">선택일</dt>
          <dd className="font-bold text-ink">{selectedSchedule?.label ?? "선택 전"}</dd>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <dt className="text-ink-3">회차</dt>
          <dd className="font-bold text-ink">{selectedTime || "선택 전"}</dd>
        </div>
      </dl>

      <Link
        data-testid="detail-queue-link"
        href={queueHref}
        className="mt-6 flex h-13 items-center justify-center rounded-sm bg-ink text-base font-black text-white transition-colors hover:bg-ticketground focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
      >
        선택 회차 예매
      </Link>
      <Link
        href="/place"
        className="mt-3 flex h-11 items-center justify-center rounded-sm border border-line bg-background text-sm font-bold text-ink-2 transition-colors hover:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        공연장 좌석 미리보기
      </Link>
      <p className="mt-4 text-xs leading-relaxed text-ink-3">예매 입장 전 대기열에서 접속 순서와 선택 회차가 함께 확인됩니다.</p>
    </aside>
  );
}
