import test from "node:test";
import assert from "node:assert/strict";
import {
  bindChartLayoutToBackendSeats,
  chartCoversAllBackendSeats,
} from "../src/lib/seat-charts/bind-backend-seats.ts";
import { chartMinimumRenderedWidth } from "../src/lib/seat-charts/chart-seat-map-layout.ts";

const layoutSeat = (id, displayLabel, price, x) => ({
  id,
  label: displayLabel,
  displayLabel,
  tier: price === 190000 ? "VIP" : "R",
  price,
  sold: false,
  x,
  y: 20,
  objectId: `object-${id}`,
  objectType: "row",
});

const backendSeat = (id, displayCode, price, available = true) => ({
  id,
  label: displayCode,
  displayCode,
  zoneId: price === 190000 ? "zone_vip" : "zone_r",
  zoneName: price === 190000 ? "VIP" : "R",
  price,
  status: available ? "ON_SALE" : "SOLD",
  available,
});

test("binds chart coordinates to real backend ticket ids when labels and prices match", () => {
  // Given
  const layout = [layoutSeat("layout-vip", "A-01", 190000, 10), layoutSeat("layout-r", "B-01", 160000, 30)];
  const backend = [backendSeat("ticket-r", "B-01", 160000), backendSeat("ticket-vip", "A-01", 190000)];

  // When
  const bound = bindChartLayoutToBackendSeats(layout, backend);

  // Then
  assert.deepEqual(bound.map(({ id, x }) => ({ id, x })), [
    { id: "ticket-vip", x: 10 },
    { id: "ticket-r", x: 30 },
  ]);
});

test("falls back to price order without inventing ticket ids", () => {
  // Given
  const layout = [layoutSeat("layout-1", "디자인 좌석 1", 160000, 10), layoutSeat("layout-2", "디자인 좌석 2", 160000, 30)];
  const backend = [backendSeat("ticket-1", "R-01", 160000), backendSeat("ticket-2", "R-02", 160000)];

  // When
  const bound = bindChartLayoutToBackendSeats(layout, backend);

  // Then
  assert.deepEqual(bound.map(({ id, displayLabel }) => ({ id, displayLabel })), [
    { id: "ticket-1", displayLabel: "R-01" },
    { id: "ticket-2", displayLabel: "R-02" },
  ]);
});

test("omits layout places that have no sellable backend ticket", () => {
  // Given
  const layout = [layoutSeat("layout-1", "R-01", 160000, 10), layoutSeat("layout-2", "R-02", 160000, 30)];
  const backend = [backendSeat("ticket-1", "R-01", 160000)];

  // When
  const bound = bindChartLayoutToBackendSeats(layout, backend);

  // Then
  assert.deepEqual(bound.map(({ id }) => id), ["ticket-1"]);
});

test("binds unavailable tickets before filtering so remaining seats keep their coordinates", () => {
  const layout = [
    layoutSeat("layout-1", "unmatched-1", 160000, 10),
    layoutSeat("layout-2", "unmatched-2", 160000, 30),
  ];
  const backend = [
    backendSeat("sold-ticket", "R-01", 160000, false),
    backendSeat("open-ticket", "R-02", 160000),
  ];

  const bound = bindChartLayoutToBackendSeats(layout, backend);

  assert.deepEqual(bound.map(({ id, sold, x }) => ({ id, sold, x })), [
    { id: "sold-ticket", sold: true, x: 10 },
    { id: "open-ticket", sold: false, x: 30 },
  ]);
  assert.equal(chartCoversAllBackendSeats(bound, backend), true);
});

test("uses a published chart only when it covers every sellable backend ticket", () => {
  const backend = [backendSeat("ticket-1", "R-01", 160000), backendSeat("ticket-2", "R-02", 160000)];
  const partial = bindChartLayoutToBackendSeats([layoutSeat("layout-1", "R-01", 160000, 10)], backend);
  const complete = bindChartLayoutToBackendSeats([
    layoutSeat("layout-1", "R-01", 160000, 10),
    layoutSeat("layout-2", "R-02", 160000, 30),
  ], backend);

  assert.equal(chartCoversAllBackendSeats(partial, backend), false);
  assert.equal(chartCoversAllBackendSeats(complete, backend), true);
});

test("expands dense published charts so 24px seat targets cannot overlap", () => {
  const denseSeats = [
    layoutSeat("layout-1", "A-01", 190000, 10),
    { ...layoutSeat("layout-2", "A-02", 190000, 18), y: 26 },
  ];

  const minWidth = chartMinimumRenderedWidth(
    denseSeats,
    { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    24,
  );
  const renderedScale = minWidth / 148;

  assert.ok(Math.max(8, 6) * renderedScale >= 24);
});
