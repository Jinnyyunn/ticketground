"use client";

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
    <TicketgroundSurface className="grid gap-5">
      <div>
        <h2 className="text-2xl font-black text-ink">보유 티켓 등록</h2>
        <p className="mt-1 text-sm text-ink-3">{showTitle} · {showDate} {showTime}</p>
      </div>
      <label className="grid gap-2 text-sm font-bold text-ink-2">
        보유 좌석
        <select
          className="h-11 rounded-sm border border-line bg-background px-3 text-base"
          value={seatId}
          onChange={(event) => onSeatChange(event.currentTarget.value)}
          data-testid="owned-ticket-select"
        >
          {ownedSeatOptions.map((seat) => (
            <option key={seat.id} value={seat.id}>
              {seat.label} · 정가 {currency(seat.faceValue)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3">
        <label className="grid gap-2 text-sm font-bold text-ink-2">
          등록 가격
          <input
            className={cn("h-11 rounded-sm border px-3 text-base", isPriceValid ? "border-line" : "border-destructive bg-tint-red")}
            type="number"
            min={0}
            value={price}
            onChange={(event) => onPriceChange(Number(event.currentTarget.value))}
            data-testid="resale-price-input"
          />
        </label>
        <input
          aria-label="등록 가격 슬라이더"
          type="range"
          min={minPrice}
          max={maxAllowedPrice}
          step={500}
          value={Math.min(Math.max(price, minPrice), maxAllowedPrice)}
          onChange={(event) => onPriceChange(Number(event.currentTarget.value))}
        />
        <p className={cn("text-sm font-bold", isPriceValid ? "text-ok" : "text-destructive")} data-testid="policy-message">
          {isPriceValid
            ? `정책 OK: ${policyMinPercent}~${policyMaxPercent}% 범위 안입니다.`
            : `오류: 정가 ${currency(faceValue)} 기준 ${currency(minPrice)}~${currency(maxAllowedPrice)}만 등록할 수 있습니다.`}
        </p>
      </div>
      <dl className="rounded-lg bg-surface px-4">
        <SummaryRow label="등록가" value={currency(price)} />
        <SummaryRow label="예상 구매자 수수료 5%" value={currency(sellFee)} />
        <SummaryRow label="정산 예정액" value={currency(settlement)} strong />
      </dl>
      <button
        type="button"
        disabled={apiBusy}
        onClick={onEnsureTicket}
        className="h-11 rounded-sm border border-line bg-white px-5 text-sm font-black text-ink disabled:bg-surface-3"
      >
        백엔드 테스트 티켓 확보
      </button>
      <button
        type="button"
        disabled={!isPriceValid || apiBusy}
        onClick={onRegister}
        className="h-12 rounded-sm bg-ink px-5 text-base font-black text-white disabled:bg-ink-4"
        data-testid="resale-register"
      >
        {apiBusy ? "처리 중" : "공식 풀에 등록"}
      </button>
    </TicketgroundSurface>
  );
}
