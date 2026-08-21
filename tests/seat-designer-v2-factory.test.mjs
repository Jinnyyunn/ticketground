import test from "node:test";
import assert from "node:assert/strict";
import { chartDocument, createDraggedObject, createPathObject, createPointObject, updateTableGeometry } from "../src/components/seat-designer-v2/object-factory.ts";

test("place-bearing v2 objects are publishable and segmented seat labels stay unique", () => {
  const state = { seatSpacing: 5, objects: [] };
  const row = createDraggedObject("row", { x: 0, y: 0 }, { x: 180, y: 0 }, state);
  const booth = createPointObject("booth", { x: 25, y: 25 }, 0);
  const area = createDraggedObject("rectangularArea", { x: 0, y: 0 }, { x: 100, y: 80 }, state);
  const table = createPointObject("roundTable", { x: 50, y: 50 }, 0);
  const section = createPathObject("section", [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 80 }], 0);
  const segmented = createPathObject("segmentedRow", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }], 0);

  for (const object of [row, booth, area, table, section]) {
    assert.ok(object);
    assert.equal(object.categoryKey, "general");
  }
  assert.deepEqual(booth && "width" in booth ? [booth.width, booth.height] : null, [50, 50]);
  assert.ok(segmented?.type === "row");
  assert.equal(new Set(segmented.seats.map((seat) => seat.label)).size, segmented.seats.length);
});

test("rectangular tables keep side chair controls and unique seat identities", () => {
  const table = createPointObject("rectangularTable", { x: 100, y: 80 }, 0);
  assert.ok(table?.type === "table");
  const edited = updateTableGeometry(table, { width: 160, height: 60, chairs: { top: 3, right: 2, bottom: 4, left: 1 } });
  assert.equal(edited.seatCount, 10);
  assert.equal(new Set(edited.seats.map((seat) => seat.id)).size, 10);
  assert.equal(edited.seats.filter((seat) => seat.y === edited.center.y - 42).length, 3);
  assert.equal(edited.seats.filter((seat) => seat.x === edited.center.x + 92).length, 2);
});

test("published documents preserve the configured floors and active floor", () => {
  const floors = [
    { id: "floor_1", name: "1층", abbreviation: "1F", index: 1 },
    { id: "floor_2", name: "2층", abbreviation: "2F", index: 2 },
  ];
  const document = chartDocument({
    tool: "row", name: "공연장", venue: null, objects: [], selectedIds: [],
    selectedSeatIds: [], referencePlan: null, rowSpacing: 14, seatSpacing: 5,
    multipleRowLayout: "aligned", focalPoint: null, draft: null,
    pan: { x: 0, y: 0 }, zoom: 1, showGrid: true, selectionLayer: "all",
    status: "준비", chartId: "chart_floor", assets: [], floors,
    activeFloorId: "floor_2", activeSectionId: null,
  });
  assert.deepEqual(document.floors, floors);
  assert.equal(document.activeFloorId, "floor_2");
});
