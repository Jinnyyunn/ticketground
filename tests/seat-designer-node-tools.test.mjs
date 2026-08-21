import assert from "node:assert/strict";
import test from "node:test";
import { insertVertex, moveVertex, removeVertex, verticesOf } from "../src/lib/seat-designer/vertices.ts";

const polygon = {
  id: "area-1",
  type: "area",
  label: "스탠딩",
  layer: "interactive",
  capacity: 20,
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
};

test("polygon edge insertion and node movement preserve object identity", () => {
  const inserted = insertVertex(polygon, 1, { x: 50, y: 0 });
  assert.equal(inserted.id, polygon.id);
  assert.deepEqual(verticesOf(inserted)[1], { x: 50, y: 0 });
  const moved = moveVertex(inserted, 1, { x: 50, y: 20 });
  assert.deepEqual(verticesOf(moved)[1], { x: 50, y: 20 });
});

test("node removal rejects geometry below its valid minimum", () => {
  assert.equal(removeVertex(polygon, 1), polygon);
  const four = insertVertex(polygon, 1, { x: 50, y: 0 });
  assert.equal(verticesOf(removeVertex(four, 1)).length, 3);
});

test("segmented row node edits regenerate seats on the edited path", () => {
  const row = {
    id: "row-1",
    type: "row",
    label: "A",
    layer: "interactive",
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    seatCount: 6,
    path: [{ x: 0, y: 0 }, { x: 50, y: 30 }, { x: 100, y: 0 }],
    seats: [],
  };
  const moved = moveVertex(row, 1, { x: 50, y: 60 });
  assert.deepEqual(moved.path[1], { x: 50, y: 60 });
  assert.equal(moved.seats.some((seat) => seat.y > 30), true);
});
