import assert from "node:assert/strict";
import test from "node:test";
import { countPlaces, duplicateObjects } from "../src/lib/seat-designer/chart-ops.ts";
import { commitHistory, createHistory, undoHistory } from "../src/lib/seat-designer/history.ts";
import { marqueeObjectSelection } from "../src/lib/seat-designer/selection.ts";

function largeChart(placeCount) {
  const seatsPerRow = 10;
  const rowCount = placeCount / seatsPerRow;
  return {
    version: 2,
    id: `chart-${placeCount}`,
    name: `${placeCount}석 성능 차트`,
    published: false,
    activeFloorId: "floor-1",
    floors: [{ id: "floor-1", name: "1층", order: 0 }],
    categories: [{ key: "vip", label: "VIP", color: "#0784fa" }],
    objects: Array.from({ length: rowCount }, (_, rowIndex) => {
      const y = rowIndex * 20;
      return {
        id: `row-${rowIndex}`,
        type: "row",
        label: `${rowIndex + 1}열`,
        layer: "interactive",
        floorId: "floor-1",
        categoryKey: "vip",
        start: { x: 0, y },
        end: { x: 180, y },
        seatCount: seatsPerRow,
        seats: Array.from({ length: seatsPerRow }, (_, seatIndex) => ({
          id: `seat-${rowIndex}-${seatIndex}`,
          label: String(seatIndex + 1),
          x: seatIndex * 20,
          y,
        })),
      };
    }),
  };
}

for (const placeCount of [5_000, 10_000]) {
  test(`${placeCount.toLocaleString()} bookable places remain responsive across selection, history, and serialization`, () => {
    const chart = largeChart(placeCount);
    const startedAt = performance.now();
    assert.equal(countPlaces(chart), placeCount);
    const selected = marqueeObjectSelection(
      chart,
      { x: -10, y: -10 },
      { x: 200, y: chart.objects.length * 20 },
      "interactive",
    );
    assert.equal(selected.length, chart.objects.length);
    const duplicated = duplicateObjects(chart, selected.slice(0, 20));
    assert.equal(duplicated.objects.length, chart.objects.length + 20);
    const committed = commitHistory(createHistory({ document: chart, selection: [] }), {
      document: duplicated,
      selection: selected.slice(0, 20),
    });
    assert.equal(undoHistory(committed).present.document.objects.length, chart.objects.length);
    assert.ok(Buffer.byteLength(JSON.stringify(chart)) < 4 * 1024 * 1024);
    assert.ok(performance.now() - startedAt < 2_000, `${placeCount} place operations exceeded 2 seconds`);
  });
}
