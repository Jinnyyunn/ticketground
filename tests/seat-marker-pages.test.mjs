import test from "node:test";
import assert from "node:assert/strict";
import {
  maxSeatMarkersPerPage,
  seatMarkerPage,
  seatMarkerPageCount,
} from "../src/lib/seat-marker-pages.ts";

test("large seat maps expose every ticket without rendering thousands of markers at once", () => {
  const seats = Array.from({ length: 10_000 }, (_, index) => ({ id: `ticket-${index}` }));
  const pageCount = seatMarkerPageCount(seats.length);
  const renderedIds = new Set();

  assert.equal(pageCount, 50);
  for (let page = 0; page < pageCount; page += 1) {
    const visibleSeats = seatMarkerPage(seats, page);
    assert.ok(visibleSeats.length <= maxSeatMarkersPerPage);
    for (const seat of visibleSeats) renderedIds.add(seat.id);
  }

  assert.equal(renderedIds.size, seats.length);
});
