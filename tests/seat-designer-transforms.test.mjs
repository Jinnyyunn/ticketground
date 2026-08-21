import assert from "node:assert/strict";
import test from "node:test";
import { objectBounds, resizeObject, rotateObject } from "../src/lib/seat-designer/transforms.ts";

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
