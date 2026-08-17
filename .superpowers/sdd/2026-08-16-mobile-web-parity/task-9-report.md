# Task 9 final cross-platform verification report

Date: 2026-08-17
Qualified product source: `b2d95e1c39829907755054cabc56b9b888f198fa` (`fix(android): compensate failed booking preparation`)
Status: **The original Task 9 run passed at `44f9ae5`; final-review corrections through booking compensation Fix round 4 are implemented. Exact post-report SHA requalification is recorded under `.omo/evidence/task9/fix-round4/`. GitHub delivery and external production/provider gates were not performed or claimed.**

## Security correction round 4: booking preparation compensation

The security review at `.omo/evidence/final4-security-8c8fd5b.md` found that Android could own an ACTIVE seat hold and then leak it if reservation-draft creation threw or returned an invalid draft. `TossCheckoutCoordinator.prepare` previously cancelled only a created draft after payment preparation failed; it did not know the hold identifier, while the repository did not own a complete compensation boundary. No inspected Android API type, client history, or review artifact states that cancelling a draft releases its source hold.

Commit `b2d95e1c39829907755054cabc56b9b888f198fa` makes `TypedCustomerRepository` the single pre-handoff compensation owner. Each logical `BookingRequest` now carries stable, opaque draft-cancel and hold-release idempotency keys in addition to its existing queue, hold, draft, and payment keys. After an ACTIVE hold is accepted, draft creation failure releases the hold; invalid cancellable drafts are cancelled before release; and payment preparation failure or an invalid checkout response cancels the draft before explicitly releasing the hold. Compensation runs in a non-cancellable context, attempts the remaining cleanup after an earlier cleanup failure, and attaches cleanup failures to the primary throwable without logging identifiers or secrets. A successful validated checkout handoff performs no compensation. The coordinator no longer independently cancels during `prepare`, avoiding duplicate draft cancellation; widget cancellation after successful handoff remains coordinator-owned.

Canonical fake-API coverage records exact ordered calls and stable identifiers for draft throw, invalid draft, payment throw, invalid payment request, dual cleanup failure, successful handoff, and same-attempt retry/new-attempt rotation. The compensation-failure case proves draft cancellation failure does not prevent hold release and that both cleanup failures are suppressed on the original payment error. `AccountApi` continues to send the existing authenticated idempotent DELETE methods; no server-success inference was added.

Canonical RED is `.omo/evidence/task9/fix-round4/red-booking-compensation.log` and `.exit`: baseline test compilation failed because no booking compensation API seam, checkout-preparer seam, stable cleanup identities, or repository injection existed. Focused GREEN is `green-focused.log` and `.exit` (7 booking-compensation plus 5 coordinator tests). Pre-commit qualification covered the full 98-test dev-customer JVM suite, lint, assemble, source contract 3/3, two phone booking-state interactions, a fresh retry-pending phone capture, and protected-auth zero-diff classification. Exact post-report SHA results and cleanup are recorded in the round-4 final verification ledger. No idempotency-key value is persisted in evidence.

## Security correction round 3: atomic initial booking admission

The security review at `.omo/evidence/final3-security-09468f.md` found that round 2 serialized repository execution but generated and stored a fresh `BookingRequest` before atomic admission. A rapid rejected second initial tap could therefore replace `lastBookingAttempt`; after the admitted first request failed, retry used the rejected tap's new queue/hold/draft/payment identities.

Commit `513eebb` moves the `BookingRequest` factory behind the shared `bookingPending.compareAndSet` boundary. Rejected initial and retry invocations now return before request generation or retry-identity mutation. The admitted initial request remains the exact object replayed after failure, while opening a seat map and admitting a genuinely later attempt still rotates the request and all four operation keys. Existing generation and `closeRoute` publication guards and synchronous pending-state publication remain unchanged.

The controlled regression calls `book()` twice before dispatcher progress, observes one repository request, completes the admitted first request with a transport error, and asserts that retry replays the exact first request and operation-key object. The companion rapid-retry regression holds one admitted retry, rejects a second invocation, fails the admitted retry, and proves a later retry still replays the original request. The existing new-attempt regression proves a newly admitted attempt has a distinct operation-key object.

Canonical RED is `.omo/evidence/task9/fix-round3/red-rapid-initial.log`: the baseline failed because the retry request was not the admitted first object. Focused GREEN and the pre-commit 91-test dev-customer JVM pass are `green-rapid-initial.log` and `precommit-android-jvm.log`. Exact post-report JVM, lint, assemble, source-contract, phone retry-disabled instrumentation, protected-auth zero-diff audit, snapshots, exits, and the final verification ledger are stored in the same round-3 directory. No idempotency-key value is persisted in evidence.

## Security correction round 2: booking retry concurrency and idempotency

The security review at `.omo/evidence/final2-security-beca26e.md` found that Android set booking pending state only after a launched coroutine started, admitted retry calls without a ViewModel guard, and generated fresh queue/hold/draft/payment idempotency keys on every repository invocation. A rapid repeated tap could therefore overlap artifact-creating work, while a retry of one logical attempt could create different server artifacts.

Commit `0a075df` fixes the complete native call chain:

- `CustomerAppViewModel` atomically changes `bookingPending` before launching any coroutine. Initial submit and retry share the same guarded entry point, so only one queue/hold/draft/payment chain can be active. Retry and checkout controls consume the observable state and are disabled while that call is active.
- A `BookingRequest` owns four opaque UUID-backed operation identities. The first submit creates the request, a retry reuses the same request and all four identities, and opening a seat map for a new attempt clears the old request so the next submit generates four fresh identities. Keys remain internal and are never rendered or logged.
- `TypedCustomerRepository` passes those stable identities through the existing `X-Idempotency-Key` API mechanism. `TossCheckoutCoordinator` reuses stored payment state only when the caller supplied the same logical-attempt key; a new attempt rotates it even when the ticket ID is unchanged.
- Booking publication is generation-gated. Closing the route or opening a new seat map invalidates an older completion, and exceptions only publish the existing fail-closed booking error for the current generation.

Canonical RED artifacts are `red-concurrency.log`, `red-idempotency.log`, and `red-ui.log`. They respectively record the pre-fix immediate-pending/double-retry failure and the missing request/key and rendered-pending contracts. Focused GREEN is `green-focused.log`; the wire test proves same-attempt equality and new-attempt inequality at queue, hold, draft, and payment boundaries without persisting key values in evidence.

Pre-final verification covered the complete dev-customer JVM suite (90/90), Android lint, all-variant assemble, source contract (3/3), rendered retry-disabled instrumentation, the existing expired/retry/conflict instrumentation path, and a fresh phone capture. The inspected 1024 x 1890 capture `22-phone-booking-retry-pending.png` shows the retry control disabled with no clipping, overlap, or Korean glyph defects. The installed dev-customer app opened and reached event detail, but the current dev response exposed no selectable performance schedule, so no unsafe backend mutation was made merely to manufacture a direct retry tap; `manual-installed-app.md` records that boundary.

The broad `:app:test` command executed 90 tests and retained one pre-existing `devGateDebug` failure: `LifecycleApiWireTest` expects package `kr.ticketground.app.dev`, while that build variant is `kr.ticketground.app.dev.gate`. No changed booking path participates in that assertion. The authoritative changed-surface suite is `:app:testDevCustomerDebugUnitTest`, which passes 90 tests with zero failures, errors, or skips. Full receipts, exit files, protected-boundary audit, and the exact final commit SHA are under `.omo/evidence/task9/fix-round2/`.

## Final-review correction round 1

The code-quality review at `.omo/evidence/final-review-code-fd5c162.md` found two route/state defects after the original Task 9 qualification. These product fixes supersede the original source SHA without changing rendered layout, so no visual recapture was required.

| Scenario | RED observable | Corrective implementation | Focused GREEN artifact |
| --- | --- | --- | --- |
| iOS editorial destinations | Distinct `.event("summer-festival")` and `.goods("autumn-concert")` fixtures both resolved to `.event("ticketground-day")`; 1/1 failed | `9135a79de1ad966f7edabc320ae3754d8041265c` preserves each already-validated `DiscoveryFeatured.route`; malformed or missing fixture routes continue to fail at the existing throwing loader boundary | `.omo/evidence/task9/fix-round1/ios/editorial-route-{red,green}.{log,exit}` and `editorial-route-ui-green/` (2/2 destination/Back) |
| Android discovery overlap | Controlled ranking then artist/retry completions failed 3/3 when the older success/error overwrote the newer state | `73d263a0818e5bcd171b319e79f2e63841b897f6` assigns every discovery invocation an immutable generation and publishes only the latest generation; correctness does not depend on coroutine cancellation | `.omo/evidence/task9/fix-round1/android/discovery-generation-{red,green}.{log,exit}` and `customer-viewmodel-green.log` |

The editorial controls retain their accessibility identifiers while following their source routes: the fixture item reaches `queue:iu-world-tour`, and the live catalog item reaches the `Neon Stage` goods detail. Focused UI coverage verifies both destinations and Back; the unit coverage additionally proves two arbitrary editorial items keep distinct typed destinations. Android focused coverage includes late old success, late old error, and retry supersession; the full ViewModel class executed 28 tests with no failures.

## Original clean snapshot and serial verification

The run started from branch `Jinnyyunn/mobile-web-parity`, exact HEAD `44f9ae59874544823ecb7a0683183b7566e82f54`, and a clean worktree. Receipt: `evidence/task9/receipts/initial-snapshot.txt`.

| Scenario | Exact invocation | Binary observable | Artifact |
| --- | --- | --- | --- |
| ESLint | `npm run lint` | Final post-documentation rerun exit 0, 0 errors and 14 existing warnings | `evidence/task9/logs/npm-lint-final.log`, `receipts/npm-lint-final.txt` |
| TypeScript | `npm run typecheck` | exit 0 | `logs/npm-typecheck.log`, `receipts/npm-typecheck.txt` |
| Native architecture/order contract | `node --test tests/mobile-home-parity.test.mjs` | Final post-matrix run 3/3, 0 failed, exit 0 | `logs/mobile-home-parity-after-matrix.log`, `receipts/mobile-home-parity-after-matrix.txt` |
| iOS ordinary suite | `bash scripts/run-ios-sim-test.sh --runtime com.apple.CoreSimulator.SimRuntime.iOS-26-5 --device-type com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro --evidence-dir …/evidence/task9/ios-ordinary -- xcodebuild test -project ios/TicketGroundApp/TicketGroundApp.xcodeproj -scheme TicketGroundApp -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' -only-testing:TicketGroundAppTests -skip-testing:TicketGroundAppTests/BackendFixtureRunnerTests -only-testing:TicketGroundAppUITests` | unit 177/177; UI 86 executed, 2 intentional skips, 0 failures; exit 0; `TEST SUCCEEDED`; device cleanup complete | `ios-ordinary/xcodebuild.log`, `receipts/ios-ordinary.txt` |
| iOS isolated live boundary | `bash scripts/run-ios-live-tests.sh --project ios/TicketGroundApp/TicketGroundApp.xcodeproj --scheme TicketGroundApp --destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.5' --test-only TicketGroundAppTests/BackendFixtureRunnerTests/testFreshDatabaseAndCleanup --evidence-dir …/evidence/task9/ios-live` | 1/1, exit 0, `TEST EXECUTE SUCCEEDED`; backend, ephemeral ports, database, and device cleanup complete | `ios-live/xcodebuild.log`, `ios-live/simulator.log`, `receipts/ios-live.txt` |
| Android JVM | `JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' ANDROID_HOME='/Users/jinny/Library/Android/sdk' ANDROID_SDK_ROOT='/Users/jinny/Library/Android/sdk' ./gradlew --no-daemon testDevCustomerDebugUnitTest` from `android/TicketGroundApp` | 82 tests, 0 failures/errors/skips, exit 0 | `logs/android-unit-rerun.log`, `receipts/android-unit-rerun.txt`, `receipts/android-unit-totals.txt` |
| Android lint | same environment, `./gradlew --no-daemon lintDevCustomerDebug` | exit 0 | `logs/android-lint.log`, `receipts/android-lint.txt` |
| Android assemble | same environment, `./gradlew --no-daemon assembleDevCustomerDebug` | 38 tasks, exit 0 | `logs/android-assemble.log`, `receipts/android-assemble.txt` |

The built APK was `android/TicketGroundApp/app/build/outputs/apk/devCustomer/debug/app-dev-customer-debug.apk`, SHA-256 `83b11bf5e4e9b572c51e76b59067ecf5fea2d5ddaa7ab66b5fd3949022765ce5` (`receipts/android-apk-sha256.txt`). Full `npm run check` was not run and is not claimed.

### Diagnosed command/environment boundaries

- The brief's bare `bash scripts/run-ios-sim-test.sh` exited 2 because the current wrapper requires runtime, device type, evidence directory, and a nested command. This was command drift, not a test failure; `logs/ios-sim-test.log` and `receipts/ios-sim-test.txt` retain it. The fully parameterized ordinary and isolated-live commands above are the authoritative exits.
- The first Android JVM attempt exited 1 before tests because neither `ANDROID_HOME` nor `local.properties` was present. The SDK existed at `/Users/jinny/Library/Android/sdk`; rerunning with process-local environment variables passed without modifying configuration. The diagnostic is retained in `logs/android-unit.log` and `receipts/android-unit.txt`.
- The first ESLint attempt found two errors only in an ignored Gradle-generated `android/TicketGroundApp/app/build/reports/…/report.js`. The ignored build directory was moved recoverably to `/tmp`, the clean-source rerun passed, and no lint rule or product source was changed. Evidence: `logs/npm-lint.log`, `receipts/npm-lint-diagnosis.txt`, and the final rerun artifacts above.

## Live web and native visual fidelity

The exact worktree ran at `http://127.0.0.1:5601/` with a temporary database and an isolated Chrome profile. Computer Use operated the actual Chrome accessibility surface. The audit clicked header search, Concert category, hero, ranking, opening, public CLEAN resale, genre recommendation, editorial, Region shortcut, and Search shortcut; it also observed a populated `IU` result and a Korean no-results state. Exact destinations and the server/browser boundary are in `evidence/task9/receipts/browser-visual-audit.md`. Fresh web screenshots were kept only under `/tmp/ticketground-task9-web-captures/`.

The live web and native evidence agree on the ordered anatomy: header/search, category, hero, ranking, opening, public resale, genre, editorial, and shortcuts. The live light theme supplies the closest reference for black/white/yellow/red tokens; dark theme was also inspected. Cards retain image/title/metadata hierarchy, rounded surfaces, section rhythm, and readable Korean. Native layouts adapt rather than copy desktop pixels: iOS phone is a single-column stack and tablet uses adaptive columns; Android phone uses compact cards/bottom navigation and tablet uses rail/multi-column geometry. This matches the approved behavioral/token fidelity contract rather than claiming desktop pixel identity.

All 20 Task 4 canonical iOS PNG hashes under `/tmp/ticketground-mobile-parity/ios/screenshots/{phone,tablet}/` were recomputed and matched `task-4-report.md`; all key section/state images were opened at original resolution. All 22 Task 8 Fix6 PNG hashes matched `evidence/task8/fix-round6/hashes/visual-22.sha256`; phone, tablet, loading, empty, retryable error, opening/resale, genre/editorial, shortcuts, lifecycle, and installed-window images were opened at original resolution. Korean copy had no tofu, material clipping, or overlap. iOS 44-point and Android 48-dp target contracts are covered by their rendered tests and final phone/tablet interaction evidence.

The live browser directly proved ready and search-empty states. Loading/error were not safely inducible through public fixture controls, so no live-browser claim is made for them. The distinct native states are proven by iOS Task 4 `loading.png`, `empty.png`, and `error.png`, Android Fix6 `10-state-loading.png`, `11-state-empty.png`, and `12-state-error-retry.png`, plus the exact automated suites. Android VisualCapture media placeholders are fixture-state evidence, not production media proof; `visual/22-installed-phone-window.png` separately shows rendered real media.

No product blocker was found, so Task 9 changed documentation only. No recapture or product RED/GREEN cycle was required.

## Final matrix disposition

`docs/research/MOBILE_CUSTOMER_PARITY_MATRIX.md` now audits every included row:

- 9/9 ordered home rows are repository/local implemented with exact automated and manual evidence.
- 16/16 customer journey rows are repository/local implemented with exact automated and manual evidence.
- 25/25 total rows have no blank or optimistic status.
- Five exact external gates remain: Toss merchant/transaction qualification, App Attest/Play Integrity on real devices, APNs/FCM delivery on real devices, admission gate/scanner one-time consume, and Kakao channel/provider-console availability.

Public `/resale` browsing remains distinct from principal-bound official resale listing/buy/cancel. Simulator/emulator fixture principals do not establish production authentication or provider success. The protected Google/Kakao/Naver simple-login boundary was read-only; no provider console was opened and no protected file was changed.

## Delivery boundary

The tracked evidence documentation is this report plus `docs/research/MOBILE_CUSTOMER_PARITY_MATRIX.md`, committed with `docs: finalize mobile customer parity evidence`. Raw logs and screenshots remain ignored/uncommitted. Push, PR, CI/review, merge, production qualification, and leaving apps running belong to the parent delivery/review phase and are not claimed here. In accordance with the parent handoff, Task 9 cleanup leaves no Simulator, Emulator, Gradle daemon, isolated Chrome, or local Task 9 server running.
