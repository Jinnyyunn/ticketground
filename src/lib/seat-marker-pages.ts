export const maxSeatMarkersPerPage = 200;

export function seatMarkerPageCount(seatCount: number, pageSize = maxSeatMarkersPerPage): number {
  return Math.max(1, Math.ceil(seatCount / pageSize));
}

export function seatMarkerPage<T>(seats: readonly T[], page: number, pageSize = maxSeatMarkersPerPage): readonly T[] {
  const pageCount = seatMarkerPageCount(seats.length, pageSize);
  const safePage = Math.min(Math.max(0, Math.trunc(page)), pageCount - 1);
  const start = safePage * pageSize;
  return seats.slice(start, start + pageSize);
}
