import type { ApiSeat } from "@/lib/ticketground-api";
import type { SellableSeat } from "./inventory";

function normalizeSeatCode(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR").replaceAll(/\s+/g, "");
}

export function bindChartLayoutToBackendSeats(
  layoutSeats: readonly SellableSeat[],
  backendSeats: readonly ApiSeat[],
): readonly SellableSeat[] {
  const remaining = [...backendSeats];
  const bound: SellableSeat[] = [];

  for (const layoutSeat of layoutSeats) {
    const layoutCode = normalizeSeatCode(layoutSeat.displayLabel);
    let backendIndex = remaining.findIndex(
      (seat) => seat.price === layoutSeat.price && normalizeSeatCode(seat.displayCode) === layoutCode,
    );
    if (backendIndex < 0) {
      backendIndex = remaining.findIndex((seat) => seat.price === layoutSeat.price);
    }
    if (backendIndex < 0) continue;

    const [backendSeat] = remaining.splice(backendIndex, 1);
    if (!backendSeat) continue;
    bound.push({
      ...layoutSeat,
      id: backendSeat.id,
      label: backendSeat.label,
      displayLabel: backendSeat.displayCode,
      price: backendSeat.price,
      sold: !backendSeat.available,
    });
  }

  return bound;
}

export function chartCoversAllBackendSeats(
  boundSeats: readonly SellableSeat[],
  backendSeats: readonly ApiSeat[],
): boolean {
  const backendIds = new Set(backendSeats.map((seat) => seat.id));
  return backendSeats.some((seat) => seat.available)
    && boundSeats.length === backendIds.size
    && boundSeats.every((seat) => backendIds.has(seat.id));
}
