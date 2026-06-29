"use client";

import { Check } from "lucide-react";
import { useMemo } from "react";
import type { TicketSeatGrade } from "@/types";
import { cn } from "@/lib/utils";

export type SeatTier = Extract<TicketSeatGrade, "VIP" | "R" | "S" | "A">;

export interface SeatOption {
  readonly id: string;
  readonly row: string;
  readonly number: number;
  readonly tier: SeatTier;
  readonly price: number;
  readonly sold: boolean;
}

const tierStyles: Record<SeatTier, string> = {
  VIP: "bg-tier-vip text-white border-tier-vip",
  R: "bg-tier-r text-white border-tier-r",
  S: "bg-tier-s text-white border-tier-s",
  A: "bg-tier-a text-white border-tier-a",
};

export const seatRows = "ABCDEFGHIJKLMNOPQRST".split("");
export const seatColumns = Array.from({ length: 22 }, (_, index) => index + 1);
export const soldSeatIds = new Set(["A-3", "A-4", "B-8", "C-19", "D-5", "E-13", "F-21", "G-2", "H-16", "J-10", "K-12", "L-18", "M-7", "N-22", "O-1", "P-15", "Q-9", "R-20", "S-6", "T-14"]);

export function tierForRow(row: string): SeatTier {
  if (["A", "B", "C", "H"].includes(row)) return "VIP";
  if (["D", "E", "F", "G"].includes(row)) return "R";
  if (["I", "J", "K", "L", "M", "N"].includes(row)) return "S";
  return "A";
}

export function createSeatMap(prices: Record<SeatTier, number>): readonly SeatOption[] {
  return seatRows.flatMap((row) => {
    const tier = tierForRow(row);
    return seatColumns.map((number) => {
      const id = `${row}-${number}`;
      return { id, row, number, tier, price: prices[tier], sold: soldSeatIds.has(id) };
    });
  });
}

export function SeatMap({
  seats,
  selectedSeatIds,
  onToggleSeat,
}: {
  readonly seats: readonly SeatOption[];
  readonly selectedSeatIds: readonly string[];
  readonly onToggleSeat: (seat: SeatOption) => void;
}) {
  const seatsById = useMemo(() => new Map(seats.map((seat) => [seat.id, seat])), [seats]);

  return (
    <div className="rounded-[12px] border border-line bg-surface p-5">
      <div className="mx-auto mb-5 flex h-9 max-w-[520px] items-center justify-center rounded-t-[50%] border border-line-strong bg-white text-[13px] font-black text-ink-3">
        STAGE
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="mx-auto w-max space-y-1" data-seat-grid="20x22">
          {seatRows.map((row) => (
            <div key={row} className="grid grid-cols-[24px_auto_12px_auto] items-center gap-1">
              <span className="text-center text-[13px] font-black text-ink-3">{row}</span>
              {[seatColumns.slice(0, 11), seatColumns.slice(11)].map((columns, groupIndex) => (
                <div key={`${row}-${groupIndex}`} className={cn("grid grid-cols-11 gap-1", groupIndex === 0 ? "col-start-2" : "col-start-4")}>
                  {columns.map((number) => {
                    const id = `${row}-${number}`;
                    const seat = seatsById.get(id);
                    if (!seat) return null;
                    const picked = selectedSeatIds.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        data-seat-id={id}
                        data-tier={seat.tier}
                        disabled={seat.sold}
                        aria-label={`${seat.tier} ${id}${seat.sold ? " 매진" : ""}`}
                        aria-pressed={picked}
                        onClick={() => onToggleSeat(seat)}
                        className={cn(
                          "relative flex size-6 items-center justify-center rounded-[4px] border text-[13px] font-black transition",
                          tierStyles[seat.tier],
                          seat.sold && "cursor-not-allowed border-line bg-surface-3 text-ink-4 opacity-55",
                          picked && "ring-2 ring-accent-2 ring-offset-2 ring-offset-white",
                        )}
                      >
                        {picked ? <Check aria-hidden="true" className="size-3.5" strokeWidth={4} /> : number}
                      </button>
                    );
                  })}
                </div>
              ))}
              <span aria-hidden="true" className="col-start-3 row-start-1 h-6 border-l border-dashed border-line-strong" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3 text-[13px] font-bold" aria-label="좌석 등급 범례">
        {(["VIP", "R", "S", "A"] as const).map((tier) => (
          <span key={tier} className="inline-flex items-center gap-2">
            <span className={cn("size-3 rounded-[3px]", tierStyles[tier])} />
            {tier}
          </span>
        ))}
        <span className="inline-flex items-center gap-2 text-ink-3">
          <span className="size-3 rounded-[3px] bg-surface-3" />
          매진
        </span>
      </div>
    </div>
  );
}
