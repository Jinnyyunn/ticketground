"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { ApiSeat } from "@/lib/ticketground-api";
import { cn } from "@/lib/utils";

const zoneTierStyles: Record<string, string> = {
  zone_vip: "bg-tier-vip border-tier-vip",
  zone_r: "bg-tier-r border-tier-r",
  zone_s: "bg-tier-s border-tier-s",
};

const zonePalette = [
  "bg-violet-500 border-violet-600",
  "bg-fuchsia-500 border-fuchsia-600",
  "bg-cyan-500 border-cyan-600",
  "bg-lime-500 border-lime-600",
  "bg-rose-500 border-rose-600",
  "bg-teal-500 border-teal-600",
  "bg-indigo-500 border-indigo-600",
  "bg-amber-500 border-amber-600",
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

export function VenueSeatMap({
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
  const positionedSeats = useMemo(() => seats.filter((seat) => seat.mapPosition), [seats]);
  const zoneIds = useMemo(() => Array.from(new Set(positionedSeats.map((seat) => seat.zoneId))), [positionedSeats]);
  const zoneMarkerStyles = useMemo(() => buildZoneMarkerStyles(zoneIds), [zoneIds]);

  if (positionedSeats.length === 0) return null;

  return (
    <div className="min-w-0 rounded-lg border border-line bg-card p-4 sm:p-5">
      <p className="text-sm font-black text-ticketground">실시간 좌석도</p>
      <h3 className="balanced-title mt-1 text-xl font-black text-ink">{mapTitle}</h3>

      <div className="no-scrollbar mt-4 overflow-x-auto pb-2">
        <div
          className="relative mx-auto w-full min-w-[520px] max-w-[720px] overflow-hidden rounded-lg border border-line bg-surface-3"
          style={{ aspectRatio: aspectRatio ?? fallbackAspectRatio }}
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
          {positionedSeats.map((seat) => {
            const position = seat.mapPosition!;
            const picked = selectedTicketIds.includes(seat.id);
            return (
              <button
                key={seat.id}
                type="button"
                data-venue-seat-marker={seat.id}
                tabIndex={-1}
                aria-label={`${seat.zoneName} ${seat.displayCode}`}
                onClick={() => onSelect(seat.id)}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                className={cn(
                  "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm transition hover:z-10 hover:scale-150 sm:size-3",
                  picked ? "z-10 scale-150 border-ink bg-ink" : zoneMarkerStyles[seat.zoneId],
                )}
              />
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-sm font-bold text-ink-3">지도는 실제 좌석 위치를 표시합니다. 좌석 선택은 아래 목록에서 진행하세요.</p>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold" aria-label="구역 범례">
        {zoneIds.map((zoneId) => {
          const zoneName = positionedSeats.find((seat) => seat.zoneId === zoneId)?.zoneName ?? zoneId;
          return (
            <span key={zoneId} className="inline-flex items-center gap-2">
              <span className={cn("size-3 rounded-full border", zoneMarkerStyles[zoneId])} />
              {zoneName}
            </span>
          );
        })}
      </div>
    </div>
  );
}
