# Task 9 final cross-platform verification report

Date: 2026-08-17
Qualified product source: `44f9ae59874544823ecb7a0683183b7566e82f54`
Status: **PASS for repository and local web/Simulator/Emulator qualification. GitHub delivery and external production/provider gates were not performed or claimed.**

## Clean snapshot and serial verification

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
