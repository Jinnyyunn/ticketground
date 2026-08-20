import test from "node:test";
import assert from "node:assert/strict";
import { selectPublishedChartForVenue } from "../src/lib/seat-charts/published-chart-selection.ts";

const chart = (id, published, boundVenue, updatedAt) => ({
  id,
  name: id,
  published,
  placeCount: 100,
  boundVenue,
  updatedAt,
});

test("selects the latest published chart assigned to the requested venue", () => {
  // Given
  const charts = [
    chart("other-venue", true, { id: "venue-b", name: "공연장 B" }, "2026-08-20T08:00:00.000Z"),
    chart("venue-draft", false, { id: "venue-a", name: "공연장 A" }, "2026-08-20T09:00:00.000Z"),
    chart("venue-older", true, { id: "venue-a", name: "공연장 A" }, "2026-08-20T10:00:00.000Z"),
    chart("venue-latest", true, { id: "venue-a", name: "공연장 A" }, "2026-08-20T11:00:00.000Z"),
  ];

  // When
  const selected = selectPublishedChartForVenue(charts, "venue-a");

  // Then
  assert.equal(selected?.id, "venue-latest");
});

test("does not fall back to a chart assigned to another venue", () => {
  // Given
  const charts = [
    chart("other-venue", true, { id: "venue-b", name: "공연장 B" }, "2026-08-20T08:00:00.000Z"),
    chart("unassigned", true, null, "2026-08-20T09:00:00.000Z"),
  ];

  // When
  const selected = selectPublishedChartForVenue(charts, "venue-a");

  // Then
  assert.equal(selected, undefined);
});
