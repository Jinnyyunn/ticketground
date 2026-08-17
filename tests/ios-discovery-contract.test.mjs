import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

function extractSwiftBlock(sourceText, marker) {
  const markerStart = sourceText.indexOf(marker);
  assert.notEqual(markerStart, -1, `Missing Swift source marker: ${marker}`);
  const openBrace = sourceText.indexOf("{", markerStart);
  assert.notEqual(openBrace, -1, `Missing Swift block for: ${marker}`);

  let depth = 0;
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let index = openBrace; index < sourceText.length; index += 1) {
    const character = sourceText[index];
    const nextCharacter = sourceText[index + 1];
    if (inLineComment) {
      if (character === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (character === "*" && nextCharacter === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }
    if (!inString && character === "/" && nextCharacter === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }
    if (!inString && character === "/" && nextCharacter === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }
    if (character === '"') {
      if (inString && sourceText[index - 1] === "\\") continue;
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return sourceText.slice(openBrace + 1, index);
    }
  }
  assert.fail(`Unclosed Swift block for: ${marker}`);
}

function normalizedSwift(sourceText) {
  return sourceText.replace(/\/\/[^\r\n]*/g, "").replace(/\s+/g, " ").trim();
}

function extractSwiftSwitchBody(sourceText) {
  return extractSwiftBlock(sourceText, "switch route");
}

function extractSwiftCase(switchBody, labelPattern) {
  const normalized = normalizedSwift(switchBody);
  const caseMatches = [
    ...normalized.matchAll(/(?:^|\s)(case\s+([^:]+):|default\s*:)/g)
  ];
  const matchIndex = caseMatches.findIndex((match) => {
    const label = match[1].startsWith("case")
      ? match[2].trim()
      : "default";
    return labelPattern.test(label);
  });
  assert.notEqual(matchIndex, -1, `Missing Swift route case: ${labelPattern}`);
  const match = caseMatches[matchIndex];
  const nextMatch = caseMatches[matchIndex + 1];
  const bodyStart = match.index + match[0].length;
  const bodyEnd = nextMatch?.index ?? normalized.length;
  return normalized.slice(bodyStart, bodyEnd).trim();
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

  const fixtureSwitch = extractSwiftSwitchBody(
    extractSwiftBlock(routeView, "private var fixtureBody: some View")
  );
  const fixtureOpen = extractSwiftCase(fixtureSwitch, /\.open\b/);
  assert.match(fixtureOpen, /DiscoveryOpenCalendarView\(content: content\)/);
  assert.doesNotMatch(fixtureOpen, /이동한 화면/);
  const fixtureEvent = extractSwiftCase(fixtureSwitch, /\.event\b/);
  assert.match(fixtureEvent, /DiscoveryEditorialDestinationView\(slug: slug\)/);
  assert.doesNotMatch(fixtureEvent, /이동한 화면/);

  const liveRouteSwitch = extractSwiftSwitchBody(
    extractSwiftBlock(routeView, "private struct LiveDiscoveryRouteView: View")
  );
  const liveOpen = extractSwiftCase(liveRouteSwitch, /\.open\b/);
  assert.match(liveOpen, /LiveDiscoveryContractView\(route: route\)/);
  assert.match(liveOpen, /route-open/);
  const liveEvent = extractSwiftCase(liveRouteSwitch, /\.event\b/);
  assert.match(liveEvent, /catalogBody/);
  assert.match(liveEvent, /route-event-\\\(slug\)/);
  const liveGoods = extractSwiftCase(liveRouteSwitch, /\.goods\b/);
  assert.match(liveGoods, /catalogBody/);

  const catalogView = extractSwiftBlock(
    routeView,
    "private func catalogView(_ catalog: LiveCatalog)"
  );
  assert.match(catalogView, /events\(for: route, in: catalog, searchQuery: submittedSearchQuery\)/);
  assert.match(catalogView, /if isDetailRoute, let event = events\.first/);
  const detailRoutes = normalizedSwift(
    extractSwiftBlock(routeView, "private var isDetailRoute: Bool")
  );
  assert.match(detailRoutes, /case \.event, \.goods: return true/);
  const eventSelection = extractSwiftBlock(
    routeView,
    "private func events(for route: AppRoute, in catalog: LiveCatalog, searchQuery: String)"
  );
  assert.match(
    normalizedSwift(eventSelection),
    /case \.event\(let slug\), \.goods\(let slug\): return LiveCatalogRouteMatcher\.detailEvents\(slug: slug, in: catalog\)/
  );
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
  assert.doesNotMatch(environment, /case contractMissing/);
  assert.doesNotMatch(routeView, /capability-ledger-contract-missing/);
  assert.match(routeView, /capability-ledger-discovery/);
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
  assert.equal(contract.healthContractVersion, "78b3c7c");
  assert.equal(contract.capabilityPath, "/api/discovery/v1/contract");
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
