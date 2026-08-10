export const maxSeatMarkersPerPage = 200;

export function seatMarkerPageCount(seatCount: number): number {
  return Math.max(1, Math.ceil(seatCount / maxSeatMarkersPerPage));
}

export function seatMarkerPage<T>(seats: readonly T[], page: number): readonly T[] {
  const pageCount = seatMarkerPageCount(seats.length);
  const safePage = Math.min(Math.max(0, Math.trunc(page)), pageCount - 1);
  const start = safePage * maxSeatMarkersPerPage;
  return seats.slice(start, start + maxSeatMarkersPerPage);
}
