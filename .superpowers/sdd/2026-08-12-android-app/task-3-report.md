# Task 3 report — Android customer UI and graphical seat selection

## Delivered

- Replaced the Task 1 placeholder shell with a production Compose customer shell.
- Added four primary destinations: 홈, 검색, 찜, 마이페이지.
- Added a phone bottom navigation and an expanded-width navigation rail. Expanded event lists use a two-pane layout.
- Added backend-driven home discovery, ranking, open calendar, search, event detail, public support, watchlist, account/tickets, cancellation, official resale, trusted-device, push, and QR states.
- Added deterministic loading, empty, error, retry, sign-in-required, mutation-pending, and safe action-message behavior.
- Added a graphical seat map that places each seat from `Seat.mapPosition`, distinguishes available/selected/held/sold/unavailable states, and exposes Korean seat semantics with 48dp tap targets.
- Seat selection happens on the map. No separate `실제 구매 가능한 티켓 선택` list exists.
- Added explicit zoom and pan controls around the seat map so navigation does not consume seat taps.
- Wired queue and hold operations through Task 2 typed APIs. A successful active hold routes to the checkout handoff.
- Kept Toss Payments fail closed: server configuration is checked, but the payment button remains unavailable until a real Android Toss SDK and merchant configuration are qualified. No production success is simulated.
- Kept Play Integrity, FCM, and admission QR fail closed when external provider/device qualification is unavailable.
- Replaced tautological state-value tests with observable Compose and ViewModel scenarios using deterministic fixtures/fake repositories.

## Safety and scope

- No backend, iOS, web, environment, social-login, OAuth, or protected simple-login file was changed.
- UI never renders bearer tokens, provider keys, integrity proofs, signatures, nonces, or raw resource identifiers.
- Production screens contain no fixture events, placeholder tickets, or provider fake-success path.

## Verification

All Gradle work ran serially with the Android Studio JBR and local Android SDK.

| Scenario | Invocation | Binary observable | Evidence |
|---|---|---|---|
| TDD RED for the new UI contract | `./gradlew compileDevDebugAndroidTestKotlin --no-daemon` before implementation | Failed on missing `ui` surfaces and symbols | `.omo/evidence/task-3-android-ui/tdd-red-androidtest-compile.log` |
| JVM state/repository tests | `./gradlew testDevDebugUnitTest --no-daemon` | `BUILD SUCCESSFUL` | `.omo/evidence/task-3-android-ui/jvm-tests.log` |
| Compose UI test source readiness | `./gradlew compileDevDebugAndroidTestKotlin --no-daemon` | `BUILD SUCCESSFUL` | `.omo/evidence/task-3-android-ui/ui-test-source-compile.log` |
| Android lint | `./gradlew lintDevDebug --no-daemon` | `BUILD SUCCESSFUL` | `.omo/evidence/task-3-android-ui/lint-dev-debug.log` |
| Debug APK assembly | `./gradlew assembleDevDebug --no-daemon` | `BUILD SUCCESSFUL`; `app-dev-debug.apk` produced | `.omo/evidence/task-3-android-ui/assemble-dev-debug.log` |
| Release/R8 assembly | `./gradlew assembleProdRelease --no-daemon` | `BUILD SUCCESSFUL`; unsigned release APK produced | `.omo/evidence/task-3-android-ui/assemble-prod-release.log` |

The Compose UI test APK/source is ready, but instrumentation scenarios were intentionally not executed because Task 4 owns serial emulator/device QA.

## External qualification still required

- Google Play signing and Play Integrity cloud-project/device proof
- FCM project configuration and real push delivery
- Toss Payments Android SDK and merchant credentials
- Physical-device QR issuance and admission verification
