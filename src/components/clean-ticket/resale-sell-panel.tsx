"use client";

import { CheckCircle2, RefreshCcw, ShieldCheck, Ticket, TriangleAlert } from "lucide-react";
import { currency } from "@/data/ticketing";
import { SummaryRow, TicketgroundSurface } from "@/components/ticketground/primitives";
import { cn } from "@/lib/utils";
import type { OwnedSeatOption } from "./resale-flow-data";

type ResaleSellPanelProps = {
  readonly apiBusy: boolean;
  readonly faceValue: number;
  readonly isPriceValid: boolean;
  readonly maxAllowedPrice: number;
  readonly minPrice: number;
  readonly onEnsureTicket: () => void;
  readonly onPriceChange: (price: number) => void;
  readonly onRegister: () => void;
  readonly onSeatChange: (seatId: string) => void;
  readonly ownedSeatOptions: readonly OwnedSeatOption[];
  readonly policyMaxPercent: number;
  readonly policyMinPercent: number;
  readonly price: number;
  readonly seatId: string;
  readonly sellFee: number;
  readonly settlement: number;
  readonly showDate: string;
  readonly showTime: string;
  readonly showTitle: string;
};

export function ResaleSellPanel({
  apiBusy,
  faceValue,
  isPriceValid,
  maxAllowedPrice,
  minPrice,
  onEnsureTicket,
  onPriceChange,
  onRegister,
  onSeatChange,
  ownedSeatOptions,
  policyMaxPercent,
  policyMinPercent,
  price,
  seatId,
  sellFee,
  settlement,
  showDate,
  showTime,
  showTitle,
}: ResaleSellPanelProps) {
  return (
    <TicketgroundSurface className="overflow-hidden p-0 shadow-ticket-3">
      <div className="grid gap-1 border-b border-line bg-surface px-5 py-4">
        <p className="flex items-center gap-1.5 text-xs font-black text-ticketground">
          <Ticket className="size-3.5 shrink-0" aria-hidden />
          SELLER ACTION
        </p>
        <h2 className="text-2xl font-black text-ink">보유 티켓 등록</h2>
        <p className="text-sm font-bold text-ink-3">{showTitle} · {showDate} {showTime}</p>
      </div>
      <div className="grid gap-5 p-5">
        <div className="grid gap-4 rounded-lg border border-line bg-background p-4">
          <label className="grid gap-2 text-sm font-bold text-ink-2">
            보유 좌석
            <select
              className="h-11 rounded-sm border border-line bg-background px-3 text-base shadow-ticket-1 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              value={seatId}
              onChange={(event) => onSeatChange(event.currentTarget.value)}
              data-testid="owned-ticket-select"
              suppressHydrationWarning
            >
              {ownedSeatOptions.map((seat) => (
                <option key={seat.id} value={seat.id}>
                  {seat.label} · 정가 {currency(seat.faceValue)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink-2">
            등록 가격
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-lg font-black text-ink-4">₩</span>
              <input
                className={cn(
                  "h-12 w-full rounded-sm border bg-background pl-8 pr-3 text-lg font-black shadow-ticket-1 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isPriceValid ? "border-line" : "border-destructive",
                )}
                type="number"
                min={0}
                value={price}
                onChange={(event) => onPriceChange(Number(event.currentTarget.value))}
                data-testid="resale-price-input"
                suppressHydrationWarning
              />
            </div>
          </label>
        </div>
        <div className="grid gap-1.5">
          <input
            aria-label="등록 가격 슬라이더"
            className="accent-ticketground"
            type="range"
            min={minPrice}
            max={maxAllowedPrice}
            step={500}
            value={Math.min(Math.max(price, minPrice), maxAllowedPrice)}
            onChange={(event) => onPriceChange(Number(event.currentTarget.value))}
          />
          <div className="flex items-center justify-between text-xs font-bold text-ink-4">
            <span>최소 {currency(minPrice)}</span>
            <span>최대 {currency(maxAllowedPrice)}</span>
          </div>
        </div>
        <p className={cn("flex items-center gap-1.5 text-sm font-bold", isPriceValid ? "text-ok" : "text-destructive")} data-testid="policy-message">
          {isPriceValid ? (
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          ) : (
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
          )}
          {isPriceValid
            ? `정책 OK: ${policyMinPercent}~${policyMaxPercent}% 범위 안입니다.`
            : `오류: 정가 ${currency(faceValue)} 기준 ${currency(minPrice)}~${currency(maxAllowedPrice)}만 등록할 수 있습니다.`}
        </p>
        <dl className="rounded-lg border border-line bg-surface px-4 shadow-ticket-1">
          <SummaryRow label="등록가" value={currency(price)} />
          <SummaryRow label="예상 구매자 수수료 5%" value={currency(sellFee)} />
          <SummaryRow label="정산 예정액" value={currency(settlement)} strong />
        </dl>
        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
          <button
            type="button"
            disabled={apiBusy}
            onClick={onEnsureTicket}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-sm border border-line bg-card px-5 text-sm font-black text-ink shadow-ticket-1 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:bg-surface-3"
          >
            <RefreshCcw className="size-3.5 shrink-0" aria-hidden />
            테스트 티켓 확보
          </button>
          <button
            type="button"
            disabled={!isPriceValid || apiBusy}
            onClick={onRegister}
            className="inline-flex h-12 items-center justify-center gap-1.5 rounded-sm bg-ink px-5 text-base font-black text-on-ink shadow-ticket-2 transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:bg-ink-4"
            data-testid="resale-register"
          >
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            {apiBusy ? "처리 중" : "CLEAN 티켓 공식 풀에 양도 등록"}
          </button>
        </div>
      </div>
    </TicketgroundSurface>
  );
}
