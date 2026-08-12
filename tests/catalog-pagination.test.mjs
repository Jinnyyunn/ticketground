import test from "node:test";
import assert from "node:assert/strict";
import { createDtoBackend } from "../backend/dtos.js";

function event(index) {
  return {
    id: `event-${index}`,
    slug: `event-${index}`,
    category: "CONCERT",
    title: `공연 ${index}`,
    venueId: "venue-1",
    venue: "공연장",
    prices: [{ grade: "R", price: 100000 }],
    dates: [],
  };
}

test("public catalog returns stable cursor metadata until every visible event is reachable", () => {
  const { publicCatalog } = createDtoBackend({ saleSummary: () => ({}), verifyLedger: () => ({ ok: true }) });
  const db = { events: Array.from({ length: 55 }, (_, index) => event(index)), tickets: [], venues: [] };

  const first = publicCatalog(db, { limit: 50, offset: 0 });
  const second = publicCatalog(db, { limit: 50, offset: Number(first.nextCursor) });

  assert.equal(first.events.length, 50);
  assert.equal(first.total, 55);
  assert.equal(first.nextCursor, "50");
  assert.equal(second.events.length, 5);
  assert.equal(second.total, 55);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.events, ...second.events].map((item) => item.id)).size, 55);
});
