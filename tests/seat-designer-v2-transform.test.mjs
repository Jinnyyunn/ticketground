import test from "node:test";
import assert from "node:assert/strict";
import { createDraggedObject } from "../src/components/seat-designer-v2/object-factory.ts";
import { alignObjects, duplicateObject } from "../src/components/seat-designer-v2/object-transform.ts";

test("duplicating a place-bearing object rotates every persisted identity", () => {
  const original = createDraggedObject("row", { x: 0, y: 0 }, { x: 180, y: 0 }, { seatSpacing: 5, objects: [] });
  assert.ok(original?.type === "row");
  const duplicate = duplicateObject(original, { x: 12, y: 12 });
  assert.equal(duplicate.type, "row");
  assert.notEqual(duplicate.id, original.id);
  assert.equal(duplicate.seats.length, original.seats.length);
  assert.equal(new Set([...original.seats, ...duplicate.seats].map((seat) => seat.id)).size, original.seats.length * 2);
  assert.equal(duplicate.seats[0]?.x, (original.seats[0]?.x ?? 0) + 12);
});

test("multi-object alignment uses the selection bounds without changing size", () => {
  const left = { id: "left", label: "왼쪽", layer: "interactive", type: "booth", x: 10, y: 20, width: 30, height: 40 };
  const right = { id: "right", label: "오른쪽", layer: "interactive", type: "booth", x: 90, y: 70, width: 20, height: 25 };
  const aligned = alignObjects([left, right], [left.id, right.id], "top");
  assert.deepEqual(aligned.map((object) => object.type === "booth" ? object.y : null), [20, 20]);
  assert.deepEqual(aligned.map((object) => object.type === "booth" ? object.height : null), [40, 25]);
});
