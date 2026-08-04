"use client";

import Image from "next/image";
import { useMemo } from "react";
import { currency } from "@/data/ticketing";
import type { ApiSeat } from "@/lib/ticketground-api";
import { cn } from "@/lib/utils";

const zoneTierStyles: Record<string, string> = {
  zone_vip: "bg-tier-vip text-on-tier-vip border-tier-vip",
  zone_r: "bg-tier-r text-on-tier-r border-tier-r",
  zone_s: "bg-tier-s text-on-tier-s border-tier-s",
};
const fallbackTierStyle = "bg-tier-a text-on-tier-a border-tier-a";

const layoutPadding = 10;

function layoutSeats(seats: readonly ApiSeat[]) {
  const positioned = seats.filter((seat) => seat.mapPosition);
  if (positioned.length === 0) return [];
  const xs = positioned.map((seat) => seat.mapPosition!.x);
  const ys = positioned.map((seat) => seat.mapPosition!.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const usable = 100 - layoutPadding * 2;
  return positioned.map((seat) => ({
    seat,
    left: layoutPadding + ((seat.mapPosition!.x - minX) / spanX) * usable,
    top: layoutPadding + ((seat.mapPosition!.y - minY) / spanY) * usable,
  }));
}

export function VenueSeatMap({
  mapImage,
  mapTitle,
  onSelect,
  seats,
  selectedTicketIds,
  status,
}: {
  readonly mapImage: string;
  readonly mapTitle: string;
  readonly onSelect: (ticketId: string) => void;
  readonly seats: readonly ApiSeat[];
  readonly selectedTicketIds: readonly string[];
  readonly status: string;
}) {
  const zoneIds = useMemo(() => Array.from(new Set(seats.map((seat) => seat.zoneId))), [seats]);
  // Real seat coordinates assume the full venue is rendered; a filtered subset is
  // rescaled to its own bounding box so adjacent markers don't overlap and swallow clicks.
  const positionedSeats = useMemo(() => layoutSeats(seats), [seats]);

  return (
    <div className="min-w-0 rounded-lg border border-line bg-card p-4 sm:p-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-ticketground">실시간 좌석도</p>
          <h3 className="balanced-title mt-1 text-xl font-black text-ink">{mapTitle}</h3>
        </div>
        <span className="max-w-full rounded-full bg-surface px-3 py-1 text-sm font-black text-ink-3">{status}</span>
      </div>

      <div className="no-scrollbar mt-4 overflow-x-auto pb-2">
        <div className="relative mx-auto aspect-[4/3] w-full min-w-[520px] max-w-[720px] overflow-hidden rounded-lg border border-line bg-surface-3">
          <Image alt={mapTitle} className="object-contain opacity-70" fill sizes="(min-width: 1024px) 640px, 100vw" src={mapImage} />
          {positionedSeats.map(({ seat, left, top }) => {
            const picked = selectedTicketIds.includes(seat.id);
            return (
              <button
                key={seat.id}
                type="button"
                data-backend-seat={seat.id}
                aria-label={`${seat.zoneName} ${seat.displayCode} · ${currency(seat.price)}`}
                aria-pressed={picked}
                onClick={() => onSelect(seat.id)}
                style={{ left: `${left}%`, top: `${top}%` }}
                className={cn(
                  "absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm transition hover:z-10 focus-visible:z-10 focus-visible:ring-3 focus-visible:ring-ring/40 sm:size-5",
                  picked ? "z-10 border-ink bg-ink text-on-ink ring-2 ring-accent-2 ring-offset-2 ring-offset-white" : (zoneTierStyles[seat.zoneId] ?? fallbackTierStyle),
                )}
              />
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-sm font-bold text-ink-3">좌석도가 화면보다 넓으면 좌우로 밀어 전체 구역을 확인할 수 있습니다.</p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold" aria-label="구역 범례">
        {zoneIds.map((zoneId) => {
          const zoneName = seats.find((seat) => seat.zoneId === zoneId)?.zoneName ?? zoneId;
          return (
            <span key={zoneId} className="inline-flex items-center gap-2">
              <span className={cn("size-3 rounded-full border", zoneTierStyles[zoneId] ?? fallbackTierStyle)} />
              {zoneName}
            </span>
          );
        })}
      </div>

      {seats.length === 0 && <p className="mt-3 text-sm font-bold text-ink-3">선택 가능한 좌석이 없습니다.</p>}
    </div>
  );
}
