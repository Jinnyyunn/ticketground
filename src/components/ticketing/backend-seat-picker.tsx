import Image from "next/image";
import type { ApiSeat } from "@/lib/ticketground-api";
import { cn } from "@/lib/utils";

export function BackendSeatPicker({
  map,
  onSelect,
  seats,
  selectedTicketIds,
  status,
}: {
  readonly onSelect: (ticketId: string) => void;
  readonly seats: readonly ApiSeat[];
  readonly selectedTicketIds: readonly string[];
  readonly map: {
    readonly title: string;
    readonly image: string;
    readonly description: string;
  };
  readonly status: string;
}) {
  const selectedCount = selectedTicketIds.length;

  return (
    <div className="min-w-0 rounded-lg border border-line bg-card p-4 sm:p-5" aria-live="polite" data-realtime-seat-map>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-ticketground">실시간 좌석도</p>
          <h3 className="balanced-title mt-1 text-xl font-black text-ink">{map.title}</h3>
        </div>
        <span className="max-w-full rounded-full bg-surface px-3 py-1 text-sm font-black text-ink-3">{status} · {selectedCount}석 선택</span>
      </div>

      <div className="relative mt-4 aspect-[5/3] overflow-hidden rounded-md border border-line bg-surface">
        <Image
          src={map.image}
          alt={map.description}
          fill
          sizes="(max-width: 768px) 100vw, 720px"
          className="object-cover"
        />
        <div className="absolute inset-0" aria-label="좌석 배치도">
          {seats.map((seat) => {
            const picked = selectedTicketIds.includes(seat.id);
            const position = seat.mapPosition;
            return (
              <button
                key={seat.id}
                type="button"
                data-backend-seat={seat.id}
                data-seat-zone={seat.zoneId}
                aria-label={`${seat.zoneName} ${seat.displayCode}${picked ? " 선택됨" : ""}`}
                aria-pressed={picked}
                onClick={() => onSelect(seat.id)}
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  width: `${position.width}%`,
                  height: `${position.height}%`,
                  transform: `translate(-50%, -50%) rotate(${position.rotate}deg)`,
                }}
                className={cn(
                  "absolute flex min-w-3 items-center justify-center rounded-full border-2 text-[clamp(7px,1.6vw,12px)] font-black leading-none transition focus-visible:z-20 focus-visible:ring-3 focus-visible:ring-ring/60",
                  picked
                    ? "z-10 border-accent-2 bg-ink text-on-ink shadow-[0_0_0_3px_var(--accent-2)]"
                    : "border-white/90 bg-ticketground text-white shadow-sm hover:z-10 hover:scale-110 hover:bg-ink",
                )}
              >
                <span className="sr-only">{seat.displayCode}</span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-sm font-bold text-ink-3">{map.description} 좌석을 도면에서 직접 선택하세요. 선택한 좌석은 강조 표시됩니다.</p>
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-black text-ink-3" aria-label="좌석 상태 안내">
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-ticketground" aria-hidden /> 선택 가능</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full bg-ink ring-2 ring-accent-2" aria-hidden /> 선택됨</span>
      </div>
      <p className="sr-only" aria-live="polite">현재 {selectedCount}석을 선택했습니다.</p>
      {seats.length === 0 && (
        <p className="mt-3 text-sm font-bold text-ink-3">선택 가능한 좌석이 없습니다.</p>
      )}
    </div>
  );
}
