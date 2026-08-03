"use client";

import { useState } from "react";
import { currency } from "@/data/ticketing";
import type { ApiSeat } from "@/lib/ticketground-api";
import { cn } from "@/lib/utils";

const seatsPerPage = 96;

export function BackendSeatPicker({
  onSelect,
  seats,
  selectedTicketIds,
  status,
}: {
  readonly onSelect: (ticketId: string) => void;
  readonly seats: readonly ApiSeat[];
  readonly selectedTicketIds: readonly string[];
  readonly status: string;
}) {
  const [requestedPageIndex, setRequestedPageIndex] = useState(0);
  const pageCount = Math.max(1, Math.ceil(seats.length / seatsPerPage));
  const pageIndex = Math.min(requestedPageIndex, pageCount - 1);
  const firstSeatIndex = pageIndex * seatsPerPage;
  const visibleSeats = seats.slice(firstSeatIndex, firstSeatIndex + seatsPerPage);

  return (
    <div className="min-w-0 rounded-lg border border-line bg-card p-4 sm:p-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-ticketground">실시간 좌석도</p>
          <h3 className="balanced-title mt-1 text-xl font-black text-ink">실제 구매 가능한 티켓 선택</h3>
        </div>
        <span className="max-w-full rounded-full bg-surface px-3 py-1 text-sm font-black text-ink-3">{status}</span>
      </div>
      <div className="mt-4 grid max-h-[260px] gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {visibleSeats.map((seat) => (
          <button
            key={seat.id}
            type="button"
            data-backend-seat={seat.id}
            onClick={() => onSelect(seat.id)}
            className={cn(
              "flex min-h-11 min-w-0 flex-col items-start justify-center gap-0.5 overflow-hidden rounded-sm border px-4 py-2.5 text-left text-sm font-bold transition focus-visible:ring-3 focus-visible:ring-ring/40 sm:min-h-12",
              selectedTicketIds.includes(seat.id) ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-ink hover:border-line-strong",
            )}
          >
            <span className="w-full truncate text-base font-black leading-tight">{seat.displayCode}</span>
            <span className="w-full truncate text-sm leading-tight opacity-75">
              {seat.zoneName} · {currency(seat.price)}
            </span>
          </button>
        ))}
        {seats.length === 0 && <p className="text-sm font-bold text-ink-3">선택 가능한 좌석이 없습니다.</p>}
      </div>
      {pageCount > 1 ? (
        <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="좌석 목록 페이지">
          <button
            type="button"
            aria-label="이전 좌석 페이지"
            disabled={pageIndex === 0}
            onClick={() => setRequestedPageIndex(pageIndex - 1)}
            className="h-11 rounded-sm border border-line bg-card px-4 text-sm font-black text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전
          </button>
          <p className="text-sm font-bold text-ink-3">
            {pageIndex + 1}/{pageCount} 페이지 · {firstSeatIndex + 1}-{Math.min(firstSeatIndex + seatsPerPage, seats.length)}석
          </p>
          <button
            type="button"
            aria-label="다음 좌석 페이지"
            disabled={pageIndex >= pageCount - 1}
            onClick={() => setRequestedPageIndex(pageIndex + 1)}
            className="h-11 rounded-sm border border-line bg-card px-4 text-sm font-black text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </nav>
      ) : null}
    </div>
  );
}
