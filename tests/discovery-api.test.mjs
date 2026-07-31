import test from "node:test";
import assert from "node:assert/strict";
import { createDiscoveryBackend } from "../backend/discovery.js";
import { api, startServer } from "./backend-test-utils.mjs";

test("region discovery returns versioned groups from persisted venues", async (t) => {
  const server = await startServer(t);

  const response = await api(server.baseUrl, "/api/discovery/v1/regions");

  assert.equal(response.data.version, "1");
  const seoul = response.data.regions.find((region) => region.slug === "seoul");
  assert.ok(seoul);
  assert.equal(seoul.name, "서울");
  assert.ok(seoul.events.length > 0);
  assert.ok(seoul.events.every((event) => event.venueId && event.title));
});

test("discovery contract advertises additive versioned routes", async (t) => {
  const server = await startServer(t);

  const response = await api(server.baseUrl, "/api/discovery/v1/contract");

  assert.equal(response.data.version, "1");
  assert.deepEqual(response.data.endpoints, ["regions", "artists", "open-calendar"]);
});

test("artist discovery resolves persisted artist identities and rejects unknown slugs", async (t) => {
  const server = await startServer(t);

  const cast = await api(server.baseUrl, "/api/discovery/v1/artists/dracula-cast");
  const solo = await api(server.baseUrl, "/api/discovery/v1/artists/iu");
  const missing = await api(server.baseUrl, "/api/discovery/v1/artists/missing-artist", null, 404);

  assert.equal(cast.data.version, "1");
  assert.equal(cast.data.artist.slug, "dracula-cast");
  assert.ok(cast.data.events.some((event) => event.slug === "dracula"));
  assert.equal(solo.data.artist.slug, "iu");
  assert.ok(solo.data.events.some((event) => event.slug === "iu-world-tour"));
  assert.equal(missing.error.code, "ARTIST_NOT_FOUND");
});

test("artist discovery rejects malformed percent escapes as a client error", async (t) => {
  const server = await startServer(t);

  const response = await api(server.baseUrl, "/api/discovery/v1/artists/%", null, 400);

  assert.equal(response.error.code, "INVALID_ARTIST_SLUG");
});

test("open calendar derives stable opening dates from persisted performance dates", async (t) => {
  const server = await startServer(t);

  const response = await api(server.baseUrl, "/api/discovery/v1/open-calendar");

  assert.equal(response.data.version, "1");
  assert.ok(response.data.entries.length > 0);
  assert.ok(response.data.entries.every((entry) => Number.isFinite(Date.parse(entry.opensAt))));
  const iu = response.data.entries.find((entry) => entry.event.slug === "iu-world-tour");
  assert.equal(iu.opensAt, "2026-08-13T10:00:00.000Z");
});

test("discovery accepts persisted artist identifiers and keeps non-seeded regions", () => {
  const event = {
    id: "event-busan",
    title: "부산 아티스트 공연",
    venueId: "venue-busan",
    artistSlug: "김_아티스트.v2",
    casts: ["김 아티스트 v2"]
  };
  const discovery = createDiscoveryBackend({
    httpError(status, code, message) {
      return Object.assign(new Error(message), { status, code });
    },
    publicCatalog() {
      return {
        events: [event],
        venues: [
          {
            id: "venue-busan",
            address: "부산광역시 해운대구"
          }
        ]
      };
    }
  });

  const artist = discovery.publicArtist({}, "김_아티스트.v2");
  const regions = discovery.publicRegions({});

  assert.equal(artist.artist.slug, "김_아티스트.v2");
  assert.equal(artist.events[0].id, event.id);
  assert.deepEqual(
    regions.regions.map(({ slug, name, eventCount }) => ({ slug, name, eventCount })),
    [{ slug: "busan", name: "부산", eventCount: 1 }]
  );
});

test("artist discovery keeps canonical slugs with separators distinct", () => {
  const events = [
    { id: "separated", title: "AB-C", artistSlug: "ab-c", casts: ["AB C"] },
    { id: "compact", title: "ABC", artistSlug: "abc", casts: ["ABC"] }
  ];
  const discovery = createDiscoveryBackend({
    httpError(status, code, message) {
      return Object.assign(new Error(message), { status, code });
    },
    publicCatalog() {
      return { events, venues: [] };
    }
  });

  assert.deepEqual(
    discovery.publicArtist({}, "ab-c").events.map((event) => event.id),
    ["separated"]
  );
  assert.deepEqual(
    discovery.publicArtist({}, "abc").events.map((event) => event.id),
    ["compact"]
  );
});
