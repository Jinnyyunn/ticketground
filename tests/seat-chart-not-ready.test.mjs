import assert from "node:assert/strict";
import test from "node:test";

import { canEnterSeatSelection, seatChartReadinessMessage } from "../src/lib/seat-charts/readiness.ts";

test("shows without an active venue chart cannot enter seat selection", () => {
  const schedule = { bookable: true, timerExpired: false, date: "2026.09.01", time: "19:00", quantity: 2 };
  assert.equal(canEnterSeatSelection({ ...schedule, chartReady: false, inventoryReady: true }), false);
  assert.equal(seatChartReadinessMessage({ loaded: true, chartReady: false, bindingReady: false }), "공연장 좌석 배치도 준비 중");
});

test("seat selection opens only after published geometry and live inventory bind", () => {
  const schedule = { bookable: true, timerExpired: false, date: "2026.09.01", time: "19:00", quantity: 2 };
  assert.equal(canEnterSeatSelection({ ...schedule, chartReady: true, inventoryReady: false }), false);
  assert.equal(canEnterSeatSelection({ ...schedule, chartReady: true, inventoryReady: true }), true);
  assert.equal(seatChartReadinessMessage({ loaded: true, chartReady: true, bindingReady: false }), "게시된 좌석 배치도와 예매 좌석을 연결할 수 없습니다.");
});
