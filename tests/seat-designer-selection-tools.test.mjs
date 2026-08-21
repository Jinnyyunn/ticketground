import assert from "node:assert/strict";
import test from "node:test";
import {
  brushSeatSelection,
  marqueeObjectSelection,
  mutatePolygonNode,
  sameTypeSelection,
  toggleSelection,
} from "../src/lib/seat-designer/selection.ts";

const chart = {
  activeFloorId: "floor-1",
  objects: [
    { id: "foreground", type: "rectangle", label: "무대", layer: "foreground", x: 10, y: 10, width: 40, height: 30 },
    { id: "locked", type: "rectangle", label: "잠금", layer: "background", x: 60, y: 10, width: 30, height: 30, locked: true },
    { id: "section", type: "section", label: "A", layer: "interactive", points: [{ x: 10, y: 60 }, { x: 80, y: 60 }, { x: 80, y: 100 }] },
    { id: "row", type: "row", label: "A", layer: "interactive", start: { x: 10, y: 120 }, end: { x: 70, y: 120 }, seatCount: 2, seats: [{ id: "s1", label: "1", x: 10, y: 120 }, { id: "s2", label: "2", x: 70, y: 120 }] },
  ],
};

test("selection modes toggle, filter layers, respect locks, and distinguish crossing marquee", () => {
  assert.deepEqual(toggleSelection(["foreground"], "foreground"), []);
  assert.deepEqual(toggleSelection(["foreground"], "section"), ["foreground", "section"]);
  assert.deepEqual(sameTypeSelection(chart, "foreground"), ["foreground"]);
  assert.deepEqual(marqueeObjectSelection(chart, { x: 0, y: 0 }, { x: 55, y: 50 }, "all"), ["foreground"]);
  assert.deepEqual(marqueeObjectSelection(chart, { x: 85, y: 0 }, { x: 45, y: 50 }, "all"), ["foreground"]);
  assert.deepEqual(marqueeObjectSelection(chart, { x: 0, y: 0 }, { x: 100, y: 50 }, "background"), []);
});

test("brush supports additive and subtractive seat selection", () => {
  assert.deepEqual(brushSeatSelection(["s1"], ["s2"], "add"), ["s1", "s2"]);
  assert.deepEqual(brushSeatSelection(["s1", "s2"], ["s1"], "remove"), ["s2"]);
});

test("marquee selection uses the rendered bounds of rotated objects", () => {
  const rotated = {
    id: "rotated",
    type: "rectangle",
    label: "회전 도형",
    layer: "background",
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    rotation: 90,
  };
  assert.deepEqual(marqueeObjectSelection({ objects: [rotated] }, { x: 35, y: -45 }, { x: 65, y: 65 }, "all"), [rotated.id]);
  assert.deepEqual(marqueeObjectSelection({ objects: [rotated] }, { x: -5, y: 5 }, { x: 105, y: 15 }, "all"), []);
});

test("node editing adds, moves, and removes polygon nodes without mutating the source", () => {
  const source = chart.objects[2];
  const added = mutatePolygonNode(source, { type: "add", index: 1, point: { x: 45, y: 58 } });
  assert.equal(added.points.length, 4);
  const moved = mutatePolygonNode(added, { type: "move", index: 1, point: { x: 44, y: 55 } });
  assert.deepEqual(moved.points[1], { x: 44, y: 55 });
  const removed = mutatePolygonNode(moved, { type: "remove", index: 1 });
  assert.deepEqual(removed.points, source.points);
  assert.equal(source.points.length, 3);
});
