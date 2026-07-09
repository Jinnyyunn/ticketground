"use client";

import { useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { currency } from "@/data/ticketing";
import { readDemoCancelHistory, subscribeDemoCancelHistory, type DemoCancelHistoryEntry } from "@/lib/demo-cancel-history";
import { cn } from "@/lib/utils";
import type { Reservation } from "@/types";

type HistoryRange = "3m" | "1y" | "3y" | "custom";

type HistoryItem = {
  readonly id: string;
  readonly title: string;
  readonly venue: string;
  readonly date: string;
  readonly isoDate: string;
  readonly recordIsoDate: string;
  readonly time: string;
  readonly seat: string;
  readonly statusLabel: "예매완료" | "취소요청 완료";
  readonly detail: string;
  readonly amountLabel: string;
  readonly searchText: string;
};

const emptyCancelHistory = [] as const;
const rangeOptions: readonly { readonly value: HistoryRange; readonly label: string }[] = [
  { value: "3m", label: "최근 3개월" },
  { value: "1y", label: "최근 1년" },
  { value: "3y", label: "최근 3년" },
  { value: "custom", label: "직접 선택" },
] as const;

const rangeMonthMap: Record<Exclude<HistoryRange, "custom">, number> = {
  "3m": 3,
  "1y": 12,
  "3y": 36,
};

export function ReservationHistorySearch({ reservations }: { readonly reservations: readonly Reservation[] }) {
  const [draftQuery, setDraftQuery] = useState("");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<HistoryRange>("3y");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const cancelHistory = useSyncExternalStore(subscribeDemoCancelHistory, readDemoCancelHistory, () => emptyCancelHistory);
  const todayIsoDate = useMemo(() => isoDateFromDate(new Date()), []);

  const items = useMemo(() => {
    const reservationItems = reservations.map((reservation) => reservationToHistoryItem(reservation, todayIsoDate));
    const cancelItems = cancelHistory.map(cancelHistoryToItem);
    return [...cancelItems, ...reservationItems].sort((first, second) => second.isoDate.localeCompare(first.isoDate));
  }, [cancelHistory, reservations, todayIsoDate]);

  const referenceDate = todayIsoDate;
  const defaultStart = shiftIsoDate(referenceDate, rangeMonthMap["3y"]);
  const defaultEnd = referenceDate;
  const visibleStart = customStart || defaultStart;
  const visibleEnd = customEnd || defaultEnd;
  const activeStart = range === "custom" ? visibleStart : shiftIsoDate(referenceDate, rangeMonthMap[range]);
  const activeEnd = range === "custom" ? visibleEnd : defaultEnd;
  const startDate = activeStart <= activeEnd ? activeStart : activeEnd;
  const endDate = activeStart <= activeEnd ? activeEnd : activeStart;
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");

  const filteredItems = items.filter((item) => {
    const matchesQuery = !normalizedQuery || item.searchText.toLocaleLowerCase("ko-KR").includes(normalizedQuery);
    const matchesDate = item.recordIsoDate >= startDate && item.recordIsoDate <= endDate;
    return matchesQuery && matchesDate;
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draftQuery);
  }

  return (
    <div data-history-search-panel>
      <div className="min-w-0">
        <p className="text-sm font-black text-ticketground">내 예약 통합 조회</p>
        <h3 className="balanced-title mt-1 text-2xl font-black text-ink">내 예매 및 취소공연 검색</h3>
        <p className="mt-2 break-keep text-sm leading-relaxed text-ink-3">
          최근 3년 범위 안에서 예매완료 공연과 취소 요청 내역을 공연명, 장소, 예매번호로 찾아볼 수 있습니다.
        </p>
      </div>

      <form onSubmit={submitSearch} className="mt-4 grid gap-3 rounded-md border border-line bg-card p-4 lg:grid-cols-[minmax(0,1fr)_160px_auto]">
        <label className="grid gap-2 text-sm font-black text-ink">
          내역 검색어
          <input
            type="search"
            aria-label="내역 검색어"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="공연명, 장소, 예매번호 검색"
            className="h-11 min-w-0 rounded-sm border border-line bg-surface px-3 text-base font-bold text-ink outline-none transition focus:border-line-strong focus:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </label>
        <label className="grid gap-2 text-sm font-black text-ink">
          조회 기간
          <select
            aria-label="조회 기간"
            value={range}
            onChange={(event) => setRange(toHistoryRange(event.target.value))}
            className="h-11 rounded-sm border border-line bg-surface px-3 text-sm font-black text-ink outline-none transition focus:border-line-strong focus:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-11 self-end rounded-sm bg-ink px-5 text-sm font-black text-on-ink shadow-ticket-1 transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
        >
          검색
        </button>
        {range === "custom" && (
          <div className="grid gap-3 lg:col-span-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-black text-ink">
              시작일
              <input
                type="date"
                aria-label="시작일"
                value={visibleStart}
                max={visibleEnd}
                onChange={(event) => setCustomStart(event.target.value)}
                className="h-11 rounded-sm border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-line-strong focus:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-ink">
              종료일
              <input
                type="date"
                aria-label="종료일"
                value={visibleEnd}
                min={visibleStart}
                onChange={(event) => setCustomEnd(event.target.value)}
                className="h-11 rounded-sm border border-line bg-surface px-3 text-sm font-bold text-ink outline-none transition focus:border-line-strong focus:bg-card focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
          </div>
        )}
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-bold text-ink-3">
        <span className="rounded-full bg-card px-3 py-1">{filteredItems.length}건 조회</span>
        <span>
          {startDate} ~ {endDate}
        </span>
      </div>

      <div className="mt-3 grid gap-3">
        {filteredItems.length === 0 ? (
          <p className="rounded-sm border border-line bg-card p-4 text-sm font-bold text-ink-3">
            조건에 맞는 예매 또는 취소 내역이 없습니다.
          </p>
        ) : (
          filteredItems.map((item) => <HistoryResultCard key={`${item.statusLabel}-${item.id}`} item={item} />)
        )}
      </div>
    </div>
  );
}

function HistoryResultCard({ item }: { readonly item: HistoryItem }) {
  const canceled = item.statusLabel === "취소요청 완료";
  return (
    <div role="article" data-history-search-row className="rounded-sm border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-3 py-1 text-sm font-black", canceled ? "bg-ticketground text-white" : "bg-ink-2 text-on-ink-2")}>
          {item.statusLabel}
        </span>
        <span className="text-sm font-bold text-ink-3">{item.detail}</span>
      </div>
      <h4 className="balanced-title mt-3 text-xl font-black text-ink">{item.title}</h4>
      <p className="mt-2 break-words text-sm text-ink-3">{item.venue}</p>
      <p className="mt-1 text-sm font-black text-ink">
        {item.date} {item.time} · {item.seat}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-bold text-ink-3">예매번호 {item.id}</span>
        <span className="font-black text-ticketground">{item.amountLabel}</span>
      </div>
    </div>
  );
}

function reservationToHistoryItem(reservation: Reservation, recordIsoDate: string): HistoryItem {
  const searchText = [reservation.id, reservation.showTitle, reservation.venue, reservation.seat, reservation.status].join(" ");
  return {
    id: reservation.id,
    title: reservation.showTitle,
    venue: reservation.venue,
    date: reservation.date,
    isoDate: dottedDateToIso(reservation.date),
    recordIsoDate,
    time: reservation.time,
    seat: reservation.seat,
    statusLabel: "예매완료",
    detail: "공연 예매 내역",
    amountLabel: reservation.price,
    searchText,
  };
}

function cancelHistoryToItem(entry: DemoCancelHistoryEntry): HistoryItem {
  const searchText = [entry.reservationId, entry.showTitle, entry.venue, entry.seat, entry.reason, "취소"].join(" ");
  return {
    id: entry.reservationId,
    title: entry.showTitle,
    venue: entry.venue,
    date: entry.date,
    isoDate: dottedDateToIso(entry.date),
    recordIsoDate: isoDateFromDateTime(entry.requestedAt),
    time: entry.time,
    seat: entry.seat,
    statusLabel: "취소요청 완료",
    detail: `사유 · ${entry.reason}`,
    amountLabel: `환불 예정 ${currency(entry.refundAmount)}`,
    searchText,
  };
}

function toHistoryRange(value: string): HistoryRange {
  switch (value) {
    case "3m":
    case "1y":
    case "3y":
    case "custom":
      return value;
    default:
      return "3y";
  }
}

function dottedDateToIso(value: string) {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : isoDateFromDate(new Date());
}

function isoDateFromDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : isoDateFromDate(new Date());
}

function shiftIsoDate(value: string, monthsBack: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const shiftedDate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 - monthsBack, Number(match[3])));
  return isoDateFromDate(shiftedDate);
}

function isoDateFromDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
