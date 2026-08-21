import assert from "node:assert/strict";
import test from "node:test";
import { chartToSellableSeats } from "../src/lib/seat-charts/inventory.ts";
import { createObjectForTool } from "../src/lib/seat-designer/tools/create-object.ts";
import { objectBounds } from "../src/lib/seat-designer/transforms.ts";
import { blockingValidationItems } from "../src/lib/seat-designer/validation.ts";

const common = { sequence: 1, floorId: "floor-1" };

test("polygon creation derives scalar bounds from every vertex", () => {
  const polygon = createObjectForTool({
    ...common,
    tool: "rectangle",
    mode: "shapePolygon",
    start: { x: 10, y: 10 },
    end: { x: 10, y: 80 },
    points: [{ x: 10, y: 10 }, { x: 160, y: 10 }, { x: 160, y: 80 }, { x: 10, y: 80 }],
  });
  assert.ok(polygon);
  assert.equal(polygon.width, 150);
  assert.equal(polygon.height, 70);
});

test("ellipse capacity positions stay inside the published ellipse", () => {
  const area = createObjectForTool({
    ...common,
    tool: "area",
    mode: "areaEllipse",
    start: { x: 0, y: 0 },
    end: { x: 200, y: 100 },
    points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }],
  });
  assert.ok(area);
  const inventory = chartToSellableSeats({ id: "chart", name: "ellipse", categories: [], objects: [area] }, {});
  assert.equal(inventory.seats.length, 50);
  for (const seat of inventory.seats) {
    const normalized = ((seat.x - 100) / 100) ** 2 + ((seat.y - 50) / 50) ** 2;
    assert.ok(normalized <= 1, `${seat.id} is outside the ellipse`);
  }
});

test("degenerate polygon areas cannot publish duplicate marker positions", () => {
  const area = {
    id: "flat-area",
    type: "area",
    shape: "polygon",
    label: "퇴화 영역",
    layer: "interactive",
    categoryKey: "vip",
    capacity: 4,
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }],
  };
  const chart = { id: "chart", name: "degenerate", categories: [{ key: "vip", label: "VIP", color: "#111111" }], objects: [area] };
  assert.equal(chartToSellableSeats(chart, {}).seats.length, 0);
  assert.ok(blockingValidationItems(chart).some((item) => item.id === "areaGeometry"));
});

test("text bounds follow content width and alignment", () => {
  const left = { id: "text", type: "text", label: "text", layer: "foreground", position: { x: 100, y: 100 }, text: "긴 좌석 안내 문구", fontSize: 20, align: "left" };
  const right = { ...left, id: "right", align: "right" };
  const leftBounds = objectBounds(left);
  const rightBounds = objectBounds(right);
  assert.equal(leftBounds.x, 100);
  assert.ok(leftBounds.width > 100);
  assert.equal(rightBounds.x + rightBounds.width, 100);
});

test("rectangular table chairs have unique sequential labels at creation", () => {
  const table = createObjectForTool({
    ...common,
    tool: "table",
    mode: "tableRectangular",
    start: { x: 0, y: 0 },
    end: { x: 120, y: 36 },
    points: [{ x: 0, y: 0 }, { x: 120, y: 36 }],
  });
  assert.ok(table);
  assert.deepEqual(table.seats.map((seat) => seat.label), ["테이블 1-1", "테이블 1-2", "테이블 1-3", "테이블 1-4", "테이블 1-5", "테이블 1-6", "테이블 1-7", "테이블 1-8"]);
});

test("row creation applies the declared five-point gap between ten-point seats", () => {
  const row = createObjectForTool({
    ...common,
    tool: "row",
    mode: "rowStraight",
    start: { x: 0, y: 0 },
    end: { x: 150, y: 0 },
    points: [{ x: 0, y: 0 }, { x: 150, y: 0 }],
  });
  assert.ok(row);
  assert.equal(row.seatSpacing, 5);
  assert.equal(row.seats.length, 11);
  assert.equal(row.seats[1].x - row.seats[0].x, 15);
});
