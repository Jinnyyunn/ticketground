import assert from "node:assert/strict";
import test from "node:test";
import { pointInObjectFrame } from "../src/lib/seat-designer/transforms.ts";
import { insertionIndexForPoint } from "../src/lib/seat-designer/vertices.ts";

test("rotated resize pointers are converted into the object frame", () => {
  const point = pointInObjectFrame({ x: 150, y: 100 }, { x: 100, y: 100 }, 90);
  assert.ok(Math.abs(point.x - 100) < 0.001);
  assert.ok(Math.abs(point.y - 50) < 0.001);
});

test("node insertion chooses the segment itself rather than its midpoint", () => {
  const points = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 10 }];
  assert.equal(insertionIndexForPoint(points, { x: 999, y: 0 }, false), 1);
});
