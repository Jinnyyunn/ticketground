import test from "node:test";
import assert from "node:assert/strict";
import { selectPublishedChartForShow } from "../src/lib/seat-charts/published-chart-selection.ts";

const chart = (id, published, boundShowSlugs) => ({
  id,
  name: id,
  published,
  placeCount: 100,
  boundShowSlugs,
  updatedAt: "2026-08-05T00:00:00.000Z",
});

test("selects only a published chart explicitly bound to the requested show", () => {
  // Given
  const charts = [
    chart("unbound-published", true, []),
    chart("bound-draft", false, ["show-a"]),
    chart("bound-published", true, ["show-a"]),
  ];

  // When
  const selected = selectPublishedChartForShow(charts, "show-a");

  // Then
  assert.equal(selected?.id, "bound-published");
});

test("does not fall back to another show's published chart", () => {
  // Given
  const charts = [chart("other-show", true, ["show-b"]), chart("unbound", true, [])];

  // When
  const selected = selectPublishedChartForShow(charts, "show-a");

  // Then
  assert.equal(selected, undefined);
});
