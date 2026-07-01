"use client";

import Link from "next/link";
import { currency } from "@/data/ticketing";
import type { ApiResaleResult } from "@/lib/ticketground-api";
import { SummaryRow, TicketgroundChip, TicketgroundSurface } from "@/components/ticketground/primitives";
import { cn } from "@/lib/utils";
import { gradeOptions, type MatchCandidate, type PoolCell, zoneOptions } from "./resale-flow-data";

type ResaleFindPanelProps = {
  readonly activeCell: number | null;
  readonly apiBusy: boolean;
  readonly drawing: boolean;
  readonly filteredCandidates: readonly MatchCandidate[];
  readonly grade: string;
  readonly maxPrice: number;
  readonly onBackendPurchase: () => void;
  readonly onDraw: () => void;
  readonly onGradeChange: (grade: string) => void;
  readonly onMaxPriceChange: (price: number) => void;
  readonly onPairOnlyChange: (pairOnly: boolean) => void;
  readonly onZoneChange: (zone: string) => void;
  readonly pairOnly: boolean;
  readonly poolCells: readonly PoolCell[];
  readonly reservationId: string;
  readonly result: MatchCandidate | null;
  readonly resultFee: number;
  readonly backendResult: ApiResaleResult | null;
  readonly zone: string;
};

export function ResaleFindPanel({
  activeCell,
  apiBusy,
  backendResult,
  drawing,
  filteredCandidates,
  grade,
  maxPrice,
  onBackendPurchase,
  onDraw,
  onGradeChange,
  onMaxPriceChange,
  onPairOnlyChange,
  onZoneChange,
  pairOnly,
  poolCells,
  reservationId,
  result,
  resultFee,
  zone,
}: ResaleFindPanelProps) {
  return (
    <TicketgroundSurface className="grid gap-5">
      <div>
        <h2 className="text-2xl font-black text-ink">조건으로 구하기</h2>
        <p className="mt-1 text-sm text-ink-3">등급, 구역, 가격, 연석 조건만 고르고 좌석은 추첨 후 공개됩니다.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {gradeOptions.map((item) => (
          <TicketgroundChip key={item} active={grade === item} onClick={() => onGradeChange(item)}>
            {item}석
          </TicketgroundChip>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-2 text-sm font-bold text-ink-2">
          구역
          <select className="h-11 rounded-sm border border-line bg-background px-3" value={zone} onChange={(event) => onZoneChange(event.currentTarget.value)}>
            {zoneOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold text-ink-2">
          최대 가격
          <input className="h-11 rounded-sm border border-line px-3" type="number" value={maxPrice} onChange={(event) => onMaxPriceChange(Number(event.currentTarget.value))} />
        </label>
        <label className="flex items-center gap-3 rounded-sm border border-line px-3 text-sm font-bold text-ink-2">
          <input type="checkbox" checked={pairOnly} onChange={(event) => onPairOnlyChange(event.currentTarget.checked)} />
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
      <button type="button" onClick={onDraw} disabled={drawing || apiBusy || filteredCandidates.length === 0} className="h-12 rounded-sm bg-ticketground px-5 text-base font-black text-white disabled:bg-ink-4" data-testid="resale-draw">
        {drawing ? "후보 순환 중" : `조건부 랜덤 매칭 시작 · 후보 ${filteredCandidates.length}건`}
      </button>
      <button type="button" onClick={onBackendPurchase} disabled={apiBusy} className="h-12 rounded-sm bg-ink px-5 text-base font-black text-white disabled:bg-ink-4" data-testid="resale-purchase">
        즉시 구매 매칭
      </button>
      <div className={cn("rounded-lg border border-line p-4", result && "border-ok bg-tint-yellow")} data-testid="match-result">
        {backendResult ? (
          <BackendMatchResult backendResult={backendResult} reservationId={reservationId} />
        ) : result ? (
          <LocalMatchResult reservationId={reservationId} result={result} resultFee={resultFee} />
        ) : (
          <p className="text-sm font-bold text-ink-3">{filteredCandidates.length ? "아직 좌석이 공개되지 않았습니다. 매칭을 시작하세요." : "조건에 맞는 공식 풀 좌석이 없습니다."}</p>
        )}
      </div>
    </TicketgroundSurface>
  );
}

function BackendMatchResult({ backendResult, reservationId }: { readonly backendResult: ApiResaleResult; readonly reservationId: string }) {
  return (
    <div className="grid gap-3">
      <p className="text-lg font-black text-ink">매칭 완료: {backendResult.ticket.seatLabel}</p>
      <dl className="grid gap-1 text-sm text-ink-2">
        <SummaryRow label="거래 금액" value={currency(backendResult.pool.price)} />
        <SummaryRow label="수수료 5%" value={currency(backendResult.fee)} />
        <SummaryRow label="구매자 총액" value={currency(backendResult.buyerTotal)} />
        <SummaryRow label="판매자 정산" value={currency(backendResult.sellerSettlement)} strong />
      </dl>
      <Link className="inline-flex h-11 items-center justify-center rounded-sm bg-ink px-5 text-sm font-black text-white" href={`/reservation/${reservationId}?ticketId=${backendResult.ticket.id}`} data-testid="confirm-cta">
        매칭 좌석으로 확인하기
      </Link>
    </div>
  );
}

function LocalMatchResult({ reservationId, result, resultFee }: { readonly reservationId: string; readonly result: MatchCandidate; readonly resultFee: number }) {
  return (
    <div className="grid gap-3">
      <p className="text-lg font-black text-ink">매칭 완료: {result.seat}</p>
      <dl className="grid gap-1 text-sm text-ink-2">
        <SummaryRow label="거래 금액" value={currency(result.amount)} />
        <SummaryRow label="예상 수수료 5%" value={currency(resultFee)} />
        <SummaryRow label="랜덤 시드" value={result.seed} />
        <SummaryRow label="원장 번호" value={result.ledger} strong />
      </dl>
      <Link className="inline-flex h-11 items-center justify-center rounded-sm bg-ink px-5 text-sm font-black text-white" href={`/reservation/${reservationId}`} data-testid="confirm-cta">
        매칭 좌석으로 확인하기
      </Link>
    </div>
  );
}
