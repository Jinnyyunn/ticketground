"use client";

import { useMemo, useState } from "react";
import { currency } from "@/data/ticketing";
import type { ApiSeat, ApiSeatMap } from "@/lib/ticketground-api";
import { cn } from "@/lib/utils";

const FALLBACK_COLORS = ["#7c68ee", "#1ca814", "#e0a020", "#e05070", "#20a0c0", "#a060d0"];

// 좌석 영역 여백(%) — 상단은 STAGE 바와 겹치지 않도록 넉넉히 비운다.
const PADDING_X = 4;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 4;

/**
 * 좌석 배치도 API(seatMeta.posLeft/posTop + seatStatus 비트맵)로 내려온 실제 좌표를
 * 그대로 찍는 배치도. 좌표가 없는 좌석맵(mock)에서는 렌더하지 않는다.
 */
export function NolSeatMap({
  onSelect,
  seatMap,
  selectedTicketIds,
}: {
  readonly onSelect: (ticketId: string) => void;
  readonly seatMap: ApiSeatMap;
  readonly selectedTicketIds: readonly string[];
}) {
  const [hovered, setHovered] = useState<ApiSeat | null>(null);

  const colorByZone = useMemo(() => {
    const table = new Map<string, string>();
    seatMap.zones.forEach((zone, index) => {
      table.set(zone.id, zone.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]);
    });
    return table;
  }, [seatMap.zones]);

  const positioned = useMemo(() => seatMap.seats.filter((seat) => seat.mapPosition), [seatMap.seats]);

  // API 좌표(posLeft/posTop)는 도면 원본 기준이라 한쪽으로 치우쳐 들어온다.
  // 실제 좌석이 차지하는 영역만 뽑아 뷰포트 가운데로 옮기고, 상단은 STAGE 아래로 밀어준다.
  const layout = useMemo(() => {
    const boxes = positioned.map((seat) => seat.mapPosition!);
    if (boxes.length === 0) return { scale: 1, offsetX: 0, offsetY: 0 };
    const minX = Math.min(...boxes.map((box) => box.x));
    const maxX = Math.max(...boxes.map((box) => box.x + box.width));
    const minY = Math.min(...boxes.map((box) => box.y));
    const maxY = Math.max(...boxes.map((box) => box.y + box.height));
    const contentWidth = Math.max(maxX - minX, 0.01);
    const contentHeight = Math.max(maxY - minY, 0.01);
    const frameWidth = 100 - PADDING_X * 2;
    const frameHeight = 100 - PADDING_TOP - PADDING_BOTTOM;
    const scale = Math.min(frameWidth / contentWidth, frameHeight / contentHeight);
    return {
      scale,
      offsetX: (100 - contentWidth * scale) / 2 - minX * scale,
      offsetY: PADDING_TOP + (frameHeight - contentHeight * scale) / 2 - minY * scale,
    };
  }, [positioned]);

  if (positioned.length === 0) return null;

  const availableCount = positioned.filter((seat) => seat.available).length;

  return (
    <div className="min-w-0 rounded-lg border border-line bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-ticketground">좌석 배치도</p>
          <h3 className="balanced-title mt-1 text-xl font-black text-ink">{seatMap.map.title}</h3>
        </div>
        <span className="rounded-full bg-surface px-3 py-1 text-sm font-black text-ink-3">
          {positioned.length.toLocaleString()}석 · 잔여 {availableCount.toLocaleString()}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {seatMap.zones.map((zone, index) => (
          <span key={zone.id} className="flex items-center gap-1.5 text-sm font-bold text-ink-3">
            <i
              aria-hidden
              className="inline-block size-3 rounded-[2px]"
              style={{ background: zone.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length] }}
            />
            {zone.name} · {currency(zone.price)} · 잔여 {zone.available}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-sm font-bold text-ink-4">
          <i aria-hidden className="inline-block size-3 rounded-[2px] bg-surface-3" />
          판매완료
        </span>
      </div>

      <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-md border border-line bg-surface">
        <div
          aria-hidden
          className="absolute inset-x-[18%] top-[2.5%] flex h-[6%] items-center justify-center rounded-sm bg-ink-4/25 text-[11px] font-black tracking-[0.3em] text-ink-4"
        >
          STAGE
        </div>
        {positioned.map((seat) => {
          const pos = seat.mapPosition!;
          const selected = selectedTicketIds.includes(seat.id);
          return (
            <button
              key={seat.id}
              type="button"
              aria-label={`${seat.displayCode} ${seat.zoneName} ${seat.available ? "예매가능" : "판매완료"}`}
              disabled={!seat.available}
              data-nol-seat={seat.id}
              onClick={() => seat.available && onSelect(seat.id)}
              onMouseEnter={() => setHovered(seat)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "absolute rounded-[1px] transition-transform",
                // 확대는 hover 일 때만 — 선택된 좌석이 커지면 옆 좌석을 누르기 어렵다.
                seat.available ? "cursor-pointer hover:z-20 hover:scale-[2.2]" : "cursor-not-allowed",
                selected && "z-10 ring-2 ring-white",
              )}
              style={{
                left: `${layout.offsetX + pos.x * layout.scale}%`,
                top: `${layout.offsetY + pos.y * layout.scale}%`,
                width: `${pos.width * layout.scale}%`,
                height: `${pos.height * layout.scale}%`,
                background: seat.available ? colorByZone.get(seat.zoneId) || "#7c68ee" : "var(--color-surface-3, #d8dae0)",
                opacity: seat.available ? 1 : 0.45,
              }}
            />
          );
        })}
      </div>

      <p className="mt-3 min-h-5 text-sm font-bold text-ink-3">
        {hovered
          ? `${hovered.displayCode} · ${hovered.zoneName} · ${currency(hovered.price)} · ${hovered.available ? "예매가능" : "판매완료"}`
          : "좌석에 커서를 올리면 상세 정보가 표시됩니다."}
      </p>
    </div>
  );
}
