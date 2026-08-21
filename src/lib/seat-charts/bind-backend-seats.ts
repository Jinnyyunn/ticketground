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
    const members = layoutSeat.memberSeats
      ?? layoutSeat.memberLabels?.map((label) => ({ label, price: layoutSeat.price }));
    if (layoutSeat.bookingMode && members?.length) {
      const grouped = members.map((member) => backendByKey.get(seatBindingKey(member.price, member.label)));
      if (grouped.some((matches) => matches?.length !== 1)) continue;
      const backendGroup = grouped.map((matches) => matches?.[0]).filter((seat): seat is ApiSeat => Boolean(seat));
      for (const backendSeat of backendGroup) backendByKey.delete(seatBindingKey(backendSeat.price, backendSeat.label));
      const availableTicketIds = backendGroup.filter((seat) => seat.available).map((seat) => seat.id);
      const minimum = layoutSeat.bookingMode === "whole"
        ? backendGroup.length
        : Math.max(1, layoutSeat.minOccupancy ?? 1);
      const pricedSeats = layoutSeat.bookingMode === "whole"
        ? backendGroup
        : backendGroup.filter((seat) => seat.available).slice(0, minimum);
      bound.push({
        ...layoutSeat,
        price: pricedSeats.reduce((sum, seat) => sum + seat.price, 0),
        backendTicketIds: backendGroup.map((seat) => seat.id),
        availableTicketIds,
        sold: availableTicketIds.length < minimum,
      });
      continue;
    }
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
  const boundBackendIds = boundSeats.flatMap((seat) => seat.backendTicketIds ?? [seat.id]);
  const uniqueBoundBackendIds = new Set(boundBackendIds);
  return backendSeats.some((seat) => seat.available)
    && boundBackendIds.length === backendIds.size
    && uniqueBoundBackendIds.size === backendIds.size
    && coordinateIds.size === boundSeats.length
    && boundBackendIds.every((id) => backendIds.has(id));
}
