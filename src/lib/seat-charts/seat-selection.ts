import type { SellableSeat } from "./inventory.ts";

export function toggleChartSeatSelection(
  current: readonly string[],
  seat: SellableSeat,
  requestedQuantity: number,
): readonly string[] {
  const group = seat.availableTicketIds ?? seat.backendTicketIds;
  if (seat.bookingMode && group?.length) {
    const allGroupIds = seat.backendTicketIds ?? group;
    if (allGroupIds.some((id) => current.includes(id))) {
      return current.filter((id) => !allGroupIds.includes(id));
    }
    const minimum = seat.bookingMode === "whole" ? group.length : Math.max(1, seat.minOccupancy ?? 1);
    const maximum = seat.bookingMode === "whole" ? group.length : Math.max(minimum, seat.maxOccupancy ?? group.length);
    const count = Math.min(group.length, maximum, Math.max(minimum, requestedQuantity));
    return group.slice(0, count);
  }
  if (current.includes(seat.id)) return current.filter((id) => id !== seat.id);
  const limit = Math.min(2, Math.max(1, requestedQuantity));
  return [...current, seat.id].slice(-limit);
}
