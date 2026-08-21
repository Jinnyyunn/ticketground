import assert from "node:assert/strict";
import test from "node:test";
import {
  alignCenter,
  duplicateObjects,
  flipObjects,
  removeObjects,
  translateMany,
} from "../src/lib/seat-designer/chart-ops.ts";

const section = {
  id: "section-a",
  type: "section",
  label: "A구역",
  layer: "interactive",
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
  nestedRows: [{ id: "nested-row", type: "row", label: "A", layer: "interactive", start: { x: 10, y: 20 }, end: { x: 80, y: 20 }, seatCount: 2, seats: [{ id: "nested-1", label: "1", x: 10, y: 20 }, { id: "nested-2", label: "2", x: 80, y: 20 }] }],
};
const rectangle = { id: "rect", type: "rectangle", label: "무대", layer: "foreground", x: 160, y: 20, width: 80, height: 40 };
const chart = { id: "chart", name: "테스트", categories: [], floors: [{ id: "floor-1", name: "1층", index: 1 }], activeFloorId: "floor-1", objects: [section, rectangle] };

test("duplicate and flip preserve nested relative geometry with fresh identities", () => {
  const duplicated = duplicateObjects(chart, [section.id], 24);
  const clone = duplicated.objects[2];
  assert.notEqual(clone.id, section.id);
  assert.notEqual(clone.nestedRows[0].id, section.nestedRows[0].id);
  assert.equal(clone.nestedRows[0].start.x, section.nestedRows[0].start.x + 24);
  assert.deepEqual(clone.nestedRows[0].seats.map((seat) => seat.label), ["A 복사-1", "A 복사-2"]);
  const flipped = flipObjects(duplicated, [clone.id], "h", { x: 100, y: 50 });
  assert.equal(flipped.objects[2].points[0].x, 176);
});

test("duplicated rows regenerate canonical labels while preserving seat metadata", () => {
  const row = {
    ...section.nestedRows[0],
    seats: section.nestedRows[0].seats.map((seat, index) => ({ ...seat, label: `A-${index + 1}`, displayedLabel: `${index + 1}번`, accessible: index === 0 })),
  };
  const duplicated = duplicateObjects({ ...chart, objects: [row] }, [row.id], 24);
  const clone = duplicated.objects[1];
  assert.deepEqual(clone.seats.map((seat) => seat.label), ["A 복사-1", "A 복사-2"]);
  assert.deepEqual(clone.seats.map((seat) => seat.displayedLabel), ["1번", "2번"]);
  assert.equal(clone.seats[0].accessible, true);
  const duplicatedAgain = duplicateObjects(duplicated, [row.id], 48);
  assert.deepEqual(duplicatedAgain.objects[2].seats.map((seat) => seat.label), ["A 복사 2-1", "A 복사 2-2"]);
  assert.equal(new Set(duplicatedAgain.objects.flatMap((object) => object.seats?.map((seat) => seat.label) ?? [])).size, 6);
});

test("copy labels remain unique under backend whitespace normalization", () => {
  const source = {
    ...section.nestedRows[0],
    seats: section.nestedRows[0].seats.map((seat, index) => ({ ...seat, label: `A-${index + 1}` })),
  };
  const compactCopy = {
    ...source,
    id: "compact-copy",
    label: "A복사",
    seats: source.seats.map((seat, index) => ({ ...seat, id: `compact-${index}`, label: `A복사-${index + 1}` })),
  };
  const duplicated = duplicateObjects({ ...chart, objects: [source, compactCopy] }, [source.id], 24);
  assert.equal(duplicated.objects[2].label, "A 복사 2");
  assert.deepEqual(duplicated.objects[2].seats.map((seat) => seat.label), ["A 복사 2-1", "A 복사 2-2"]);
});

test("flipping visible geometry negates top-level and nested rotations", () => {
  const rotatedSection = {
    ...section,
    rotation: 30,
    nestedRows: [{ ...section.nestedRows[0], rotation: 45 }],
  };
  const flipped = flipObjects({ ...chart, objects: [rotatedSection] }, [rotatedSection.id], "h", { x: 100, y: 50 }).objects[0];
  assert.equal(flipped.rotation, 330);
  assert.equal(flipped.nestedRows[0].rotation, 315);
});

test("align, translate, and delete are immutable whole transactions", () => {
  const aligned = alignCenter(chart, [section.id, rectangle.id]);
  assert.notEqual(aligned, chart);
  const moved = translateMany(aligned, [rectangle.id], 10, -5);
  assert.equal(moved.objects[1].x, aligned.objects[1].x + 10);
  const removed = removeObjects(moved, [section.id]);
  assert.deepEqual(removed.objects.map((object) => object.id), [rectangle.id]);
  assert.equal(chart.objects.length, 2);
});
