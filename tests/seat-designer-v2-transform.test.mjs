import test from "node:test";
import assert from "node:assert/strict";
import { createDraggedObject } from "../src/components/seat-designer-v2/object-factory.ts";
import { alignObjects, distributeObjects, duplicateObject, flipObjects, resizeObject } from "../src/components/seat-designer-v2/object-transform.ts";

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

test("multi-object distribution keeps the outer objects fixed and spaces centers equally", () => {
  const first = { id: "first", label: "첫째", layer: "interactive", type: "booth", x: 10, y: 20, width: 20, height: 20 };
  const middle = { id: "middle", label: "둘째", layer: "interactive", type: "booth", x: 40, y: 80, width: 40, height: 20 };
  const last = { id: "last", label: "셋째", layer: "interactive", type: "booth", x: 150, y: 140, width: 20, height: 20 };
  const horizontal = distributeObjects([first, middle, last], [first.id, middle.id, last.id], "horizontal");
  const horizontalCenters = horizontal.map((object) => {
    assert.equal(object.type, "booth");
    return object.x + object.width / 2;
  });
  assert.deepEqual(horizontalCenters, [20, 90, 160]);
  const vertical = distributeObjects([first, middle, last], [first.id, middle.id, last.id], "vertical");
  const verticalCenters = vertical.map((object) => {
    assert.equal(object.type, "booth");
    return object.y + object.height / 2;
  });
  assert.deepEqual(verticalCenters, [30, 90, 150]);
});

test("image resize preserves its source ratio while the ratio lock is active", () => {
  const image = { id: "image", label: "도면", layer: "background", type: "image", x: 10, y: 20, width: 200, height: 100, href: "/plan.png", aspectRatioLocked: true };
  const resized = resizeObject(image, { x: 10, y: 20 }, { x: 2, y: 1.2 });
  assert.equal(resized.type, "image");
  assert.equal(resized.width, 400);
  assert.equal(resized.height, 200);
});

test("horizontal and vertical flip mirror selected geometry around the group center", () => {
  const first = { id: "first", label: "첫째", layer: "interactive", type: "booth", x: 10, y: 20, width: 20, height: 20 };
  const last = { id: "last", label: "둘째", layer: "interactive", type: "booth", x: 90, y: 80, width: 30, height: 40 };
  const horizontal = flipObjects([first, last], [first.id, last.id], "horizontal");
  assert.deepEqual(horizontal.map((object) => object.type === "booth" ? object.x : null), [100, 10]);
  const vertical = flipObjects([first, last], [first.id, last.id], "vertical");
  assert.deepEqual(vertical.map((object) => object.type === "booth" ? object.y : null), [100, 20]);
});

test("locked objects stay fixed during alignment, distribution, and flip", () => {
  const first = { id: "first", label: "첫째", layer: "interactive", type: "booth", x: 0, y: 0, width: 20, height: 20 };
  const locked = { id: "locked", label: "잠금", layer: "interactive", type: "booth", x: 30, y: 70, width: 20, height: 20, locked: true };
  const middle = { id: "middle", label: "가운데", layer: "interactive", type: "booth", x: 70, y: 40, width: 20, height: 20 };
  const last = { id: "last", label: "끝", layer: "interactive", type: "booth", x: 150, y: 100, width: 20, height: 20 };
  const objects = [first, locked, middle, last];
  const ids = objects.map((object) => object.id);

  assert.deepEqual(alignObjects(objects, ids, "top")[1], locked);
  assert.deepEqual(distributeObjects(objects, ids, "horizontal")[1], locked);
  assert.deepEqual(flipObjects(objects, ids, "horizontal")[1], locked);
});

test("flipping an image mirrors its pixels even when it is the only selection", () => {
  const image = { id: "image", label: "도면", layer: "background", type: "image", x: 10, y: 20, width: 200, height: 100, href: "/plan.png" };
  const horizontal = flipObjects([image], [image.id], "horizontal")[0];
  const vertical = flipObjects([image], [image.id], "vertical")[0];

  assert.equal(horizontal.type, "image");
  assert.equal(horizontal.flipX, true);
  assert.equal(horizontal.x, image.x);
  assert.equal(vertical.type, "image");
  assert.equal(vertical.flipY, true);
  assert.equal(vertical.y, image.y);
});
