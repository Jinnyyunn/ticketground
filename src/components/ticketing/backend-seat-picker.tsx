import { currency } from "@/data/ticketing";
import type { ApiSeat } from "@/lib/ticketground-api";
import { cn } from "@/lib/utils";

export function BackendSeatPicker({
  onSelect,
  seats,
  selectedTicketId,
  status,
}: {
  readonly onSelect: (ticketId: string) => void;
  readonly seats: readonly ApiSeat[];
  readonly selectedTicketId: string;
  readonly status: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-card p-4 sm:p-5" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-ticketground">실시간 좌석도</p>
          <h3 className="balanced-title mt-1 text-xl font-black text-ink">실제 구매 가능한 티켓 선택</h3>
        </div>
        <span className="max-w-full rounded-full bg-surface px-3 py-1 text-sm font-black text-ink-3">{status}</span>
      </div>
      <div className="mt-4 grid max-h-[260px] gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {seats.map((seat) => (
          <button
            key={seat.id}
            type="button"
            data-backend-seat={seat.id}
            onClick={() => onSelect(seat.id)}
            className={cn(
              "flex min-h-11 min-w-0 items-center justify-between gap-3 rounded-sm border px-4 py-3 text-left text-sm font-bold transition focus-visible:ring-3 focus-visible:ring-ring/40 sm:min-h-12",
              selectedTicketId === seat.id ? "border-ink bg-ink text-on-ink" : "border-line bg-surface text-ink hover:border-line-strong",
            )}
          >
            <span className="shrink-0 text-base font-black">{seat.displayCode}</span>
            <span className="min-w-0 whitespace-nowrap text-right opacity-75">{seat.zoneName} · {currency(seat.price)}</span>
          </button>
        ))}
        {seats.length === 0 && <p className="text-sm font-bold text-ink-3">선택 가능한 좌석이 없습니다.</p>}
      </div>
    </div>
  );
}
