import test from "node:test";
import assert from "node:assert/strict";
import { isPublishedSeatChartRead, isSeatChartRoute } from "../backend/seat-chart-routing.js";

test("recognizes only the seat-chart API namespace", () => {
  // Given
  const paths = ["/api/seat-charts", "/api/seat-charts/chart-1", "/api/seat-charts/chart-1/publish"];

  // When
  const matches = paths.map(isSeatChartRoute);

  // Then
  assert.deepEqual(matches, [true, true, true]);
  assert.equal(isSeatChartRoute("/api/admin/session"), false);
});

test("allows the public server to read only a published chart bound to a show", () => {
  // Given
  const publishedPath = "/api/seat-charts/for-show/les-miserables";

  // When
  const allowedRead = isPublishedSeatChartRead("GET", publishedPath);

  // Then
  assert.equal(allowedRead, true);
  assert.equal(isPublishedSeatChartRead("POST", publishedPath), false);
  assert.equal(isPublishedSeatChartRead("GET", "/api/seat-charts"), false);
  assert.equal(isPublishedSeatChartRead("GET", "/api/seat-charts/chart-1"), false);
});
