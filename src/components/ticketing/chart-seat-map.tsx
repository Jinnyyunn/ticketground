"use client";

import { Check } from "lucide-react";
import { useMemo } from "react";
import type { SellableSeat } from "@/lib/seat-charts/inventory";
import { cn } from "@/lib/utils";

const tierFill: Record<SellableSeat["tier"], string> = {
  VIP: "#c45c26",
  R: "#d97706",
  S: "#059669",
  A: "#2563eb",
};

export function ChartSeatMap({
  seats,
  bounds,
  selectedSeatIds,
  onToggleSeat,
}: {
  readonly seats: readonly SellableSeat[];
  readonly bounds: { minX: number; minY: number; maxX: number; maxY: number };
  readonly selectedSeatIds: readonly string[];
  readonly onToggleSeat: (seat: SellableSeat) => void;
}) {
  const pad = 24;
  const width = Math.max(bounds.maxX - bounds.minX, 40) + pad * 2;
  const height = Math.max(bounds.maxY - bounds.minY, 40) + pad * 2;
  const selected = useMemo(() => new Set(selectedSeatIds), [selectedSeatIds]);

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-[12px] border border-line bg-surface p-3 sm:p-4" data-realtime-seat-map>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[12px] font-bold text-ink-3">
        {(["VIP", "R", "S", "A"] as const).map((tier) => (
          <span key={tier} className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-full" style={{ background: tierFill[tier] }} />
            {tier}석
          </span>
        ))}
        <span className="text-ink-4">· 배치도 기반 선택</span>
      </div>
      <div className="max-h-[min(70vh,640px)] w-full overflow-auto rounded-lg bg-white">
        <div
          className="relative mx-auto w-full"
          style={{ aspectRatio: width / height, minWidth: `${Math.max(720, (320 * width) / height)}px` }}
        >
          <svg
            viewBox={`${bounds.minX - pad} ${bounds.minY - pad} ${width} ${height}`}
            className="pointer-events-none absolute inset-0 size-full"
            role="img"
            aria-label="좌석 배치도"
          >
          {seats.map((seat) => {
            const isSelected = selected.has(seat.id);
            const r = seat.objectType === "booth" || seat.objectType === "area" ? 7 : 4.2;
            return (
              <g key={seat.id}>
                <circle
                  cx={seat.x}
                  cy={seat.y}
                  r={isSelected ? r + 1 : r}
                  fill={seat.sold ? "#cbd5e1" : tierFill[seat.tier]}
                  stroke={isSelected ? "#111" : "rgba(0,0,0,0.2)"}
                  strokeWidth={isSelected ? 1.5 : 0.5}
                  opacity={seat.sold ? 0.55 : 1}
                  aria-hidden="true"
                >
                  <title>
                    {seat.displayLabel}
                    {seat.sold ? " (매진)" : ""} · {seat.price.toLocaleString("ko-KR")}원
                  </title>
                </circle>
                {isSelected && (
                  <text
                    x={seat.x}
                    y={seat.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={7}
                    fill="#fff"
                    className="pointer-events-none"
                  >
                    ✓
                  </text>
                )}
              </g>
            );
          })}
          </svg>
          {seats.map((seat) => {
            const isSelected = selected.has(seat.id);
            return (
              <button
                key={seat.id}
                type="button"
                aria-label={`${seat.displayLabel} · ${seat.price.toLocaleString("ko-KR")}원`}
                aria-pressed={isSelected}
                data-seat-map-seat={seat.id}
                disabled={seat.sold}
                title={`${seat.displayLabel}${seat.sold ? " (매진)" : ""} · ${seat.price.toLocaleString("ko-KR")}원`}
                className={cn(
                  "absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent touch-manipulation hover:ring-2 hover:ring-ink/40 focus-visible:ring-3 focus-visible:ring-ring/60",
                  seat.sold && "cursor-not-allowed",
                  isSelected && "ring-2 ring-ink",
                )}
                style={{
                  left: `${((seat.x - (bounds.minX - pad)) / width) * 100}%`,
                  top: `${((seat.y - (bounds.minY - pad)) / height) * 100}%`,
                }}
                onClick={() => onToggleSeat(seat)}
              >
                <span className="sr-only">{seat.displayLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-[12px] text-ink-4">
        선택 {selectedSeatIds.length}석 · 전체 {seats.filter((s) => !s.sold).length}석 가능 / {seats.length}석
      </p>
    </div>
  );
}

export function ChartSeatListFallback({
  seats,
  selectedSeatIds,
  onToggleSeat,
}: {
  readonly seats: readonly SellableSeat[];
  readonly selectedSeatIds: readonly string[];
  readonly onToggleSeat: (seat: SellableSeat) => void;
}) {
  return (
    <div className="grid max-h-[420px] grid-cols-4 gap-1 overflow-auto rounded-[12px] border border-line bg-white p-3 sm:grid-cols-6">
      {seats.map((seat) => {
        const picked = selectedSeatIds.includes(seat.id);
        return (
          <button
            key={seat.id}
            type="button"
            disabled={seat.sold}
            onClick={() => onToggleSeat(seat)}
            className={cn(
              "rounded border px-1 py-2 text-[11px] font-bold",
              seat.sold && "cursor-not-allowed opacity-40",
              picked && "ring-2 ring-accent-2",
            )}
            style={{ borderColor: tierFill[seat.tier], color: tierFill[seat.tier] }}
          >
            {picked ? <Check className="mx-auto size-3" /> : seat.displayLabel}
          </button>
        );
      })}
    </div>
  );
}
