import assert from "node:assert/strict";
import test from "node:test";
import { chartToSellableSeats } from "../src/lib/seat-charts/inventory.ts";
import {
  alignCenter,
  applyCategory,
  chartBounds,
  duplicateObjects,
  flipObjects,
  removeObjects,
  setDecorationProps,
  setObjectLabel,
  setObjectAdvanced,
  setRowGeometry,
  translateMany,
} from "../src/lib/seat-designer/chart-ops.ts";
import { marqueeObjectSelection } from "../src/lib/seat-designer/selection.ts";
import { resizeObject } from "../src/lib/seat-designer/transforms.ts";
import { createObjectForTool } from "../src/lib/seat-designer/tools/create-object.ts";
import { toolHelpFor } from "../src/lib/seat-designer/tool-help.ts";
import { insertVertex } from "../src/lib/seat-designer/vertices.ts";

const prices = { VIP: 100_000, R: 80_000, S: 60_000, A: 40_000 };

function chart(objects) {
  return {
    id: "chart",
    name: "검토",
    categories: [{ key: "vip", label: "VIP", color: "#111111" }],
    floors: [{ id: "floor-1", name: "1층", index: 1 }],
    activeFloorId: "floor-1",
    objects,
  };
}

test("published inventory applies object rotation and excludes decorative layers", () => {
  const rotated = {
    id: "rotated",
    type: "row",
    label: "A",
    layer: "interactive",
    rotation: 90,
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    seatCount: 2,
    seats: [{ id: "a1", label: "1", x: 0, y: 0 }, { id: "a2", label: "2", x: 100, y: 0 }],
  };
  const decorative = { ...rotated, id: "decorative", layer: "background", rotation: 0, seats: [{ id: "hidden", label: "1", x: 200, y: 0 }] };
  const result = chartToSellableSeats(chart([rotated, decorative]), prices);
  assert.deepEqual(result.seats.map(({ id, x, y }) => ({ id, x: Math.round(x), y: Math.round(y) })), [
    { id: "a1", x: 50, y: -50 },
    { id: "a2", x: 50, y: 50 },
  ]);
});

test("variable-occupancy tables publish one qualified booking unit", () => {
  const table = {
    id: "table",
    type: "table",
    label: "T1",
    layer: "interactive",
    center: { x: 100, y: 80 },
    radius: 30,
    seatCount: 6,
    variableOccupancy: true,
    minOccupancy: 2,
    maxOccupancy: 4,
    seats: Array.from({ length: 6 }, (_, index) => ({ id: `t${index + 1}`, label: `${index + 1}`, x: 50 + index * 10, y: 80 })),
  };
  const result = chartToSellableSeats(chart([table]), prices);
  assert.equal(result.seats.length, 1);
  assert.equal(result.seats[0].bookingMode, "variable");
  assert.equal(result.seats[0].minOccupancy, 2);
  assert.equal(result.seats[0].maxOccupancy, 4);
});

test("polygon-area inventory never leaves the visible polygon", () => {
  const area = { id: "triangle", type: "area", shape: "polygon", label: "스탠딩", layer: "interactive", points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 0, y: 100 }], capacity: 40 };
  const result = chartToSellableSeats(chart([area]), prices);
  assert.equal(result.seats.length, 40);
  for (const seat of result.seats) assert.ok(seat.x / 200 + seat.y / 100 <= 1, `${seat.id} must stay inside the triangle`);
});

test("place-bearing objects cannot be reclassified as decorative layers", () => {
  const row = { id: "row", type: "row", label: "A", layer: "interactive", start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, seatCount: 2, seats: [{ id: "a1", label: "1", x: 0, y: 0 }, { id: "a2", label: "2", x: 100, y: 0 }] };
  assert.equal(setObjectAdvanced(chart([row]), row.id, { layer: "background" }).objects[0].layer, "interactive");
});

test("segmented row property edits keep seats on the editable path", () => {
  const row = {
    id: "segmented",
    type: "row",
    label: "A",
    layer: "interactive",
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    path: [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }],
    seatCount: 3,
    seats: [{ id: "s1", label: "1", x: 0, y: 0, displayedLabel: "첫 좌석", accessible: true }, { id: "s2", label: "2", x: 50, y: 50 }, { id: "s3", label: "3", x: 100, y: 0 }],
  };
  const updated = setRowGeometry(chart([row]), row.id, { seatCount: 5 });
  assert.equal(updated.objects[0].seats.some((seat) => seat.y > 0), true);
  assert.deepEqual(updated.objects[0].path, row.path);
  assert.deepEqual(updated.objects[0].seats.slice(0, 3).map((seat) => seat.id), ["s1", "s2", "s3"]);
  assert.equal(updated.objects[0].seats[0].displayedLabel, "첫 좌석");
  assert.equal(updated.objects[0].seats[0].accessible, true);
  const curveOnly = setRowGeometry(chart([row]), row.id, { curve: 25 });
  assert.deepEqual(curveOnly.objects[0].seats, row.seats);
});

test("fit bounds include the rendered rotation of long objects", () => {
  const row = {
    id: "vertical-after-rotation",
    type: "row",
    label: "A",
    layer: "interactive",
    rotation: 90,
    start: { x: 0, y: 0 },
    end: { x: 1000, y: 0 },
    seatCount: 2,
    seats: [{ id: "a1", label: "1", x: 0, y: 0 }, { id: "a2", label: "2", x: 1000, y: 0 }],
  };
  const bounds = chartBounds(chart([row]));
  assert.ok(bounds.height > 1000, `rotated height ${bounds.height} must include the rendered row`);
  assert.ok(bounds.width < 40, `rotated width ${bounds.width} must follow the rendered row`);
});

test("locked objects reject destructive and positional chart commands", () => {
  const locked = { id: "locked", type: "rectangle", label: "무대", layer: "background", locked: true, x: 10, y: 20, width: 80, height: 40 };
  const unlocked = { id: "free", type: "rectangle", label: "안내", layer: "foreground", x: 130, y: 20, width: 40, height: 20 };
  const source = chart([locked, unlocked]);
  assert.equal(removeObjects(source, [locked.id]).objects.length, 2);
  assert.equal(duplicateObjects(source, [locked.id]).objects.length, 2);
  assert.deepEqual(flipObjects(source, [locked.id], "h", { x: 100, y: 0 }).objects[0], locked);
  assert.deepEqual(translateMany(source, [locked.id], 25, 10).objects[0], locked);
  assert.deepEqual(applyCategory(source, [locked.id], "vip").objects[0], locked);
  assert.deepEqual(alignCenter(source, [locked.id, unlocked.id]).objects[0], locked);
  assert.deepEqual(setObjectLabel(source, locked.id, "삭제 금지").objects[0], locked);
  assert.deepEqual(setDecorationProps(source, locked.id, { width: 200 }).objects[0], locked);
  const lockedPolygon = { ...locked, shape: "polygon", points: [{ x: 10, y: 20 }, { x: 90, y: 20 }, { x: 50, y: 60 }] };
  assert.deepEqual(insertVertex(lockedPolygon, 1, { x: 40, y: 20 }), lockedPolygon);
});

test("rectangular table drag size drives its body, fit bounds, and marquee bounds", () => {
  const table = createObjectForTool({
    tool: "table",
    mode: "tableRectangular",
    start: { x: 20, y: 30 },
    end: { x: 220, y: 110 },
    points: [{ x: 20, y: 30 }, { x: 220, y: 110 }],
    sequence: 1,
    floorId: "floor-1",
  });
  assert.equal(table.width, 200);
  assert.equal(table.height, 80);
  const bounds = chartBounds(chart([table]));
  assert.ok(bounds.width >= 200);
  assert.ok(bounds.height >= 80);
  assert.deepEqual(marqueeObjectSelection(chart([table]), { x: 15, y: 10 }, { x: 225, y: 130 }, "all"), [table.id]);
  assert.deepEqual(marqueeObjectSelection(chart([table]), { x: 80, y: 55 }, { x: 160, y: 85 }, "all"), []);
});

test("round tables keep a circular body and circular chair geometry after resize", () => {
  const table = createObjectForTool({
    tool: "table",
    mode: "tableRound",
    start: { x: 100, y: 100 },
    end: { x: 128, y: 100 },
    points: [{ x: 100, y: 100 }],
    sequence: 1,
    floorId: "floor-1",
  });
  const legacyTable = { ...table };
  delete legacyTable.shape;
  const resized = resizeObject(legacyTable, { x: 20, y: 40, width: 180, height: 80 });
  const distances = resized.seats.map((seat) => Math.hypot(seat.x - resized.center.x, seat.y - resized.center.y));
  assert.ok(Math.max(...distances) - Math.min(...distances) < 0.001);
});

test("polygon dimension edits resize the rendered point geometry", () => {
  const polygon = { id: "polygon", type: "rectangle", shape: "polygon", label: "무대", layer: "background", x: 10, y: 20, width: 100, height: 50, points: [{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 60, y: 70 }] };
  const updated = setDecorationProps(chart([polygon]), polygon.id, { width: 200, height: 100 });
  assert.deepEqual(updated.objects[0].points, [{ x: 10, y: 20 }, { x: 210, y: 20 }, { x: 110, y: 120 }]);
});

test("node help describes the implemented single-click and context-menu gestures", () => {
  assert.deepEqual(toolHelpFor("node").instructions, [
    "노드를 드래그하여 이동합니다.",
    "변을 클릭하면 노드가 추가되고 노드를 보조 클릭하면 삭제됩니다.",
  ]);
});
