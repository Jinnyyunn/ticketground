import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("native discovery service declares typed versioned public endpoints", async () => {
  const [models, service] = await Promise.all([
    source("ios/TicketGroundApp/TicketGroundApp/Models/LiveBackendModels.swift"),
    source("ios/TicketGroundApp/TicketGroundApp/Data/LiveBackendService.swift")
  ]);

  for (const endpoint of ["regions", "artist", "openCalendar"]) {
    assert.match(models, new RegExp(`case ${endpoint}\\b`));
  }
  for (const model of ["LiveRegionDiscovery", "LiveArtistDiscovery", "LiveOpenCalendar"]) {
    assert.match(models, new RegExp(`struct ${model}\\b`));
  }
  assert.match(service, /func getRegions\(\)/);
  assert.match(service, /func getArtist\(slug: String\)/);
  assert.match(service, /func getOpenCalendar\(\)/);
  assert.match(service, /\/api\/discovery\/v1\/regions/);
  assert.match(service, /\/api\/discovery\/v1\/artists\//);
  assert.match(service, /\/api\/discovery\/v1\/open-calendar/);
});

test("native region artist and open routes use the public discovery contract view", async () => {
  const [environment, routeView, project] = await Promise.all([
    source("ios/TicketGroundApp/TicketGroundApp/App/AppEnvironment.swift"),
    source("ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift"),
    source("ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj")
  ]);

  assert.match(environment, /case \.region, \.artist, \.open:[\s\S]*?connectivity: \.publicRead/);
  assert.match(routeView, /case \.region, \.artist, \.open:[\s\S]*?LiveDiscoveryContractView\(route: route\)/);
  assert.match(project, /LiveDiscoveryContractView\.swift/);
});

test("live menu and catalog expose reachable discovery routes with UI-test responses", async () => {
  const [environment, routeView] = await Promise.all([
    source("ios/TicketGroundApp/TicketGroundApp/App/AppEnvironment.swift"),
    source("ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift")
  ]);

  for (const identifier of [
    "live-menu-region",
    "live-menu-open-calendar",
    "live-artist-link"
  ]) {
    assert.match(routeView, new RegExp(identifier));
  }
  for (const path of [
    "/api/discovery/v1/regions",
    "/api/discovery/v1/artists/neon-artist",
    "/api/discovery/v1/open-calendar"
  ]) {
    assert.match(environment, new RegExp(path.replaceAll("/", "\\/")));
  }
  const contractView = await source(
    "ios/TicketGroundApp/TicketGroundApp/UI/Discovery/LiveDiscoveryContractView.swift"
  );
  for (const state of [
    "live-discovery-empty",
    "live-discovery-not-found",
    "live-discovery-error"
  ]) {
    assert.match(contractView, new RegExp(state));
  }
  assert.match(environment, /case discoveryRouteNotFound/);
  assert.match(
    contractView,
    /if case \.server\(status: 404,[\s\S]*?case \.artist = route/
  );
});

test("checked-in public discovery contract matches the client paths and version", async () => {
  const contract = JSON.parse(
    await source("docs/research/native-ios-discovery-api-v1.json")
  );

  assert.equal(contract.version, "1");
  assert.equal(contract.healthContractVersion, "discovery-v1");
  assert.equal(contract.authentication, "none");
  assert.equal(contract.qualification.repository, "verified");
  assert.equal(contract.qualification.production, "pending");
  assert.deepEqual(
    contract.endpoints.map((endpoint) => endpoint.path),
    [
      "/api/discovery/v1/regions",
      "/api/discovery/v1/artists/{slug}",
      "/api/discovery/v1/open-calendar"
    ]
  );
});
