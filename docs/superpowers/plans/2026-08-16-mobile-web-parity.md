# Mobile Web Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the native iOS and Android customer applications expose the approved Ticketground web customer UI hierarchy, destinations, states, and actions, then leave both final phone apps running for user inspection.

**Architecture:** Treat the live web customer surface as the reference and encode parity in a versioned matrix plus automated source checks. Build platform-native SwiftUI and Jetpack Compose sections from typed catalog/open-calendar/lifecycle data, extend typed navigation rather than using WebViews, and qualify iOS before Android so memory-heavy builds and emulators remain serialized.

**Tech Stack:** Next.js 16 reference surface, Node.js built-in test runner, Swift 5/SwiftUI/XCTest/XCUITest, Kotlin/JVM 17/Jetpack Compose/JUnit/Compose UI Test, Xcode Simulator, Android Emulator/ADB.

## Global Constraints

- Included customer surfaces are home discovery, category/search/ranking/calendar/genre/region/venue/artist/editorial discovery, event detail, booking, watchlist, reservations, official resale, cancellation, trusted device, admission QR, notifications, help, and inquiry.
- Web admin, console, seller operations, company information, terms, and privacy pages are excluded.
- Google, Kakao, and Naver simple-login UI, configuration, OAuth, session code, tests, environment variables, and provider consoles are read-only.
- Directed person-to-person transfer remains blocked by product policy.
- The mobile applications remain native; do not add a WebView fallback for missing destinations.
- Touch targets are at least 44 points on iOS and 48 dp on Android.
- Heavy builds, complete test suites, browser runs, Simulator, and Emulator QA run serially.
- Never infer payment, refund, ownership, resale, device, push, or admission success on the client.
- Never expose session credentials, payment keys, personal data, or admission QR payloads in logs or QA artifacts.
- Local tests, Simulator/Emulator qualification, GitHub CI/merge, and production/provider qualification are reported separately.

---

## File responsibility map

- `docs/research/MOBILE_CUSTOMER_PARITY_MATRIX.md`: authoritative web-to-iOS-to-Android action and state checklist.
- `tests/mobile-home-parity.test.mjs`: source-level guard for required home section order, native identifiers, and forbidden WebView substitution.
- `ios/TicketGroundApp/TicketGroundApp/Models/DiscoveryModels.swift`: typed fixture/domain models for home parity content.
- `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryHomeComposition.swift`: pure derivation of opening, resale, genre, editorial, and shortcut presentation from real catalog data.
- `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryParitySectionViews.swift`: reusable SwiftUI sections added by this feature.
- `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryHomeView.swift`: ordered composition only; no business logic.
- `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift`: native destination rendering for genre, editorial, resale, and calendar routes.
- `ios/TicketGroundApp/TicketGroundAppTests/DiscoveryHomeParityTests.swift`: pure model and route tests.
- `ios/TicketGroundApp/TicketGroundAppUITests/DiscoveryTests.swift`: phone interaction coverage for every new home control.
- `ios/TicketGroundApp/TicketGroundAppUITests/SharedShellTests.swift`: tablet layout and navigation coverage.
- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerHomePresentation.kt`: pure Android home presentation derivation.
- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerHomeParitySections.kt`: reusable Compose home sections.
- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerModels.kt`: typed home content and repository boundary.
- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerApp.kt`: typed route state and action dispatch.
- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerScreens.kt`: existing shell/detail screens; home delegates to parity section components.
- `android/TicketGroundApp/app/src/test/java/kr/ticketground/app/ui/CustomerHomePresentationTest.kt`: pure presentation tests.
- `android/TicketGroundApp/app/src/androidTest/java/kr/ticketground/app/TicketGroundAppShellTest.kt`: Compose action and responsive tests.
- `android/TicketGroundApp/app/src/androidTest/java/kr/ticketground/app/VisualCaptureTest.kt`: fresh phone/tablet/state screenshots.

---

### Task 1: Lock the cross-platform parity contract

**Files:**
- Create: `docs/research/MOBILE_CUSTOMER_PARITY_MATRIX.md`
- Create: `tests/mobile-home-parity.test.mjs`
- Read only: `.github/scripts/ticketground-bot.cjs`

**Interfaces:**
- Consumes: approved scope in `docs/superpowers/specs/2026-08-16-mobile-web-parity-design.md`.
- Produces: ordered `requiredHomeSections`, native identifier requirements, and the release checklist used by Tasks 2-9.

- [ ] **Step 1: Write the parity matrix with explicit destinations and states**

Create a table whose first nine home rows are exactly:

```markdown
| Order | Web control | Web destination | iOS identifier/destination | Android tag/destination | Required states |
| --- | --- | --- | --- | --- | --- |
| 1 | Header/search | `/contents/search` | `header-search` / `.search` | `home-search` / `AppDestination.Search` | ready,error |
| 2 | Category navigation | `/contents/genre/:genre` | `discovery-category-*` / `.genre` | `home-category-*` / `CustomerRoute.Collection` | ready,empty,error |
| 3 | Featured hero | `/goods/:slug` | `discovery-featured-cta` / `.goods` | `home-featured` / `CustomerRoute.Event` | ready,media-fallback |
| 4 | Real-time ranking | `/contents/ranking` | `discovery-ranking-more` / `.ranking` | `home-ranking-more` / `CustomerRoute.Collection` | ready,empty,error |
| 5 | Ticket-open upcoming | `/open` | `discovery-open-more` / `.open` | `home-open-more` / `CustomerRoute.OpenCalendar` | ready,empty,error |
| 6 | CLEAN ticket | `/resale` | `discovery-resale-pool` / `.resale` | `home-resale-pool` / `CustomerRoute.Resale` | ready,signed-out,error |
| 7 | Genre recommendations | `/contents/genre/:genre` | `discovery-genre-*` / `.genre` | `home-genre-*` / `CustomerRoute.Collection` | ready,empty,error |
| 8 | Editorial collection | `/event/ticketground-day` | `discovery-editorial-*` / `.event` | `home-editorial-*` / `CustomerRoute.Collection` | ready,empty,error |
| 9 | Shortcuts | matching customer route | `shortcut-*` / typed route | `home-shortcut-*` / typed route | ready,empty,error |
```

Append rows for event detail, seat selection, queue/hold/draft, Toss handoff, watchlist, reservation detail, cancellation, official resale lifecycle, trusted device, push, QR, help, and inquiry. Mark external-provider gates separately from repository-complete native behavior.

- [ ] **Step 2: Write a failing source-level parity test**

Create `tests/mobile-home-parity.test.mjs` with the following structure:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const requiredHomeSections = [
  "실시간 예매 랭킹 TOP10",
  "티켓오픈 예정",
  "CLEAN 티켓 공식 양도",
  "장르별 추천",
  "기획전",
  "바로가기",
];

function assertOrder(source, tokens, label) {
  let previous = -1;
  for (const token of tokens) {
    const index = source.indexOf(token);
    assert.ok(index > previous, `${token} must follow the previous ${label} section`);
    previous = index;
  }
}

test("web and both native homes preserve the required customer section order", async () => {
  const [webPage, webCopy, iosHome, iosSections, iosParity, androidScreens, androidParity] = await Promise.all([
    read("src/app/page.tsx"),
    read("src/i18n/dictionaries/ko.ts"),
    read("ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryHomeView.swift"),
    read("ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoverySectionViews.swift"),
    read("ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryParitySectionViews.swift").catch(() => ""),
    read("android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerScreens.kt"),
    read("android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerHomeParitySections.kt").catch(() => ""),
  ]);
  const webComponents = [
    "RealtimeTop10Section",
    "TicketOpenSection",
    "OfficialResaleSection",
    "GenreRecommendationsSection",
    "EditorialEventsSection",
    "ShortcutsSection",
  ];
  assertOrder(webPage, webComponents.map((component) => `<${component}`), "web");
  requiredHomeSections.forEach((heading) => assert.match(webCopy, new RegExp(heading)));
  assertOrder(iosHome, [
    "DiscoveryRankingSection", "DiscoveryOpeningSection", "DiscoveryResaleSection",
    "DiscoveryGenreRecommendationsSection", "DiscoveryEditorialSection", "DiscoveryShortcutsSection",
  ], "iOS");
  assertOrder(androidScreens, [
    "RankingSection", "HomeOpeningSection", "HomeResaleSection",
    "HomeGenreSection", "HomeEditorialSection", "ShortcutSection",
  ], "Android");
  requiredHomeSections.forEach((heading) => {
    assert.match(`${iosHome}\n${iosSections}\n${iosParity}`, new RegExp(heading));
    assert.match(`${androidScreens}\n${androidParity}`, new RegExp(heading));
  });
});

test("native parity does not substitute a WebView", async () => {
  const nativeSources = await Promise.all([
    read("ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryHomeView.swift"),
    read("ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryParitySectionViews.swift").catch(() => ""),
    read("android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerScreens.kt"),
    read("android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerHomeParitySections.kt").catch(() => ""),
  ]);
  nativeSources.forEach((source) => {
    assert.doesNotMatch(source, /WKWebView|AndroidView\s*\(.*WebView|android\.webkit\.WebView/s);
  });
});
```

- [ ] **Step 3: Run the contract test and confirm the native section assertion fails**

Run: `node --test tests/mobile-home-parity.test.mjs`

Expected: FAIL because iOS and Android do not yet contain all six required headings in order; the WebView assertion passes.

- [ ] **Step 4: Record the protected simple-login boundary without editing it**

Run: `node -e 'const bot=require("./.github/scripts/ticketground-bot.cjs"); console.log(Boolean(bot))'` only if the script exports safely; otherwise use `rg -n "PROTECTED_AUTH_PATTERNS" .github/scripts/ticketground-bot.cjs` and record the matched paths in the parity matrix. Do not edit any matched file.

- [ ] **Step 5: Commit the contract**

```bash
git add docs/research/MOBILE_CUSTOMER_PARITY_MATRIX.md tests/mobile-home-parity.test.mjs
git commit -m "test(native): define mobile web parity contract"
```

---

### Task 2: Add typed iOS home parity composition

**Files:**
- Create: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryHomeComposition.swift`
- Create: `ios/TicketGroundApp/TicketGroundAppTests/DiscoveryHomeParityTests.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Models/DiscoveryModels.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj`

**Interfaces:**
- Consumes: `[DiscoveryRanking]`, `[DiscoveryOpening]`, `[DiscoveryShortcut]`, and catalog-backed `DiscoveryFeatured` values.
- Produces: `DiscoveryHomeParityContent`, `DiscoveryGenreGroup`, `DiscoveryEditorialCard`, and `DiscoveryResaleSafetyItem`.

- [ ] **Step 1: Write failing pure composition tests**

Add tests that assert exact section order and destinations:

```swift
final class DiscoveryHomeParityTests: XCTestCase {
    func testParityContentPreservesWebSectionOrder() {
        XCTAssertEqual(
            DiscoveryHomeSection.allCases,
            [.featured, .ranking, .opening, .resale, .genreRecommendations, .editorial, .shortcuts]
        )
    }

    func testParityContentMapsCustomerDestinations() {
        let content = DiscoveryHomeComposition.make(from: DiscoveryFixtures.happyContent)
        XCTAssertEqual(content.resale.destination, .resale)
        XCTAssertEqual(content.genreGroups.first?.destination, .genre(name: "concert"))
        XCTAssertEqual(content.editorials.first?.destination, .event(slug: "ticketground-day"))
        XCTAssertEqual(content.openingMoreDestination, .open)
    }
}
```

Define a focused `DiscoveryFixtures.happyContent` factory inside the test file so the test does not depend on login or network fixtures.

- [ ] **Step 2: Run the focused tests and confirm missing-type failures**

Run:

```bash
xcodebuild test -project ios/TicketGroundApp/TicketGroundApp.xcodeproj -scheme TicketGroundApp -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -only-testing:TicketGroundAppTests/DiscoveryHomeParityTests
```

Expected: FAIL because `DiscoveryHomeSection`, `DiscoveryHomeComposition`, and parity types do not exist.

- [ ] **Step 3: Implement immutable presentation types**

Add these exact public-in-module shapes:

```swift
enum DiscoveryHomeSection: String, CaseIterable {
    case featured
    case ranking
    case opening
    case resale
    case genreRecommendations
    case editorial
    case shortcuts
}

struct DiscoveryHomeParityContent: Equatable {
    let openingMoreDestination: AppRoute
    let resale: DiscoveryResaleCard
    let genreGroups: [DiscoveryGenreGroup]
    let editorials: [DiscoveryEditorialCard]
}

struct DiscoveryResaleCard: Equatable {
    let destination: AppRoute
    let safetyItems: [DiscoveryResaleSafetyItem]
}

struct DiscoveryResaleSafetyItem: Equatable {
    let order: Int
    let title: String
    let detail: String
    let systemImage: String
}

struct DiscoveryGenreGroup: Equatable {
    let label: String
    let destination: AppRoute
    let events: [DiscoveryRanking]
}

struct DiscoveryEditorialCard: Equatable {
    let order: Int
    let title: String
    let destination: AppRoute
}
```

`DiscoveryHomeComposition.make(from:)` must derive genre groups from real ranking/category content, cap each group at five items, use `.resale`, `.open`, and `.event(slug: "ticketground-day")`, and return the three web safety statements: `보유 티켓 확인`, `정책 자동 판별`, and `QR 보호`.

- [ ] **Step 4: Add the new source/test files to the Xcode project**

Update the PBX file references, build-file entries, source phase, and test source phase using the repository's existing identifiers and ordering. Do not normalize unrelated project sections.

- [ ] **Step 5: Run the focused tests and confirm they pass**

Run the Step 2 command.

Expected: PASS with zero failures.

- [ ] **Step 6: Commit the iOS composition layer**

```bash
git add ios/TicketGroundApp/TicketGroundApp/Models/DiscoveryModels.swift ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryHomeComposition.swift ios/TicketGroundApp/TicketGroundAppTests/DiscoveryHomeParityTests.swift ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj
git commit -m "feat(ios): add web parity home composition"
```

---

### Task 3: Render and connect the iOS parity sections

**Files:**
- Create: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryParitySectionViews.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryHomeView.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoverySectionViews.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift`
- Modify: `ios/TicketGroundApp/TicketGroundAppTests/DiscoveryHomeParityTests.swift`
- Modify: `ios/TicketGroundApp/TicketGroundAppUITests/DiscoveryTests.swift`
- Modify: `ios/TicketGroundApp/TicketGroundAppUITests/SharedShellTests.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj`

**Interfaces:**
- Consumes: `DiscoveryHomeParityContent` from Task 2 and existing `AppRoute` values.
- Produces: `DiscoveryResaleSection`, `DiscoveryGenreRecommendationsSection`, and `DiscoveryEditorialSection` with stable accessibility identifiers.

- [ ] **Step 1: Add failing XCUITest assertions for every new home action**

Extend `testHomeRankingAndOpenCalendar()` with:

```swift
for identifier in [
    "discovery-open-more",
    "discovery-resale-pool",
    "discovery-genre-concert",
    "discovery-editorial-1",
    "shortcut-resale"
] {
    assertDiscoverable(app.buttons[identifier])
}
```

Add `testHomeParityDestinations()` that taps each control, verifies its destination identifier (`route-open`, `route-resale`, `route-genre-concert`, `route-event-ticketground-day`), then uses `BackButton` before the next action. Add a tablet assertion that all section headings become discoverable without horizontal overflow.

- [ ] **Step 2: Run the focused UI test and confirm missing identifiers**

Run:

```bash
xcodebuild test -project ios/TicketGroundApp/TicketGroundApp.xcodeproj -scheme TicketGroundApp -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -only-testing:TicketGroundAppUITests/DiscoveryTests/testHomeParityDestinations
```

Expected: FAIL on the first missing parity identifier.

- [ ] **Step 3: Implement reusable SwiftUI sections**

Create views with these signatures:

```swift
struct DiscoveryResaleSection: View {
    let card: DiscoveryResaleCard
}

struct DiscoveryGenreRecommendationsSection: View {
    let groups: [DiscoveryGenreGroup]
    @State private var selectedLabel: String
}

struct DiscoveryEditorialSection: View {
    let cards: [DiscoveryEditorialCard]
}
```

Use `DiscoverySectionHeading`, `TicketgroundColor`, `TicketgroundSpacing`, `TicketgroundRadius`, and `TicketgroundMediaImage`. All navigation uses `NavigationLink(value:)`; do not open Safari or a WebView. Set the identifiers from Step 1 on the actual tappable link.

- [ ] **Step 4: Integrate the exact web section order**

In `DiscoveryHomeView`, derive `let parity = DiscoveryHomeComposition.make(from: content)` and render:

```swift
DiscoveryFeaturedSection(...)
DiscoveryRankingSection(rankings: content.rankings)
DiscoveryOpeningSection(openingSoon: content.openingSoon)
DiscoveryResaleSection(card: parity.resale)
DiscoveryGenreRecommendationsSection(groups: parity.genreGroups)
DiscoveryEditorialSection(cards: parity.editorials)
DiscoveryShortcutsSection(shortcuts: content.shortcuts)
```

Render an explicit empty surface within opening and genre sections when their collections are empty; do not remove the section silently.

- [ ] **Step 5: Connect native destination content**

Reuse `.open`, `.resale`, `.genre(name:)`, and `.event(slug:)` in `DiscoveryRouteView`. Ensure the route root has these identifiers:

```swift
.accessibilityIdentifier("route-open")
.accessibilityIdentifier("route-resale")
.accessibilityIdentifier("route-genre-\(name)")
.accessibilityIdentifier("route-event-\(slug)")
```

Resale mutations remain on authenticated lifecycle screens; the public resale destination is a browser/list surface and must show the signed-out state without changing login code.

- [ ] **Step 6: Add project entries and run focused tests**

Add the new source file to the app source phase, then run:

```bash
xcodebuild test -project ios/TicketGroundApp/TicketGroundApp.xcodeproj -scheme TicketGroundApp -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -only-testing:TicketGroundAppTests/DiscoveryHomeParityTests -only-testing:TicketGroundAppUITests/DiscoveryTests -only-testing:TicketGroundAppUITests/SharedShellTests
```

Expected: PASS with zero failures.

- [ ] **Step 7: Run the source-level parity test**

Run: `node --test tests/mobile-home-parity.test.mjs`

Expected: still FAIL only for Android missing sections; iOS contains the required headings in order.

- [ ] **Step 8: Commit the iOS UI**

```bash
git add ios/TicketGroundApp/TicketGroundApp/UI/Discovery ios/TicketGroundApp/TicketGroundAppTests/DiscoveryHomeParityTests.swift ios/TicketGroundApp/TicketGroundAppUITests/DiscoveryTests.swift ios/TicketGroundApp/TicketGroundAppUITests/SharedShellTests.swift ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj
git commit -m "feat(ios): match customer web discovery sections"
```

---

### Task 4: Qualify iOS customer parity before Android work

**Files:**
- Modify only if a failure requires it: iOS source/test files owned by Tasks 2-3.
- Evidence output: `/tmp/ticketground-mobile-parity/ios/`

**Interfaces:**
- Consumes: final iOS implementation from Tasks 2-3.
- Produces: passing iOS build/tests and fresh phone/tablet screenshots for Task 9.

- [ ] **Step 1: Run unit and UI tests serially**

Run:

```bash
bash scripts/run-ios-sim-test.sh
bash scripts/run-ios-live-tests.sh
```

Expected: both exit 0. If a live external provider is unavailable, record the exact externally blocked scenario without weakening fail-closed behavior.

- [ ] **Step 2: Build and install the Debug app**

Run:

```bash
xcodebuild build -project ios/TicketGroundApp/TicketGroundApp.xcodeproj -scheme TicketGroundApp -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -derivedDataPath /tmp/ticketground-mobile-parity/ios/DerivedData
xcrun simctl install 'iPhone 17 Pro' /tmp/ticketground-mobile-parity/ios/DerivedData/Build/Products/Debug-iphonesimulator/TicketGroundApp.app
xcrun simctl launch 'iPhone 17 Pro' kr.ticketground.app
```

Expected: build/install/launch exit 0.

- [ ] **Step 3: Tap every parity-matrix action on phone, then tablet**

Use the Simulator accessibility surface or XCUITest identifiers. Confirm each tap reaches the recorded destination and returns without losing home scroll/navigation state. Repeat on `iPad Pro 13-inch (M5)` after the phone run completes.

- [ ] **Step 4: Capture fresh screenshots**

Capture phone and tablet screenshots for home top, opening, resale, genre, editorial, shortcuts, loading, empty, error, and signed-out resale. Store them under `/tmp/ticketground-mobile-parity/ios/`; do not commit screenshots.

- [ ] **Step 5: Commit any evidence-driven iOS fixes**

If source changed, rerun Steps 1-4 and commit only the fix and its test:

```bash
git add ios/TicketGroundApp
git commit -m "fix(ios): resolve mobile parity QA findings"
```

If no source changed, do not create an empty commit.

---

### Task 5: Add typed Android home presentation and routes

**Files:**
- Create: `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerHomePresentation.kt`
- Create: `android/TicketGroundApp/app/src/test/java/kr/ticketground/app/ui/CustomerHomePresentationTest.kt`
- Modify: `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerModels.kt`
- Modify: `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerApp.kt`

**Interfaces:**
- Consumes: `HomeContent.events`, `HomeContent.calendar`, and existing `CatalogEvent`/`OpenCalendarEntry`.
- Produces: `CustomerHomePresentation`, `GenreRecommendation`, `EditorialCard`, `ResaleSafetyItem`, `CustomerRoute.Collection`, `CustomerRoute.OpenCalendar`, and `CustomerRoute.Resale`.

- [ ] **Step 1: Write failing pure Kotlin tests**

Create:

```kotlin
class CustomerHomePresentationTest {
  @Test fun `home presentation preserves web section order`() {
    assertEquals(
      listOf("featured", "ranking", "opening", "resale", "genres", "editorial", "shortcuts"),
      CustomerHomeSection.entries.map(CustomerHomeSection::key),
    )
  }

  @Test fun `home presentation derives real customer destinations`() {
    val presentation = CustomerHomePresentation.from(homeFixture())
    assertEquals(CustomerRoute.Resale, presentation.resale.destination)
    assertEquals("콘서트", presentation.genres.first().label)
    assertEquals(CustomerRoute.OpenCalendar, presentation.opening.destination)
    assertEquals("ticketground-day", presentation.editorials.first().slug)
  }
}
```

Keep `homeFixture()` local and use real `CatalogEvent` and `OpenCalendarEntry` types.

- [ ] **Step 2: Run the focused test and confirm missing-type failures**

Run:

```bash
cd android/TicketGroundApp
./gradlew testDevCustomerDebugUnitTest --tests kr.ticketground.app.ui.CustomerHomePresentationTest
```

Expected: FAIL because presentation and route types do not exist.

- [ ] **Step 3: Implement pure Android presentation types**

Add:

```kotlin
enum class CustomerHomeSection(val key: String) {
  Featured("featured"), Ranking("ranking"), Opening("opening"), Resale("resale"),
  Genres("genres"), Editorial("editorial"), Shortcuts("shortcuts"),
}

data class CustomerHomePresentation(
  val opening: OpeningPresentation,
  val resale: ResalePresentation,
  val genres: List<GenreRecommendation>,
  val editorials: List<EditorialCard>,
) {
  companion object { fun from(content: HomeContent): CustomerHomePresentation }
}
```

Derive at most two opening cards, seven ordered genre groups, at most five events per genre, the three exact CLEAN ticket safety items, and the `ticketground-day` editorial collection. Empty inputs return empty lists while preserving section metadata.

- [ ] **Step 4: Extend typed customer routes**

Add these routes:

```kotlin
data class Collection(val title: String, val events: List<CatalogEvent>) : CustomerRoute
data object OpenCalendar : CustomerRoute
data object Resale : CustomerRoute
```

Add view-model methods `openCollection(title, events)`, `openCalendar()`, and `openResale()` that set route state only. Do not touch native-login methods or provider callbacks.

- [ ] **Step 5: Run unit tests**

Run:

```bash
cd android/TicketGroundApp
./gradlew testDevCustomerDebugUnitTest --tests kr.ticketground.app.ui.CustomerHomePresentationTest --tests kr.ticketground.app.ui.CustomerAppViewModelTest
```

Expected: PASS with zero failures.

- [ ] **Step 6: Commit the Android presentation layer**

```bash
git add android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerHomePresentation.kt android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerModels.kt android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerApp.kt android/TicketGroundApp/app/src/test/java/kr/ticketground/app/ui/CustomerHomePresentationTest.kt
git commit -m "feat(android): add web parity home presentation"
```

---

### Task 6: Render and connect the Android parity sections

**Files:**
- Create: `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerHomeParitySections.kt`
- Modify: `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerScreens.kt`
- Modify: `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerApp.kt`
- Modify: `android/TicketGroundApp/app/src/androidTest/java/kr/ticketground/app/TicketGroundAppShellTest.kt`
- Modify: `android/TicketGroundApp/app/src/androidTest/java/kr/ticketground/app/VisualCaptureTest.kt`

**Interfaces:**
- Consumes: `CustomerHomePresentation` and route methods from Task 5.
- Produces: `HomeOpeningSection`, `HomeResaleSection`, `HomeGenreSection`, and `HomeEditorialSection` with stable test tags.

- [ ] **Step 1: Add failing Compose assertions**

Add `phoneHome_exposesEveryWebParitySectionAndDestination()`:

```kotlin
listOf(
  "티켓오픈 예정", "CLEAN 티켓 공식 양도", "장르별 추천", "기획전", "바로가기",
).forEach { heading ->
  composeRule.onNodeWithTag("home-list").performScrollToNode(hasText(heading))
  composeRule.onNodeWithText(heading).assertIsDisplayed()
}

listOf(
  "home-open-more", "home-resale-pool", "home-genre-콘서트", "home-editorial-1",
).forEach { tag -> composeRule.onNodeWithTag(tag).performScrollTo().assertHasClickAction() }
```

Add route assertions after each click: `open-calendar-screen`, `resale-screen`, `collection-screen-콘서트`, and `collection-screen-기획전`.

- [ ] **Step 2: Run the focused instrumentation test and confirm it fails**

Run:

```bash
cd android/TicketGroundApp
./gradlew connectedDevCustomerDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=kr.ticketground.app.TicketGroundAppShellTest
```

Expected: FAIL on the first missing heading/tag.

- [ ] **Step 3: Implement reusable Compose sections**

Create composables with these signatures:

```kotlin
@Composable fun HomeOpeningSection(
  presentation: OpeningPresentation,
  onOpenCalendar: () -> Unit,
  onEvent: (CatalogEvent) -> Unit,
)

@Composable fun HomeResaleSection(
  presentation: ResalePresentation,
  onOpenResale: () -> Unit,
)

@Composable fun HomeGenreSection(
  groups: List<GenreRecommendation>,
  onCollection: (GenreRecommendation) -> Unit,
  onEvent: (CatalogEvent) -> Unit,
)

@Composable fun HomeEditorialSection(
  cards: List<EditorialCard>,
  onCollection: (EditorialCard) -> Unit,
)
```

Use `TicketGroundSpacing`, `TicketGroundRadius`, `MaterialTheme.colorScheme`, `LazyRow`, and existing event media. Use `Modifier.testTag(...)` on the clickable container. Do not use `AndroidView` or `WebView`.

- [ ] **Step 4: Integrate exact section order into phone and tablet homes**

Set `Modifier.testTag("home-list")` on the vertical home list and render after ranking:

```kotlin
HomeOpeningSection(...)
HomeResaleSection(...)
HomeGenreSection(...)
HomeEditorialSection(...)
ShortcutSection(...)
```

Expanded/tablet home uses the same components and order. Do not keep the current generic `오픈 캘린더` list as a second duplicate section.

- [ ] **Step 5: Render typed destination screens**

Handle new routes in `TicketGroundCustomerApp`:

```kotlin
is CustomerRoute.Collection -> EventListScreen(
  title = current.title,
  state = AsyncContent.Ready(current.events),
  expanded = maxWidth >= TicketGroundLayout.expandedBreakpoint,
  onRetry = {},
  onEvent = viewModel::openEvent,
)
CustomerRoute.OpenCalendar -> OpenCalendarScreen(...)
CustomerRoute.Resale -> PublicResaleScreen(...)
```

`PublicResaleScreen` explains the three safety controls and routes signed-in mutations to My Page. It must never claim a listing or purchase succeeded without the lifecycle API.

- [ ] **Step 6: Extend visual fixtures and captures**

Update `fixtureHome()` so it contains at least two genres and two calendar entries. Add phone scroll captures for opening/resale, genre/editorial, and shortcuts plus a tablet expanded home capture. Keep all QR secrets inside the existing capture-only fixture and never print them.

- [ ] **Step 7: Run focused unit and instrumentation tests**

Run serially:

```bash
cd android/TicketGroundApp
./gradlew testDevCustomerDebugUnitTest
./gradlew connectedDevCustomerDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=kr.ticketground.app.TicketGroundAppShellTest
```

Expected: PASS with zero failures.

- [ ] **Step 8: Run the cross-platform source test**

From repository root run: `node --test tests/mobile-home-parity.test.mjs`

Expected: PASS with all required headings in order and no WebView substitution.

- [ ] **Step 9: Commit the Android UI**

```bash
git add android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui android/TicketGroundApp/app/src/androidTest/java/kr/ticketground/app
git commit -m "feat(android): match customer web discovery sections"
```

---

### Task 7: Close remaining customer-route parity gaps

**Files:**
- Modify: `docs/research/MOBILE_CUSTOMER_PARITY_MATRIX.md`
- Modify only where a matrix row is not implemented: iOS discovery/account/support files and Android customer UI/data files.
- Test: corresponding existing iOS XCTest/XCUITest and Android JUnit/Compose tests.

**Interfaces:**
- Consumes: every non-home row in the parity matrix.
- Produces: an evidence link or an implemented native destination for every included customer row.

- [ ] **Step 1: Audit every matrix row against current native identifiers**

For each row, record exactly one of `implemented`, `externally-blocked`, or `excluded-by-approved-scope`. `implemented` requires a typed route, observable state, and focused test. Do not mark a route implemented because a similarly named API method exists.

- [ ] **Step 2: Write one failing focused test per uncovered row**

Examples of required assertions:

```swift
XCTAssertTrue(app.buttons["event-watchlist"].isHittable)
XCTAssertTrue(app.buttons["event-seat-map"].isHittable)
XCTAssertTrue(app.buttons["mypage-cancellation-request"].isHittable)
XCTAssertTrue(app.buttons["mypage-resale-list"].isHittable)
```

```kotlin
composeRule.onNodeWithTag("event-watchlist").assertHasClickAction()
composeRule.onNodeWithTag("event-seat-map").assertHasClickAction()
composeRule.onNodeWithTag("lifecycle-cancel").assertHasClickAction()
composeRule.onNodeWithTag("lifecycle-resale").assertHasClickAction()
```

Add exact route/state assertions for search, ranking, calendar, genre, region, venue, artist, editorial, event detail, seat map, queue/hold/draft, Toss unavailable, watchlist, reservation detail, cancellation request, resale lifecycle, trusted device, push, QR, help, and inquiry.

- [ ] **Step 3: Run each focused test and confirm the uncovered behavior fails**

Use `xcodebuild -only-testing:<suite>/<test>` for iOS and Gradle `--tests` or instrumentation class arguments for Android. Record the exact failure beside the matrix row before implementation.

- [ ] **Step 4: Implement only the proven gaps**

Reuse existing services, repositories, and typed routes. Add no new product behavior outside the matrix. Authentication failures route to the existing sign-in entry; provider failures stay fail-closed; cancellation copy says `요청` until the server reports a terminal state.

- [ ] **Step 5: Rerun focused tests and update matrix evidence**

Each implemented row records its test class/method and manual destination. Externally blocked rows record the missing provider credential or real-device dependency without changing product code.

- [ ] **Step 6: Commit route-gap fixes atomically**

Group commits by platform and behavior, keeping direct tests with implementation. Use subjects such as:

```bash
git commit -m "fix(ios): close customer route parity gaps"
git commit -m "fix(android): close customer route parity gaps"
git commit -m "docs: record mobile customer parity evidence"
```

Skip any subject whose platform has no changed files.

---

### Task 8: Qualify Android customer parity

**Files:**
- Modify only if failures require it: Android files owned by Tasks 5-7.
- Evidence output: `/tmp/ticketground-mobile-parity/android/`

**Interfaces:**
- Consumes: final Android implementation from Tasks 5-7.
- Produces: passing Gradle checks and fresh phone/tablet screenshots for Task 9.

- [ ] **Step 1: Run Android unit, lint, assemble, and instrumentation checks serially**

Run:

```bash
cd android/TicketGroundApp
./gradlew testDevCustomerDebugUnitTest
./gradlew lintDevCustomerDebug
./gradlew assembleDevCustomerDebug
./gradlew connectedDevCustomerDebugAndroidTest
```

Expected: every command exits 0 with zero failed tests or lint errors.

- [ ] **Step 2: Install and launch the final phone build**

Run:

```bash
/Users/jinny/Library/Android/sdk/platform-tools/adb install -r app/build/outputs/apk/devCustomer/debug/app-dev-customer-debug.apk
/Users/jinny/Library/Android/sdk/platform-tools/adb shell am start -n kr.ticketground.app.dev/kr.ticketground.app.MainActivity
```

Expected: install success and resumed `MainActivity`.

- [ ] **Step 3: Tap every parity-matrix action on phone, then tablet**

Use Compose UI semantics or `uiautomator` text/content descriptions. Confirm each action reaches the recorded native destination and returns safely. Stop the phone emulator before booting `ticketground_tablet_api36` for the tablet run if memory pressure or swap increases.

- [ ] **Step 4: Capture fresh Compose screenshots**

Run `VisualCaptureTest`, pull the generated `Pictures/TicketGroundVisualQA-*` PNGs into `/tmp/ticketground-mobile-parity/android/`, and validate the eight-byte PNG signature. Use emulator-window capture only to demonstrate the real installed app because `FLAG_SECURE` may intentionally black out ADB screenshots.

- [ ] **Step 5: Commit any evidence-driven Android fixes**

If source changed, rerun Steps 1-4 and commit the fix with its test:

```bash
git add android/TicketGroundApp
git commit -m "fix(android): resolve mobile parity QA findings"
```

If no source changed, do not create an empty commit.

---

### Task 9: Run final cross-platform review, deliver, and leave apps open

**Files:**
- Modify: `docs/research/MOBILE_CUSTOMER_PARITY_MATRIX.md`
- No committed screenshot artifacts.

**Interfaces:**
- Consumes: iOS and Android fresh evidence from Tasks 4 and 8.
- Produces: final review verdict, passing repository checks, pull request, merge evidence, and open phone apps.

- [ ] **Step 1: Run repository and native verification from a clean diff snapshot**

Run serially:

```bash
npm run lint
npm run typecheck
node --test tests/mobile-home-parity.test.mjs
bash scripts/run-ios-sim-test.sh
cd android/TicketGroundApp && ./gradlew testDevCustomerDebugUnitTest lintDevCustomerDebug assembleDevCustomerDebug && cd ../..
```

Expected: all commands exit 0. Do not claim full `npm run check` unless its build and all tests are also run and pass.

- [ ] **Step 2: Run reference-fidelity visual QA on fresh captures**

Compare the live web section anatomy to the native phone/tablet captures: section order, headings, card hierarchy, imagery, spacing, color, radii, touch targets, Korean line breaking, loading/empty/error states, and every destination. Any product blocker requires a source fix, recapture, and a fresh review.

- [ ] **Step 3: Obtain independent code and visual review**

Provide the approved spec, parity matrix, full diff, test outputs, and fresh screenshot paths to independent read-only reviewers. Require no blocking findings for functional integrity, protected-auth boundary, design-system use, responsive behavior, and CJK precision.

- [ ] **Step 4: Complete the parity matrix**

Every included row must show `implemented` plus automated and manual evidence, or `externally-blocked` with an exact provider/real-device dependency. No blank status or optimistic production claim remains.

- [ ] **Step 5: Commit final evidence documentation**

```bash
git add docs/research/MOBILE_CUSTOMER_PARITY_MATRIX.md
git commit -m "docs: finalize mobile customer parity evidence"
```

- [ ] **Step 6: Push, open a pull request, verify CI/review, and merge**

Push `Jinnyyunn/mobile-web-parity`, open one PR referencing the approved design and plan, verify required checks and unresolved review threads, then merge only when the branch is green and reviewers have no blocking findings.

- [ ] **Step 7: Launch both final phone apps for user inspection**

Launch the installed iPhone 17 Pro build and `ticketground_phone_api36` Android build. Bring both Simulator/Emulator windows on screen and leave them running. Report that these are local Simulator/Emulator qualification surfaces, not production/provider evidence.
