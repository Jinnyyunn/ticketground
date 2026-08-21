import assert from "node:assert/strict";
import test from "node:test";
import { objectBounds, resizeBoundsForRotatedPointer, resizeObject, rotateObject } from "../src/lib/seat-designer/transforms.ts";
import { rotateAround } from "../src/lib/seat-designer/geometry.ts";

const rectangle = {
  id: "shape-1",
  type: "rectangle",
  label: "무대",
  layer: "background",
  x: 10,
  y: 20,
  width: 100,
  height: 50,
};

test("resize handles apply one affine transform to editable geometry", () => {
  assert.deepEqual(objectBounds(rectangle), { x: 10, y: 20, width: 100, height: 50 });
  const resized = resizeObject(rectangle, { x: 10, y: 20, width: 200, height: 100 });
  assert.deepEqual(
    { x: resized.x, y: resized.y, width: resized.width, height: resized.height },
    { x: 10, y: 20, width: 200, height: 100 },
  );
});

test("row paths and seats resize together without changing identity", () => {
  const row = {
    id: "row-1",
    type: "row",
    label: "A",
    layer: "interactive",
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    seatCount: 2,
    path: [{ x: 0, y: 0 }, { x: 50, y: 20 }, { x: 100, y: 0 }],
    seats: [{ id: "s1", label: "1", x: 0, y: 0 }, { id: "s2", label: "2", x: 100, y: 0 }],
  };
  const resized = resizeObject(row, { x: 0, y: 0, width: 200, height: 40 });
  assert.equal(resized.id, "row-1");
  assert.deepEqual(resized.path[1], { x: 100, y: 40 });
  assert.deepEqual(resized.seats.map((seat) => ({ x: seat.x, y: seat.y })), [{ x: 0, y: 0 }, { x: 200, y: 0 }]);
});

test("rotation is immutable and locked objects reject transforms", () => {
  assert.equal(rotateObject(rectangle, 35).rotation, 35);
  const locked = { ...rectangle, locked: true };
  assert.equal(resizeObject(locked, { x: 0, y: 0, width: 20, height: 20 }), locked);
  assert.equal(rotateObject(locked, 90), locked);
});

test("centered objects remain resizable at an exact 180-degree rotation", () => {
  const bounds = { x: 10, y: 20, width: 100, height: 50 };
  const pivot = { x: 60, y: 45 };
  const anchor = rotateAround({ x: bounds.x, y: bounds.y }, pivot, 180);
  const pointer = { x: -20, y: -10 };
  const resized = resizeBoundsForRotatedPointer(pointer, bounds, pivot, "se", 180);
  const nextPivot = { x: resized.x + resized.width / 2, y: resized.y + resized.height / 2 };
  const renderedHandle = rotateAround({ x: resized.x + resized.width, y: resized.y + resized.height }, nextPivot, 180);
  const renderedAnchor = rotateAround({ x: resized.x, y: resized.y }, nextPivot, 180);
  assert.ok(Math.abs(renderedHandle.x - pointer.x) < 1e-9 && Math.abs(renderedHandle.y - pointer.y) < 1e-9);
  assert.ok(Math.abs(renderedAnchor.x - anchor.x) < 1e-9 && Math.abs(renderedAnchor.y - anchor.y) < 1e-9);
});
