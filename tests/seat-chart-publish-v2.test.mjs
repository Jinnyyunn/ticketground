import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("saving and publishing activates an immutable chart revision for one venue", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "ticketground-v2-store-"));
  process.env.TIG_SEAT_CHART_DATA_DIR = rootDir;
  const store = await import(`../src/lib/seat-charts/v2-store.ts?test=${Date.now()}`);
  const venue = { id: "venue-jamsil", name: "잠실종합운동장 주경기장" };
  const chart = {
    id: "new-chart",
    name: "주경기장 좌석도",
    venueType: "simple",
    categories: [{ key: "vip", label: "VIP", color: "#111111" }],
    floors: [{ id: "floor-1", name: "1층", index: 1 }],
    activeFloorId: "floor-1",
    focalPoint: { x: 10, y: -20 },
    zones: [],
    objects: [{ id: "area", type: "area", label: "스탠딩", layer: "interactive", categoryKey: "vip", points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }], capacity: 100 }],
  };

  const draft = await store.saveSeatChart({ chart, boundVenue: venue });
  assert.match(draft.id, /^chart_/);
  assert.equal(draft.chart.draftRevision, 1);
  const published = await store.publishSeatChart(draft.id, true, venue);
  assert.equal(published.chart.published, true);
  const active = await store.getPublishedChartForVenue(venue.id);
  assert.equal(active.id, draft.id);
  assert.equal(active.chart.name, chart.name);
  assert.equal((await store.listSeatCharts())[0].boundVenue.id, venue.id);
});

test("publishing rejects an invalid draft without replacing the active venue revision", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "ticketground-v2-invalid-"));
  process.env.TIG_SEAT_CHART_DATA_DIR = rootDir;
  const store = await import(`../src/lib/seat-charts/v2-store.ts?invalid=${Date.now()}`);
  const venue = { id: "venue-empty", name: "빈 공연장" };
  const draft = await store.saveSeatChart({ chart: { id: "new", name: "빈 좌석도", categories: [], floors: [], activeFloorId: "", zones: [], objects: [] }, boundVenue: venue });
  await assert.rejects(() => store.publishSeatChart(draft.id, true, venue), (error) => error.name === "SeatChartValidationError" && error.items.some((item) => item.id === "places"));
  assert.equal(await store.getPublishedChartForVenue(venue.id), null);
});
