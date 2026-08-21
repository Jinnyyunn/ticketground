import assert from "node:assert/strict";
import test from "node:test";
import { pointInObjectFrame } from "../src/lib/seat-designer/transforms.ts";
import { insertionIndexForPoint, moveVertex } from "../src/lib/seat-designer/vertices.ts";

test("rotated resize pointers are converted into the object frame", () => {
  const point = pointInObjectFrame({ x: 150, y: 100 }, { x: 100, y: 100 }, 90);
  assert.ok(Math.abs(point.x - 100) < 0.001);
  assert.ok(Math.abs(point.y - 50) < 0.001);
});

test("node insertion chooses the segment itself rather than its midpoint", () => {
  const points = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 10 }];
  assert.equal(insertionIndexForPoint(points, { x: 999, y: 0 }, false), 1);
});

test("polygon node edits refresh scalar selection bounds", () => {
  const polygon = { id: "polygon", type: "rectangle", shape: "polygon", label: "무대", layer: "background", x: 0, y: 0, width: 100, height: 100, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] };
  const moved = moveVertex(polygon, 1, { x: 180, y: -20 });
  assert.equal(moved.x, 0);
  assert.equal(moved.y, -20);
  assert.equal(moved.width, 180);
  assert.equal(moved.height, 120);
});
