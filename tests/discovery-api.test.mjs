import test from "node:test";
import assert from "node:assert/strict";
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

test("open calendar derives stable opening dates from persisted performance dates", async (t) => {
  const server = await startServer(t);

  const response = await api(server.baseUrl, "/api/discovery/v1/open-calendar");

  assert.equal(response.data.version, "1");
  assert.ok(response.data.entries.length > 0);
  assert.ok(response.data.entries.every((entry) => Number.isFinite(Date.parse(entry.opensAt))));
  const iu = response.data.entries.find((entry) => entry.event.slug === "iu-world-tour");
  assert.equal(iu.opensAt, "2026-08-13T10:00:00.000Z");
});
