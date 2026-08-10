import type { ApiSeat } from "@/lib/ticketground-api";
import type { SellableSeat } from "./inventory";

function normalizeSeatCode(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR").replaceAll(/\s+/g, "");
}

function seatBindingKey(price: number, displayCode: string): string {
  return `${price}\u0000${normalizeSeatCode(displayCode)}`;
}

export function bindChartLayoutToBackendSeats(
  layoutSeats: readonly SellableSeat[],
  backendSeats: readonly ApiSeat[],
): readonly SellableSeat[] {
  const backendByKey = new Map<string, ApiSeat[]>();
  for (const backendSeat of backendSeats) {
    const key = seatBindingKey(backendSeat.price, backendSeat.label);
    const matches = backendByKey.get(key);
    if (matches) matches.push(backendSeat);
    else backendByKey.set(key, [backendSeat]);
  }
  const bound: SellableSeat[] = [];

  for (const layoutSeat of layoutSeats) {
    const key = seatBindingKey(layoutSeat.price, layoutSeat.label);
    const matches = backendByKey.get(key);
    if (matches?.length !== 1) continue;
    const [backendSeat] = matches;
    backendByKey.delete(key);
    bound.push({
      ...layoutSeat,
      id: backendSeat.id,
      label: backendSeat.label,
      displayLabel: layoutSeat.displayLabel,
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
  const coordinateIds = new Set(boundSeats.map((seat) => `${seat.x}\u0000${seat.y}`));
  return backendSeats.some((seat) => seat.available)
    && boundSeats.length === backendIds.size
    && coordinateIds.size === boundSeats.length
    && boundSeats.every((seat) => backendIds.has(seat.id));
}
