import assert from "node:assert/strict";
import test from "node:test";
import { createObjectForTool } from "../src/lib/seat-designer/tools/create-object.ts";
import { constrainPointToAngle } from "../src/lib/seat-designer/geometry.ts";

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

test("reference defaults are preserved by the matching creation modes", () => {
  const common = { start, end, points: [start, { x: 70, y: 20 }, end], sequence: 1, floorId: "floor-1", categoryKey: "vip" };
  const roundTable = createObjectForTool({ ...common, tool: "table", mode: "tableRound" });
  assert.equal(roundTable.seatCount, 6);

  const rectangularTable = createObjectForTool({ ...common, tool: "table", mode: "tableRectangular", end: start });
  assert.equal(rectangularTable.shape, "rectangle");
  assert.equal(rectangularTable.width, 120);
  assert.equal(rectangularTable.height, 36);
  assert.deepEqual(rectangularTable.chairs, { top: 4, right: 0, bottom: 4, left: 0 });

  const booth = createObjectForTool({ ...common, tool: "booth", start, end: start, mode: "booth" });
  assert.equal(booth.width, 50);
  assert.equal(booth.height, 50);

  const icon = createObjectForTool({ ...common, tool: "icon", mode: "icon" });
  assert.equal(icon.size, 40);
});

test("area, shape, row, and line variants retain their editable geometry", () => {
  const common = { start, end, points: [start, { x: 70, y: 20 }, end], sequence: 1, floorId: "floor-1", categoryKey: "vip" };
  const ellipseArea = createObjectForTool({ ...common, tool: "area", mode: "areaEllipse" });
  assert.equal(ellipseArea.shape, "ellipse");

  const ellipseShape = createObjectForTool({ ...common, tool: "rectangle", mode: "shapeEllipse" });
  assert.equal(ellipseShape.shape, "ellipse");

  const segmentedRow = createObjectForTool({ ...common, tool: "row", mode: "rowSegmented" });
  assert.deepEqual(segmentedRow.path, common.points);
  assert.equal(segmentedRow.rowSpacing, 14);
  assert.equal(segmentedRow.seatSpacing, 5);
  assert.equal(segmentedRow.seats.some((seat) => seat.x > 60 && seat.y < 30), true);

  const polyline = createObjectForTool({ ...common, tool: "line", mode: "line" });
  assert.deepEqual(polyline.points, common.points);
});

test("Shift angle constraints match row and node tool increments", () => {
  const origin = { x: 0, y: 0 };
  const rowPoint = constrainPointToAngle(origin, { x: 100, y: 20 }, 15);
  const rowAngle = Math.round(Math.atan2(rowPoint.y, rowPoint.x) * 180 / Math.PI);
  assert.equal(rowAngle, 15);
  const linePoint = constrainPointToAngle(origin, { x: 80, y: 50 }, 45);
  const lineAngle = Math.round(Math.atan2(linePoint.y, linePoint.x) * 180 / Math.PI);
  assert.equal(lineAngle, 45);
});

test("segmented rows validate their complete path instead of endpoint distance", () => {
  const points = [{ x: 0, y: 0 }, { x: 160, y: 0 }, { x: 160, y: 120 }, { x: 3, y: 2 }];
  const row = createObjectForTool({ tool: "row", mode: "rowSegmented", start: points[0], end: points.at(-1), points, sequence: 1, floorId: "floor-1" });
  assert.ok(row);
  assert.equal(row.type, "row");
  assert.deepEqual(row.path, points);
  assert.ok(row.seats.length > 10);
});

test("multi-node lines validate their complete path instead of endpoint distance", () => {
  const points = [{ x: 0, y: 0 }, { x: 160, y: 0 }, { x: 160, y: 120 }, { x: 2, y: 1 }];
  const line = createObjectForTool({ tool: "line", start: points[0], end: points.at(-1), points, sequence: 1, floorId: "floor-1" });
  assert.ok(line);
  assert.equal(line.type, "line");
  assert.deepEqual(line.points, points);
});
