"use client";

import Image from "next/image";
import { memo, useId, useMemo, useState } from "react";
import { minimumRenderedWidthForRelativePoints } from "@/lib/seat-charts/chart-seat-map-layout";
import type { ApiSeat } from "@/lib/ticketground-api";
import { seatMarkerPage, seatMarkerPageCount } from "@/lib/seat-marker-pages";
import { cn } from "@/lib/utils";

const zoneTierStyles: Record<string, string> = {
  zone_vip: "bg-tier-vip border-tier-vip",
  zone_r: "bg-tier-r border-tier-r",
  zone_s: "bg-tier-s border-tier-s",
};

// Admin events allow up to 20 price zones (maxArrayItems.prices in
// backend/admin-event-content.js), so this needs one distinct entry per
// supported zone to never wrap back onto an earlier color. Tailwind's
// orange-500 (#f97316) is excluded because it's the exact dark-mode fill of
// --tier-r (theme-vars.css), which would make a custom zone assigned that
// slot indistinguishable from an R-tier zone in dark mode.
const zonePalette = [
  "bg-red-500 border-red-600",
  "bg-amber-500 border-amber-600",
  "bg-yellow-500 border-yellow-600",
  "bg-lime-500 border-lime-600",
  "bg-green-500 border-green-600",
  "bg-emerald-500 border-emerald-600",
  "bg-teal-500 border-teal-600",
  "bg-cyan-500 border-cyan-600",
  "bg-sky-500 border-sky-600",
  "bg-blue-500 border-blue-600",
  "bg-indigo-500 border-indigo-600",
  "bg-violet-500 border-violet-600",
  "bg-purple-500 border-purple-600",
  "bg-fuchsia-500 border-fuchsia-600",
  "bg-pink-500 border-pink-600",
  "bg-rose-500 border-rose-600",
  "bg-slate-500 border-slate-600",
  "bg-zinc-500 border-zinc-600",
  "bg-stone-500 border-stone-600",
  "bg-gray-500 border-gray-600",
];

const fallbackAspectRatio = 4 / 3;

// Assigned per the zones actually displayed (not hashed) so two zones shown
// together never collide onto the same palette slot.
function buildZoneMarkerStyles(zoneIds: readonly string[]): Record<string, string> {
  const styles: Record<string, string> = {};
  let paletteIndex = 0;
  for (const zoneId of zoneIds) {
    if (zoneTierStyles[zoneId]) {
      styles[zoneId] = zoneTierStyles[zoneId];
      continue;
    }
    styles[zoneId] = zonePalette[paletteIndex % zonePalette.length];
    paletteIndex += 1;
  }
  return styles;
}

function normalizeAxis(value: number, min: number, max: number, start: number, end: number): number {
  if (min === max) return 50;
  return start + ((value - min) / (max - min)) * (end - start);
}

function VenueSeatMapComponent({
  mapImage,
  mapTitle,
  onSelect,
  seats,
  selectedTicketIds,
}: {
  readonly mapImage: string;
  readonly mapTitle: string;
  readonly onSelect: (ticketId: string) => void;
  readonly seats: readonly ApiSeat[];
  readonly selectedTicketIds: readonly string[];
}) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [markerPage, setMarkerPage] = useState(0);
  const scrollHintId = useId();
  const positionedSeats = useMemo(() => seats.filter((seat) => seat.mapPosition), [seats]);
  const availablePositionedSeats = useMemo(() => positionedSeats.filter((seat) => seat.available), [positionedSeats]);
  const markerPageCount = seatMarkerPageCount(availablePositionedSeats.length);
  const activeMarkerPage = Math.min(markerPage, markerPageCount - 1);
  const markerSeats = useMemo(
    () => seatMarkerPage(availablePositionedSeats, activeMarkerPage),
    [activeMarkerPage, availablePositionedSeats],
  );
  const zoneIds = useMemo(() => Array.from(new Set(availablePositionedSeats.map((seat) => seat.zoneId))), [availablePositionedSeats]);
  const zoneMarkerStyles = useMemo(() => buildZoneMarkerStyles(zoneIds), [zoneIds]);
  const markerPositions = useMemo(() => {
    const xs = positionedSeats.flatMap((seat) => seat.mapPosition ? [seat.mapPosition.x] : []);
    const ys = positionedSeats.flatMap((seat) => seat.mapPosition ? [seat.mapPosition.y] : []);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const positions = new Map<string, { x: number; y: number }>();
    for (const seat of markerSeats) {
      const position = seat.mapPosition;
      if (!position) continue;
      positions.set(seat.id, {
        x: normalizeAxis(position.x, minX, maxX, 8, 92),
        y: normalizeAxis(position.y, minY, maxY, 10, 90),
      });
    }
    return positions;
  }, [markerSeats, positionedSeats]);
  const renderedAspectRatio = aspectRatio ?? fallbackAspectRatio;
  const minimumMarkerWidth = useMemo(() => {
    const desiredWidth = minimumRenderedWidthForRelativePoints(
      Array.from(markerPositions.values(), (position) => ({
        x: position.x / 100,
        y: position.y / 100 / renderedAspectRatio,
      })),
      24,
      520,
    );
    return Math.min(desiredWidth, Math.max(520, Math.floor(640 * renderedAspectRatio)));
  }, [markerPositions, renderedAspectRatio]);
  if (availablePositionedSeats.length === 0) return null;

  return (
    <div className="min-w-0 rounded-lg border border-line bg-card p-4 sm:p-5" data-realtime-seat-map>
      <p className="text-sm font-black text-ticketground">실시간 좌석도</p>
      <h3 className="balanced-title mt-1 text-xl font-black text-ink">{mapTitle}</h3>

      <p id={scrollHintId} className="mt-3 break-keep text-xs font-bold text-ink-3 sm:hidden">
        좌석표가 화면보다 넓으면 좌우로 밀어 전체 좌석을 확인하고 선택할 수 있습니다.
      </p>
      <div className="relative mt-3 sm:mt-4">
        <span className="pointer-events-none absolute inset-y-2 left-0 z-30 w-5 bg-linear-to-r from-card to-transparent sm:hidden" />
        <span className="pointer-events-none absolute inset-y-2 right-0 z-30 w-5 bg-linear-to-l from-card to-transparent sm:hidden" />
        <div
          aria-describedby={scrollHintId}
          className="no-scrollbar overflow-x-auto pb-2"
          data-seat-map-scroll
        >
          <div
            className="relative mx-auto w-full min-w-[520px] max-w-[720px] overflow-hidden rounded-lg border border-line bg-surface-3"
            style={{ aspectRatio: renderedAspectRatio, minWidth: `${minimumMarkerWidth}px` }}
            onClickCapture={(event) => {
              const clickedMarker = event.target instanceof Element
                ? event.target.closest("[data-venue-seat-marker]")
                : null;
              if (event.detail === 0 || !clickedMarker) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              let nearest: { id: string; distance: number } | null = null;
              for (const seat of markerSeats) {
                const position = markerPositions.get(seat.id);
                if (!position) continue;
                const distance = Math.max(
                  Math.abs(event.clientX - (bounds.left + (position.x / 100) * bounds.width)),
                  Math.abs(event.clientY - (bounds.top + (position.y / 100) * bounds.height)),
                );
                if (!nearest || distance < nearest.distance) nearest = { id: seat.id, distance };
              }
              if (!nearest) return;
              event.preventDefault();
              event.stopPropagation();
              onSelect(nearest.id);
            }}
          >
            <Image
              alt={mapTitle}
              className="object-contain opacity-70"
              fill
              sizes="(min-width: 1024px) 640px, 100vw"
              src={mapImage}
              onLoad={(event) => {
                const { naturalWidth, naturalHeight } = event.currentTarget;
                if (naturalWidth > 0 && naturalHeight > 0) setAspectRatio(naturalWidth / naturalHeight);
              }}
            />
            {markerSeats.map((seat) => {
              const position = markerPositions.get(seat.id);
              if (!position) return null;
              const picked = selectedTicketIds.includes(seat.id);
              return (
                <button
                  key={seat.id}
                  type="button"
                  aria-label={`${seat.zoneName} ${seat.displayCode} · ${seat.price.toLocaleString("ko-KR")}원`}
                  aria-pressed={picked}
                  data-seat-map-seat={seat.id}
                  data-venue-seat-marker={seat.id}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  onClick={() => onSelect(seat.id)}
                  className={cn(
                    "touch-manipulation absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm transition-transform hover:z-20 hover:scale-125 focus-visible:z-30 focus-visible:ring-3 focus-visible:ring-ring/60",
                    picked ? "z-10 scale-125 border-accent-2 bg-ink ring-2 ring-accent-2" : zoneMarkerStyles[seat.zoneId],
                  )}
                >
                  <span className="text-[8px] font-black leading-none text-white">{seat.displayCode}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {markerPageCount > 1 ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm font-bold" aria-label="좌석 묶음 이동">
          <button
            type="button"
            className="min-h-11 rounded-lg border border-line bg-card px-4 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={activeMarkerPage === 0}
            onClick={() => setMarkerPage((page) => Math.max(0, page - 1))}
          >
            이전 좌석
          </button>
          <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-card px-3">
            좌석 묶음
            <select
              aria-label="좌석 묶음"
              className="bg-transparent font-black"
              value={activeMarkerPage}
              onChange={(event) => setMarkerPage(Number(event.target.value))}
            >
              {Array.from({ length: markerPageCount }, (_, page) => (
                <option key={page} value={page}>{page + 1} / {markerPageCount}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="min-h-11 rounded-lg border border-line bg-card px-4 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={activeMarkerPage === markerPageCount - 1}
            onClick={() => setMarkerPage((page) => Math.min(markerPageCount - 1, page + 1))}
          >
            다음 좌석
          </button>
        </div>
      ) : null}
      <p className="mt-3 break-keep text-sm font-bold text-ink-3">이 지도는 구역별 대략적인 위치를 보여주는 개략도이며, 실제 좌석 배치와 다를 수 있습니다. 구매할 좌석을 도면에서 직접 선택하세요.</p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold" aria-label="구역 범례">
        {zoneIds.map((zoneId) => {
          const zoneSeat = availablePositionedSeats.find((seat) => seat.zoneId === zoneId);
          const zoneName = zoneSeat?.zoneName ?? zoneId;
          return (
            <span key={zoneId} className="inline-flex items-center gap-2">
              <span className={cn("size-3 rounded-full border", zoneMarkerStyles[zoneId])} />
              {zoneName}{zoneSeat ? ` · ${zoneSeat.price.toLocaleString("ko-KR")}원` : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export const VenueSeatMap = memo(VenueSeatMapComponent);
