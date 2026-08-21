import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMultipleRows,
  constrainToAngleStep,
  rowDepth,
} from "../src/components/seat-designer-v2/row-geometry.ts";
import { deriveSmartGuides } from "../src/components/seat-designer-v2/smart-guides.ts";
import { fitReferenceAsset } from "../src/components/seat-designer-v2/reference-layout.ts";
import { insertPathNode, removePathNode } from "../src/components/seat-designer-v2/node-geometry.ts";

const baseRow = {
  id: "row-base",
  label: "A",
  layer: "interactive",
  type: "row",
  start: { x: 0, y: 0 },
  end: { x: 100, y: 0 },
  seatCount: 6,
  seats: [0, 20, 40, 60, 80, 100].map((x, index) => ({
    id: `seat-${index + 1}`,
    label: `${index + 1}`,
    x,
    y: 0,
  })),
};

test("multiple-row depth controls row count and direction instead of creating a fixed block", () => {
  const downward = buildMultipleRows(baseRow, { x: 40, y: 56 }, 14, "aligned");
  assert.equal(downward.length, 5);
  assert.deepEqual(downward.map((row) => row.start.y), [0, 14, 28, 42, 56]);
  assert.equal(new Set(downward.flatMap((row) => row.seats.map((seat) => seat.id))).size, 30);

  const upward = buildMultipleRows(baseRow, { x: 40, y: -29 }, 14, "aligned");
  assert.deepEqual(upward.map((row) => row.start.y), [0, -14, -28]);
  assert.equal(Math.round(rowDepth(baseRow, { x: 40, y: -29 })), -29);
});

test("staggered multiple rows offset every second row by half a seat pitch", () => {
  const rows = buildMultipleRows(baseRow, { x: 0, y: 28 }, 14, "staggered");
  assert.deepEqual(rows[0].seats.map((seat) => seat.x), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(rows[1].seats.map((seat) => seat.x), [10, 30, 50, 70, 90, 110]);
  assert.deepEqual(rows[2].seats.map((seat) => seat.x), [0, 20, 40, 60, 80, 100]);
});

test("Shift angle constraint rounds to a 15-degree step while preserving length", () => {
  const constrained = constrainToAngleStep({ x: 10, y: 10 }, { x: 107, y: 47 }, 15);
  const angle = Math.atan2(constrained.y - 10, constrained.x - 10) * 180 / Math.PI;
  assert.equal(Math.round(angle), 15);
  assert.equal(Math.round(Math.hypot(constrained.x - 10, constrained.y - 10)), 104);
});

test("smart guides snap center, axis, and projection independently with reference colors", () => {
  const result = deriveSmartGuides(
    { x: 98, y: 52 },
    {
      origin: { x: 20, y: 49 },
      centers: [{ x: 100, y: 120 }],
      projections: [{ x: 160, y: 50 }],
    },
    4,
  );
  assert.deepEqual(result.point, { x: 100, y: 50 });
  assert.deepEqual(result.guides.map((guide) => guide.kind).sort(), ["axis", "center", "projection"]);
  assert.deepEqual(result.guides.map((guide) => guide.color).sort(), ["blue", "green", "red"]);
});

test("reference fitting keeps the source aspect ratio within the available scene", () => {
  assert.deepEqual(
    fitReferenceAsset({ width: 2000, height: 1000 }, { width: 760, height: 560 }, { x: 80, y: 60 }),
    { x: 80, y: 150, width: 760, height: 380 },
  );
  assert.deepEqual(
    fitReferenceAsset({ width: 900, height: 1800 }, { width: 760, height: 560 }, { x: 80, y: 60 }),
    { x: 320, y: 60, width: 280, height: 560 },
  );
});

test("node editing inserts on an edge and refuses to remove below the shape minimum", () => {
  const triangle = [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 40, y: 60 }];
  const inserted = insertPathNode(triangle, 0, { x: 40, y: 0 });
  assert.deepEqual(inserted, [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 80, y: 0 }, { x: 40, y: 60 }]);
  assert.deepEqual(removePathNode(inserted, 1, 3), triangle);
  assert.deepEqual(removePathNode(triangle, 1, 3), triangle);
});
