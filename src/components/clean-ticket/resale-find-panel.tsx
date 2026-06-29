"use client";

import { useMemo } from "react";
import Link from "next/link";
import { SummaryRow, TicketgroundChip, TicketgroundSurface } from "@/components/ticketground/primitives";
import { currency } from "@/data/ticketing";
import { cn } from "@/lib/utils";
import type { ResaleMatchResult, ResalePoolCandidate } from "./use-resale-backend";

const gradeOptions: readonly string[] = ["VIP", "R", "S", "A"];
const zoneOptions: readonly string[] = ["1층 중앙", "1층 사이드", "2층", "오케스트라"];

export function ResaleFindPanel({
  activeCell,
  busy,
  drawing,
  filteredCandidates,
  grade,
  maxPrice,
  onPurchase,
  pairOnly,
  resaleFeePercent,
  reservationId,
  result,
  setGrade,
  setMaxPrice,
  setPairOnly,
  setZone,
  zone,
}: {
  readonly activeCell: number | null;
  readonly busy: boolean;
  readonly drawing: boolean;
  readonly filteredCandidates: readonly ResalePoolCandidate[];
  readonly grade: string;
  readonly maxPrice: number;
  readonly onPurchase: () => void;
  readonly pairOnly: boolean;
  readonly resaleFeePercent: number;
  readonly reservationId: string;
  readonly result: ResaleMatchResult | null;
  readonly setGrade: (grade: string) => void;
  readonly setMaxPrice: (price: number) => void;
  readonly setPairOnly: (pairOnly: boolean) => void;
  readonly setZone: (zone: string) => void;
  readonly zone: string;
}) {
  const poolCells = useMemo(
    () =>
      Array.from({ length: 60 }, (_, index) => ({
        id: `pool-${index + 1}`,
        highlighted: index % 7 === 0 || index % 11 === 0,
      })),
    [],
  );
  const resultFee = result?.fee ?? 0;

  return (
    <TicketgroundSurface className="grid gap-5">
      <div>
        <h2 className="text-2xl font-black text-ink">조건으로 구하기</h2>
        <p className="mt-1 text-sm text-ink-3">등급, 구역, 가격, 연석 조건만 고르고 좌석은 추첨 후 공개됩니다.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {gradeOptions.map((item) => (
          <TicketgroundChip key={item} active={grade === item} onClick={() => setGrade(item)}>
            {item}석
          </TicketgroundChip>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold text-ink-2">
          구역
          <select className="h-11 rounded-sm border border-line bg-background px-3" value={zone} onChange={(event) => setZone(event.currentTarget.value)}>
            {zoneOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink-2">
          최대 가격
          <input className="h-11 rounded-sm border border-line px-3" type="number" value={maxPrice} onChange={(event) => setMaxPrice(Number(event.currentTarget.value))} />
        </label>
        <label className="flex items-center gap-3 rounded-sm border border-line px-3 text-sm font-bold text-ink-2">
          <input type="checkbox" checked={pairOnly} onChange={(event) => setPairOnly(event.currentTarget.checked)} />
          연석만
        </label>
      </div>
      <div className="grid grid-cols-10 gap-1 rounded-lg bg-surface p-3" aria-label="현재 열린 공식 재판매 풀 60칸" data-testid="pool-grid">
        {poolCells.map((cell, index) => (
          <span
            key={cell.id}
            data-testid="pool-cell"
            data-seat-pickable="false"
            className={cn(
              "aspect-square rounded-xs border border-line bg-background",
              cell.highlighted && "bg-tint-yellow",
              activeCell === index && "border-ticketground bg-ticketground",
            )}
          />
        ))}
      </div>
      <p className="text-sm font-bold text-ink-3" data-testid="draw-guard">좌석번호는 추첨 완료 전까지 공개되지 않으며 직접 선택할 수 없습니다.</p>
      <button type="button" onClick={onPurchase} disabled={drawing || busy || filteredCandidates.length === 0} className="h-12 rounded-sm bg-ticketground px-5 text-base font-black text-white disabled:bg-ink-4" data-testid="resale-purchase">
        {drawing || busy ? "결제 및 매칭 중" : `재판매 티켓 구매 · 후보 ${filteredCandidates.length}건`}
      </button>
      <div className={cn("rounded-lg border border-line p-4", result && "border-ok bg-tint-yellow")} data-testid="match-result">
        {result ? (
          <div className="grid gap-3">
            <p className="text-lg font-black text-ink">매칭 완료: {result.seat}</p>
            <dl className="grid gap-1 text-sm text-ink-2">
              <SummaryRow label="거래 금액" value={currency(result.amount)} />
              <SummaryRow label={`구매 수수료 ${resaleFeePercent}%`} value={currency(resultFee)} />
              <SummaryRow label="총 결제액" value={currency(result.buyerTotal)} />
              <SummaryRow label="랜덤 시드" value={result.seed} />
              <SummaryRow label="원장 번호" value={result.ledger} strong />
            </dl>
            <Link className="inline-flex h-11 items-center justify-center rounded-sm bg-ink px-5 text-sm font-black text-white" href={`/reservation/${reservationId}`} data-testid="confirm-cta">
              매칭 좌석으로 확인하기
            </Link>
          </div>
        ) : (
          <p className="text-sm font-bold text-ink-3">{filteredCandidates.length ? "아직 좌석이 공개되지 않았습니다. 매칭을 시작하세요." : "조건에 맞는 공식 풀 좌석이 없습니다."}</p>
        )}
      </div>
    </TicketgroundSurface>
  );
}
