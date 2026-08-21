import assert from "node:assert/strict";
import test from "node:test";
import { toggleChartSeatSelection } from "../src/lib/seat-charts/seat-selection.ts";

const variableTable = {
  id: "table-marker",
  label: "T1",
  displayLabel: "T1",
  tier: "R",
  price: 160000,
  sold: false,
  x: 40,
  y: 30,
  objectId: "table",
  objectType: "table",
  bookingMode: "variable",
  minOccupancy: 2,
  maxOccupancy: 4,
  backendTicketIds: ["ticket-1", "ticket-2", "ticket-3", "ticket-4"],
  availableTicketIds: ["ticket-1", "ticket-2", "ticket-3"],
};

test("variable table selection honors its occupancy range and toggles as one unit", () => {
  assert.deepEqual(toggleChartSeatSelection([], variableTable, 1), ["ticket-1", "ticket-2"]);
  assert.deepEqual(toggleChartSeatSelection([], variableTable, 4), ["ticket-1", "ticket-2", "ticket-3"]);
  assert.deepEqual(toggleChartSeatSelection(["ticket-1", "ticket-2"], variableTable, 2), []);
});

test("ordinary chart seats keep the existing bounded toggle behavior", () => {
  const seat = { ...variableTable, id: "ticket-5", bookingMode: undefined, backendTicketIds: undefined, availableTicketIds: undefined };
  assert.deepEqual(toggleChartSeatSelection(["ticket-1"], seat, 2), ["ticket-1", "ticket-5"]);
  assert.deepEqual(toggleChartSeatSelection(["ticket-1", "ticket-2"], seat, 2), ["ticket-2", "ticket-5"]);
  assert.deepEqual(toggleChartSeatSelection(["ticket-5"], seat, 2), []);
});

test("ordinary seats remove an existing grouped table atomically", () => {
  const ordinary = { ...variableTable, id: "ticket-5", bookingMode: undefined, backendTicketIds: undefined, availableTicketIds: undefined };
  assert.deepEqual(
    toggleChartSeatSelection(["ticket-1", "ticket-2", "ticket-3"], ordinary, 2, [variableTable, ordinary]),
    ["ticket-5"],
  );
});
