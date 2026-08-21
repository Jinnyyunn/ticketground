import assert from "node:assert/strict";
import test from "node:test";
import {
  createRow,
  createTable,
  setAreaCapacity,
  setDecorationProps,
  setRowGeometry,
  setTableProps,
} from "../src/lib/seat-designer/chart-ops.ts";

function base(objects) {
  return { id: "chart", name: "테스트", categories: [], floors: [{ id: "floor-1", name: "1층", index: 1 }], activeFloorId: "floor-1", objects };
}

test("invalid numeric inspector input never mutates geometry", () => {
  const row = createRow({ x: 0, y: 0 }, { x: 100, y: 0 }, 6, "A");
  const table = createTable({ x: 50, y: 50 }, 30, 8, "T1");
  const area = { id: "area", type: "area", label: "스탠딩", layer: "interactive", points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], capacity: 20 };
  const chart = base([row, table, area]);
  assert.equal(setRowGeometry(chart, row.id, { seatCount: Number.NaN }), chart);
  assert.equal(setTableProps(chart, table.id, { radius: Number.POSITIVE_INFINITY }), chart);
  assert.equal(setAreaCapacity(chart, area.id, Number.NaN), chart);
});

test("valid inspector input clamps documented limits and rebuilds seats", () => {
  const row = createRow({ x: 0, y: 0 }, { x: 100, y: 0 }, 6, "A");
  const chart = base([row]);
  const changed = setRowGeometry(chart, row.id, { seatCount: 500, curve: 15, smooth: 0.4 });
  assert.equal(changed.objects[0].seatCount, 200);
  assert.equal(changed.objects[0].seats.length, 200);
  assert.equal(changed.objects[0].smooth, 0.4);
});

test("table booking options preserve existing chair identities and attributes", () => {
  const table = {
    ...createTable({ x: 50, y: 50 }, 30, 4, "T1"),
    shape: "rectangle",
    width: 120,
    height: 36,
    chairs: { top: 2, right: 0, bottom: 2, left: 0 },
  };
  const seats = table.seats.map((seat, index) => ({ ...seat, id: `stable-${index}`, displayedLabel: `${index + 1}번`, accessible: index === 0 }));
  const chart = base([{ ...table, seats }]);
  const changed = setTableProps(chart, table.id, { bookAsWhole: true, variableOccupancy: true, minOccupancy: 2, maxOccupancy: 4 });
  assert.deepEqual(changed.objects[0].seats, seats);
  const resized = setTableProps(changed, table.id, { width: 180 });
  assert.deepEqual(resized.objects[0].seats.map((seat) => seat.id), seats.map((seat) => seat.id));
  assert.deepEqual(resized.objects[0].seats.map((seat) => seat.displayedLabel), seats.map((seat) => seat.displayedLabel));
  assert.notDeepEqual(resized.objects[0].seats.map(({ x, y }) => ({ x, y })), seats.map(({ x, y }) => ({ x, y })));
});

test("decoration inspector edits only properties supported by the selected type", () => {
  const rectangle = { id: "rect", type: "rectangle", label: "무대", layer: "background", x: 10, y: 20, width: 80, height: 40, fill: "#eeeeee", stroke: "#111111" };
  const chart = base([rectangle]);
  const changed = setDecorationProps(chart, rectangle.id, { width: 120, height: 60, fill: "#ffffff", rotation: 15 });
  assert.deepEqual(changed.objects[0], { ...rectangle, width: 120, height: 60, fill: "#ffffff", rotation: 15 });
  assert.equal(setDecorationProps(chart, rectangle.id, { width: Number.NaN }), chart);
});
