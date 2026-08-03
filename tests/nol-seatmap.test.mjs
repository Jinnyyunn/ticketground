import test from "node:test";
import assert from "node:assert/strict";
import {
  applyNolSeatMap,
  fetchNolSeatMap,
  mergeNolSeatMap,
  nolVenueParams
} from "../backend/nol-seatmap.js";
import { createBoundedTtlCache } from "../backend/bounded-cache.js";

function baseSeatMap() {
  return {
    event: { id: "event-1", title: "공연", venueId: "venue_bluesquare", venue: "블루스퀘어" },
    map: { title: "기존 좌석도", image: "/map.svg", description: "기존 설명" },
    zones: [{ id: "zone_vip", name: "VIP석", price: 120000, available: 2 }],
    seats: [
      {
        id: "ticket-1",
        label: "01",
        displayCode: "VIP-01",
        zoneId: "zone_vip",
        zoneName: "VIP석",
        price: 120000,
        status: "ON_SALE",
        available: true,
        mapPosition: { x: 10, y: 20, width: 5, height: 7, rotate: 0, shape: "actual-map" }
      },
      {
        id: "ticket-2",
        label: "02",
        displayCode: "VIP-02",
        zoneId: "zone_vip",
        zoneName: "VIP석",
        price: 120000,
        status: "ON_SALE",
        available: true,
        mapPosition: { x: 20, y: 20, width: 5, height: 7, rotate: 0, shape: "actual-map" }
      }
    ]
  };
}

test("NOL layout stays reference-only while Ticketground inventory remains selectable", () => {
  // Given: a Ticketground inventory and a denser external layout.
  const base = baseSeatMap();
  const external = {
    source: { provider: "NOL", blocks: 1 },
    zones: [{ id: "nol_vip", name: "VIP석", price: 99000, available: 50, color: "#123456" }],
    seats: Array.from({ length: 6 }, (_, index) => ({
      id: `nol-${index + 1}`,
      zoneId: "nol_vip",
      mapPosition: { x: 5 + index * 10, y: 30, width: 1.2, height: 1.6, rotate: 0, shape: "actual-map" }
    }))
  };

  // When: the NOL layout is attached.
  const merged = mergeNolSeatMap(base, external, { label: "블루스퀘어" });

  // Then: inventory and its coordinates stay authoritative, while NOL remains reference-only.
  assert.deepEqual(merged.seats.map((seat) => seat.id), ["ticket-1", "ticket-2"]);
  assert.deepEqual(merged.seats.map((seat) => seat.price), [120000, 120000]);
  assert.deepEqual(merged.zones.map((zone) => zone.id), ["zone_vip"]);
  assert.deepEqual(merged.seats.map((seat) => seat.mapPosition.x), [10, 20]);
  assert.deepEqual(merged.nolReference.seats.map((seat) => seat.id), ["nol-1", "nol-2", "nol-3", "nol-4", "nol-5", "nol-6"]);
  assert.equal(merged.nolReference.zones[0].color, "#123456");
});

test("unmapped venues retain their own seat map without an external request", async (t) => {
  // Given: an event venue without an approved NOL mapping.
  const base = baseSeatMap();
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    throw new Error("unexpected external request");
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  // When: NOL enrichment is requested for that venue.
  const result = await applyNolSeatMap(base, { venueId: "venue_unmapped" });

  // Then: the original venue response is returned untouched.
  assert.strictEqual(result, base);
  assert.equal(nolVenueParams("venue_unmapped"), null);
  assert.equal(nolVenueParams("toString"), null);
  assert.equal(nolVenueParams("venue_bluesquare"), null);
  assert.equal(nolVenueParams("venue_bluesquare_shinhan_card_hall"), null);
  assert.equal(nolVenueParams("venue_bluesquare_nemo"), null);
  assert.equal(nolVenueParams("venue_daehakro_arts_theater"), null);
  assert.equal(nolVenueParams("venue_myeongdong_theater"), null);
  assert.equal(fetchCount, 0);
});

test("seat coordinates preserve the source layout aspect ratio", async (t) => {
  // Given: a source hall that is twice as wide as it is tall.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/seats/block-data")) {
      return Response.json([{ blockKey: "wide", absoluteLeft: 0, absoluteTop: 0, absoluteRight: 200, absoluteBottom: 100 }]);
    }
    if (url.includes("/seats/grades")) return Response.json([]);
    if (url.includes("/seatMeta")) {
      return Response.json([{ seats: [
        { isExposable: true, seatInfoId: "left", seatNo: "1", posLeft: 0, posTop: 0 },
        { isExposable: true, seatInfoId: "right", seatNo: "2", posLeft: 200, posTop: 100 }
      ] }]);
    }
    throw new Error(`unexpected URL: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  // When: source coordinates are normalized for the Ticketground frame.
  const result = await fetchNolSeatMap({ goodsCode: "aspect-goods", placeCode: "aspect-place", playSeq: "001" });

  // Then: both axes use one scale and the shorter axis is centered.
  assert.deepEqual(result.seats.map((seat) => seat.mapPosition.x), [2, 98]);
  assert.deepEqual(result.seats.map((seat) => seat.mapPosition.y), [26, 74]);
});

test("block metadata loads concurrently without exceeding the request limit", async (t) => {
  // Given: more blocks than the bounded metadata concurrency allows at once.
  const originalFetch = globalThis.fetch;
  let activeMetadataRequests = 0;
  let maxActiveMetadataRequests = 0;
  const blocks = Array.from({ length: 6 }, (_, index) => ({
    blockKey: `block-${index + 1}`,
    absoluteLeft: index * 10,
    absoluteTop: 0,
    absoluteRight: index * 10 + 10,
    absoluteBottom: 10
  }));
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/seats/block-data")) return Response.json(blocks);
    if (url.includes("/seats/grades")) return Response.json([]);
    if (url.includes("/seatMeta")) {
      activeMetadataRequests += 1;
      maxActiveMetadataRequests = Math.max(maxActiveMetadataRequests, activeMetadataRequests);
      await new Promise((resolve) => setTimeout(resolve, 10));
      activeMetadataRequests -= 1;
      return Response.json([{ seats: [] }]);
    }
    throw new Error(`unexpected URL: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  // When: the external reference layout is loaded.
  await fetchNolSeatMap({ goodsCode: "concurrency-goods", placeCode: "concurrency-place", playSeq: "001" });

  // Then: requests overlap, but the upstream is protected from an unbounded fan-out.
  assert.ok(maxActiveMetadataRequests > 1);
  assert.ok(maxActiveMetadataRequests <= 4);
});

test("default layout loading does not request unused live seat status", async (t) => {
  // Given: deterministic NOL block, grade, and seat metadata responses.
  const requestedUrls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.includes("/seats/block-data")) {
      return Response.json([{ blockKey: "A", absoluteLeft: 0, absoluteTop: 0, absoluteRight: 100, absoluteBottom: 100 }]);
    }
    if (url.includes("/seats/grades")) return Response.json([]);
    if (url.includes("/seatMeta")) {
      return Response.json([{ seats: [{
        isExposable: true,
        seatInfoId: "nol-1",
        seatGrade: "VIP",
        seatGradeName: "VIP석",
        salesPrice: 120000,
        floor: "1층",
        rowNo: "A열",
        seatNo: "1",
        posLeft: 40,
        posTop: 50
      }] }]);
    }
    if (url.includes("/seatStatus")) return Response.json({ data: ["f"] });
    throw new Error(`unexpected URL: ${url}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  // When: the default coordinate-only mode loads a map.
  const result = await fetchNolSeatMap({ goodsCode: "goods", placeCode: "place", playSeq: "001" });

  // Then: coordinates load without the unused live-status dependency.
  assert.equal(result.seats.length, 1);
  assert.equal(requestedUrls.some((url) => url.includes("/seatStatus")), false);
});

test("bounded TTL cache evicts the oldest entry", () => {
  // Given: a cache limited to two entries.
  let now = 1;
  const cache = createBoundedTtlCache({ maxEntries: 2, now: () => now });
  cache.set("one", 1);
  now += 1;
  cache.set("two", 2);

  // When: a third unique key is inserted.
  now += 1;
  cache.set("three", 3);

  // Then: memory remains bounded and the oldest entry is evicted.
  assert.equal(cache.size(), 2);
  assert.equal(cache.get("one", 100), null);
  assert.equal(cache.get("two", 100), 2);
  assert.equal(cache.get("three", 100), 3);
});
