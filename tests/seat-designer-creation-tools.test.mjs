import assert from "node:assert/strict";
import test from "node:test";
import { createObjectForTool } from "../src/lib/seat-designer/tools/create-object.ts";

const start = { x: 10, y: 20 };
const end = { x: 110, y: 80 };

test("every creation tool produces typed geometry with the intended default layer", () => {
  const expected = {
    row: "interactive",
    section: "interactive",
    table: "interactive",
    booth: "interactive",
    area: "interactive",
    rectangle: "background",
    line: "background",
    text: "foreground",
    image: "background",
    icon: "foreground",
  };
  for (const [tool, layer] of Object.entries(expected)) {
    const object = createObjectForTool({ tool, start, end, points: [start, { x: 110, y: 20 }, end], sequence: 2, floorId: "floor-1", categoryKey: "vip", imageHref: "/asset.png" });
    assert.equal(object.type, tool);
    assert.equal(object.layer, layer);
    assert.equal(object.floorId, "floor-1");
  }
});

test("invalid geometry does not create an object", () => {
  assert.equal(createObjectForTool({ tool: "row", start, end: { x: 11, y: 20 }, points: [], sequence: 1, floorId: "floor-1" }), null);
  assert.equal(createObjectForTool({ tool: "section", start, end, points: [start, end], sequence: 1, floorId: "floor-1" }), null);
  assert.equal(createObjectForTool({ tool: "image", start, end, points: [], sequence: 1, floorId: "floor-1" }), null);
});
