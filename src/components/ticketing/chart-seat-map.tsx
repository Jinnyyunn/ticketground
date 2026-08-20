"use client";

import { Check } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { seatMarkerPage, seatMarkerPageCount } from "@/lib/seat-marker-pages";
import type { SellableSeat } from "@/lib/seat-charts/inventory";
import {
  chartMinimumRenderedWidth,
  shouldUseDenseChartGrid,
} from "@/lib/seat-charts/chart-seat-map-layout";
import { cn } from "@/lib/utils";

const tierFill: Record<SellableSeat["tier"], string> = {
  VIP: "#c45c26",
  R: "#d97706",
  S: "#059669",
  A: "#2563eb",
};

function ChartSeatMapComponent({
  seats,
  bounds,
  selectedSeatIds,
  onSelect,
}: {
  readonly seats: readonly SellableSeat[];
  readonly bounds: { minX: number; minY: number; maxX: number; maxY: number };
  readonly selectedSeatIds: readonly string[];
  readonly onSelect: (ticketId: string) => void;
}) {
  const pad = 24;
  const width = Math.max(bounds.maxX - bounds.minX, 40) + pad * 2;
  const height = Math.max(bounds.maxY - bounds.minY, 40) + pad * 2;
  const selected = useMemo(() => new Set(selectedSeatIds), [selectedSeatIds]);
  const inventoryKey = useMemo(() => seats.map((seat) => seat.id).join("\u0000"), [seats]);
  const [markerPageState, setMarkerPageState] = useState({ inventoryKey, page: 0 });
  const markerPage = markerPageState.inventoryKey === inventoryKey ? markerPageState.page : 0;
  const focusPageOnRender = useRef(false);
  const firstMarker = useRef<HTMLButtonElement>(null);
  const markerPageCount = seatMarkerPageCount(seats.length);
  const activeMarkerPage = Math.min(markerPage, markerPageCount - 1);
  const markerSeats = useMemo(
    () => seatMarkerPage(seats, activeMarkerPage),
    [activeMarkerPage, seats],
  );
  const minimumRenderedWidth = useMemo(
    () => chartMinimumRenderedWidth(markerSeats, bounds, 24),
    [bounds, markerSeats],
  );
  const useDenseGrid = shouldUseDenseChartGrid(minimumRenderedWidth, width, height);
  useEffect(() => {
    if (!focusPageOnRender.current) return;
    focusPageOnRender.current = false;
    firstMarker.current?.focus();
  }, [activeMarkerPage]);
  function changeMarkerPage(page: number) {
    focusPageOnRender.current = true;
    setMarkerPageState({ inventoryKey, page });
  }

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
      {useDenseGrid ? (
        <div
          className={cn(
            "grid grid-cols-5 gap-2 rounded-lg bg-white p-3 sm:grid-cols-8 lg:grid-cols-10",
            markerSeats.length >= 100 && "max-h-[min(70vh,640px)] overflow-y-auto",
          )}
          data-chart-seat-scroll
          data-dense-chart-grid
        >
          {markerSeats.map((seat, index) => {
            const isSelected = selected.has(seat.id);
            return (
              <button
                key={seat.id}
                ref={index === 0 ? firstMarker : undefined}
                type="button"
                aria-label={`${seat.displayLabel} · ${seat.price.toLocaleString("ko-KR")}원`}
                aria-pressed={isSelected}
                data-seat-map-seat={seat.id}
                disabled={seat.sold}
                title={`${seat.displayLabel}${seat.sold ? " (매진)" : ""} · ${seat.price.toLocaleString("ko-KR")}원`}
                className={cn(
                  "min-h-11 min-w-0 break-all rounded-lg border bg-card px-1 py-2 text-[10px] font-black touch-manipulation",
                  seat.sold && "cursor-not-allowed opacity-40",
                  isSelected && "ring-2 ring-ink",
                )}
                style={{ borderColor: tierFill[seat.tier], color: tierFill[seat.tier] }}
                onClick={() => onSelect(seat.id)}
              >
                {seat.displayLabel}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-lg bg-white lg:max-h-[min(70vh,640px)] lg:overflow-auto" data-chart-seat-scroll>
          <div className="relative mx-auto w-full" style={{ aspectRatio: width / height, minWidth: `${minimumRenderedWidth}px` }}>
            <svg
              viewBox={`${bounds.minX - pad} ${bounds.minY - pad} ${width} ${height}`}
              className="pointer-events-none absolute inset-0 size-full"
              role="img"
              aria-label="좌석 배치도"
            >
            {markerSeats.map((seat) => {
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
                    <title>{seat.displayLabel}{seat.sold ? " (매진)" : ""} · {seat.price.toLocaleString("ko-KR")}원</title>
                  </circle>
                  {isSelected && <text x={seat.x} y={seat.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#fff" className="pointer-events-none">✓</text>}
                </g>
              );
            })}
            </svg>
            {markerSeats.map((seat, index) => {
              const isSelected = selected.has(seat.id);
              return (
                <button
                  key={seat.id}
                  ref={index === 0 ? firstMarker : undefined}
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
                  onClick={() => onSelect(seat.id)}
                >
                  <span className="pointer-events-none block whitespace-nowrap rounded-sm bg-white/85 px-0.5 text-[7px] font-black leading-none text-ink shadow-sm">{seat.displayLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {markerPageCount > 1 ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm font-bold" aria-label="좌석 묶음 이동">
          <button
            type="button"
            className="min-h-11 rounded-lg border border-line bg-card px-4 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={activeMarkerPage === 0}
            onClick={() => changeMarkerPage(Math.max(0, activeMarkerPage - 1))}
          >
            이전 좌석
          </button>
          <span aria-live="polite" className="inline-flex min-h-11 items-center rounded-lg border border-line bg-card px-3" data-chart-seat-page>
            {activeMarkerPage + 1} / {markerPageCount}
          </span>
          <button
            type="button"
            className="min-h-11 rounded-lg border border-line bg-card px-4 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={activeMarkerPage === markerPageCount - 1}
            onClick={() => changeMarkerPage(Math.min(markerPageCount - 1, activeMarkerPage + 1))}
          >
            다음 좌석
          </button>
        </div>
      ) : null}
      <p className="mt-2 text-[12px] text-ink-4">
        선택 {selectedSeatIds.length}석 · 전체 {seats.filter((s) => !s.sold).length}석 가능 / {seats.length}석
      </p>
    </div>
  );
}

export const ChartSeatMap = memo(ChartSeatMapComponent);

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
