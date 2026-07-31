# Issue 97 Discovery Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the repository-internal portion of GitHub issue #97 with versioned public region, artist, and ticket-open calendar APIs and native iOS routes that consume those APIs.

**Architecture:** Add a read-only discovery DTO module backed by the existing persisted catalog database. Expose three `/api/discovery/v1/*` routes and consume them through typed Swift models and `LiveBackendService`; the existing catalog remains the single event source. The app does not modify OAuth, app sessions, TLS, payment, or device capabilities.

**Tech Stack:** Node.js ESM backend, Node test runner, Swift 6, SwiftUI, XCTest.

## Global Constraints

- Do not modify the retained `IOS` worktree or the frozen evidence root.
- Do not modify protected social-login files or OAuth environment variables.
- Do not send credentials in argv, logs, comments, or pull-request text.
- Run build, Node tests, and iOS tests serially.
- Keep issue #97 open until CI and actual public-server qualification satisfy its completion criteria.

---

### Task 1: Versioned public discovery API

**Files:**
- Create: `backend/discovery.js`
- Modify: `backend/app.js`
- Modify: `backend/api-router.js`
- Test: `tests/discovery-api.test.mjs`

**Interfaces:**
- Consumes: persisted `db.events` and `db.venues`
- Produces: `publicRegions(db)`, `publicArtist(db, slug)`, and `publicOpenCalendar(db)`

- [ ] **Step 1: Write failing API tests**

```js
test("region discovery returns versioned groups from persisted venues", async () => {
  const response = await api(server.baseUrl, "/api/discovery/v1/regions");
  assert.equal(response.data.version, "1");
  assert.ok(response.data.regions.some((region) => region.slug === "seoul"));
});

test("artist discovery distinguishes a known artist and an unknown slug", async () => {
  const known = await api(server.baseUrl, "/api/discovery/v1/artists/dracula-cast");
  assert.equal(known.data.version, "1");
  assert.ok(known.data.events.length > 0);
  const missing = await api(server.baseUrl, "/api/discovery/v1/artists/missing");
  assert.equal(missing.status, 404);
});

test("open calendar is derived from persisted event dates", async () => {
  const response = await api(server.baseUrl, "/api/discovery/v1/open-calendar");
  assert.equal(response.data.version, "1");
  assert.ok(response.data.entries.every((entry) => Date.parse(entry.opensAt)));
});
```

- [ ] **Step 2: Run the tests and confirm route-not-found failures**

Run: `NODE_ENV=production node --test --test-concurrency=1 tests/discovery-api.test.mjs`

Expected: FAIL because the three discovery routes do not exist.

- [ ] **Step 3: Implement the minimal discovery DTO module and routes**

```js
export function createDiscoveryBackend({ httpError }) {
  return {
    publicRegions(db) { /* group public events by venue address region */ },
    publicArtist(db, slug) { /* exact normalized artist match or 404 */ },
    publicOpenCalendar(db) { /* persisted first performance minus 30 days */ }
  };
}
```

- [ ] **Step 4: Run the focused backend tests**

Run: `NODE_ENV=production node --test --test-concurrency=1 tests/discovery-api.test.mjs tests/backend-api-flow.test.mjs`

Expected: PASS.

### Task 2: Typed iOS discovery client

**Files:**
- Modify: `ios/TicketGroundApp/TicketGroundApp/Models/LiveBackendModels.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Data/LiveBackendService.swift`
- Test: `ios/TicketGroundApp/TicketGroundAppTests/LiveBackendServiceTests.swift`

**Interfaces:**
- Consumes: `/api/discovery/v1/regions`, `/api/discovery/v1/artists/{slug}`, `/api/discovery/v1/open-calendar`
- Produces: `LiveRegionDiscovery`, `LiveArtistDiscovery`, `LiveOpenCalendar`, and matching service methods

- [ ] **Step 1: Add failing XCTest coverage for paths, decoding, contract version, 404, and 5xx**

```swift
func testDiscoveryEndpointsDecodeVersionedResponses() async throws {
    let regions = try await service.getRegions()
    XCTAssertEqual(regions.version, "1")
    XCTAssertEqual(regions.regions.first?.slug, "seoul")
}
```

- [ ] **Step 2: Run the local source-contract test and confirm missing-symbol failures**

Run: `node --test tests/ios-discovery-contract.test.mjs`

Expected: FAIL because the discovery models and service methods do not exist. Full XCTest execution is delegated to the existing `ios-native` macOS CI because this local host has Command Line Tools but no Xcode/simctl.

- [ ] **Step 3: Add public-read endpoint cases, DTOs, and service methods**

```swift
func getRegions() async throws -> LiveRegionDiscovery {
    try await get(APIRequest(path: "/api/discovery/v1/regions"), endpoint: .regions, as: LiveRegionDiscovery.self)
}
```

- [ ] **Step 4: Re-run the local source-contract test and parse all Swift sources**

Run:

```bash
node --test tests/ios-discovery-contract.test.mjs
find ios/TicketGroundApp -name '*.swift' -print0 | xargs -0 -n 1 swiftc -frontend -parse
```

Expected: PASS.

### Task 3: Native region, artist, and open-calendar route states

**Files:**
- Modify: `ios/TicketGroundApp/TicketGroundApp/App/AppEnvironment.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift`
- Create: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/LiveDiscoveryContractView.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj`
- Test: `ios/TicketGroundApp/TicketGroundAppTests/AppEnvironmentTests.swift`
- Test: `ios/TicketGroundApp/TicketGroundAppUITests/DiscoveryTests.swift`

**Interfaces:**
- Consumes: typed discovery responses from Task 2
- Produces: public-read route classification and loading, content, empty, not-found, incompatible-contract, server-error, and retry surfaces

- [ ] **Step 1: Write failing route-classification and UI-state tests**

```swift
func testDiscoveryContractRoutesArePublicReads() {
    XCTAssertEqual(AppRoute.region.classification.connectivity, .publicRead)
    XCTAssertEqual(AppRoute.artist(slug: "iu").classification.connectivity, .publicRead)
    XCTAssertEqual(AppRoute.open.classification.connectivity, .publicRead)
}
```

- [ ] **Step 2: Run the local source-contract tests and confirm the old contract-missing assertions fail**

Run: `node --test tests/ios-discovery-contract.test.mjs`

Expected: FAIL because these routes are still classified as `contractMissing`.

- [ ] **Step 3: Implement route dispatch and state-specific SwiftUI surfaces**

```swift
case .region, .artist, .open:
    LiveDiscoveryContractView(route: route)
```

The view loads the route-specific service method and never falls back to fixture or catalog guessing.

- [ ] **Step 4: Run local source and syntax gates**

Run:

```bash
node --test tests/ios-discovery-contract.test.mjs
find ios/TicketGroundApp -name '*.swift' -print0 | xargs -0 -n 1 swiftc -frontend -parse
```

Expected: PASS. The existing `ios-native` CI then compiles and runs `LiveBackendServiceTests`, `AppEnvironmentTests`, and focused `DiscoveryTests` on an iPhone simulator.

### Task 4: Contract documentation and final verification

**Files:**
- Create: `docs/research/native-ios-discovery-api-v1.json`
- Modify: `docs/research/native-ios-api-contract.md`
- Modify: `docs/research/ios-unconnected-feature-inventory.md`
- Test: `scripts/validate-ios-virtual-fixtures.mjs`

**Interfaces:**
- Consumes: the implemented API and iOS path definitions
- Produces: checked-in non-secret contract evidence for issue #97

- [ ] **Step 1: Update the contract inventory without claiming TLS or production qualification**

Document the three public endpoints, response version `1`, supported error states, and the remaining production HTTPS qualification.

Keep the existing virtual-fixture manifest unchanged because it explicitly describes a non-live transport. Record the live public discovery contract in its own checked-in JSON artifact.

- [ ] **Step 2: Run serial verification**

Run:

```bash
npm run check
node scripts/validate-ios-virtual-fixtures.mjs
find ios/TicketGroundApp -name '*.swift' -print0 | xargs -0 -n 1 swiftc -frontend -parse
```

Expected: all local commands exit 0; the PR's `ios-native` job supplies the unavailable local Xcode simulator gate.

- [ ] **Step 3: Commit and publish**

```bash
git add backend ios docs tests
git commit -m "feat(discovery): add native region artist and open contracts"
git push -u origin fix/issue-97-discovery-contract
```

- [ ] **Step 4: Open a PR and wait for CI/review**

The PR body references `Refs #97` rather than `Closes #97`, because production HTTPS qualification is outside this change.
