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

test("segmented row node edits preserve stable seat identities and attributes", () => {
  const row = {
    id: "row-stable",
    type: "row",
    label: "A",
    layer: "interactive",
    start: { x: 0, y: 0 },
    end: { x: 100, y: 0 },
    seatCount: 3,
    path: [{ x: 0, y: 0 }, { x: 50, y: 30 }, { x: 100, y: 0 }],
    seats: [
      { id: "stable-1", label: "A-1", displayedLabel: "1번", x: 0, y: 0, accessible: true },
      { id: "stable-2", label: "A-2", x: 50, y: 30, companion: true, categoryKey: "vip" },
      { id: "stable-3", label: "A-3", x: 100, y: 0, restrictedView: true, viewFromSeatHref: "/seat.jpg" },
    ],
  };
  const moved = moveVertex(row, 1, { x: 50, y: 80 });
  const logicalSeat = (seat) => Object.fromEntries(Object.entries(seat).filter(([key]) => key !== "x" && key !== "y"));
  assert.deepEqual(moved.seats.map(logicalSeat), row.seats.map(logicalSeat));
  assert.equal(moved.seats.some((seat) => seat.y > 30), true);
});

test("ellipse areas do not expose unrelated polygon node handles", () => {
  const ellipse = { id: "ellipse", type: "area", label: "타원", layer: "interactive", shape: "ellipse", capacity: 20, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }] };
  assert.deepEqual(verticesOf(ellipse), []);
});
