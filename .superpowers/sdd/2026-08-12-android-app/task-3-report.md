# Task 3 report — Android customer UI and graphical seat selection

## Delivered

- Replaced the Task 1 placeholder shell with a production Compose customer shell.
- Added four primary destinations: 홈, 검색, 찜, 마이페이지.
- Added a phone bottom navigation and an expanded-width navigation rail. The real expanded home route now renders the event list and detail pane together.
- Added backend-driven home discovery, ranking, open calendar, search, event detail, public support, watchlist, account/tickets, cancellation, official resale, trusted-device, push, and QR states.
- Added deterministic loading, empty, error, retry, sign-in-required, mutation-pending, and safe action-message behavior.
- Added a graphical seat map that safely resolves `map.image` only on the configured HTTPS origin, renders raster/SVG assets asynchronously below the controls, and falls back to a usable stage layer when loading fails.
- Seat centers and marker width/height now follow backend `Seat.mapPosition` geometry with the same 16dp/60dp marker bounds and 48dp clamped touch targets as the accepted iOS implementation.
- Backend and newly acquired HELD seat IDs are carried through the repository/ViewModel path and remain visually and accessibly distinct from sold and generic unavailable seats.
- Centralized typography, spacing, radius, layout, and every seat-state color in Android semantic tokens consumed by the changed customer surfaces.
- Seat selection happens on the map. No separate `실제 구매 가능한 티켓 선택` list exists.
- Added explicit zoom and pan controls around the seat map so navigation does not consume seat taps.
- Wired queue and hold operations through Task 2 typed APIs. A successful active hold routes to the checkout handoff.
- Kept Toss Payments fail closed: server configuration is checked, but the payment button remains unavailable until a real Android Toss SDK and merchant configuration are qualified. No production success is simulated.
- Kept Play Integrity, FCM, and admission QR fail closed when external provider/device qualification is unavailable.
- Replaced tautological state-value tests with observable Compose and ViewModel scenarios using deterministic fixtures/fake repositories.
- Added focused coverage for safe image origins, image fallback with still-selectable seats, backend marker geometry, HELD/SOLD/unavailable semantics, selection recomposition, and the production tablet route.
- Hardened the dedicated Coil image loader by disabling both HTTP and HTTPS redirect following and disabling service-loaded fetchers; its only network fetcher uses the redirect-rejecting OkHttp client.
- Preserved the complete expanded home information architecture: two-pane event discovery now retains the search action, open calendar, and public support navigation/content.

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
| Compose UI test APK readiness | `./gradlew assembleDevDebugAndroidTest --no-daemon` | `BUILD SUCCESSFUL`; signed debug test APK produced | `.omo/evidence/task-3-android-ui/assemble-ui-test-apk.log` |
| Android lint | `./gradlew lintDevDebug --no-daemon` | `BUILD SUCCESSFUL` | `.omo/evidence/task-3-android-ui/lint-dev-debug.log` |
| Debug APK assembly | `./gradlew assembleDevDebug --no-daemon` | `BUILD SUCCESSFUL`; `app-dev-debug.apk` produced | `.omo/evidence/task-3-android-ui/assemble-dev-debug.log` |
| Release/R8 assembly | `./gradlew assembleProdRelease --no-daemon` | `BUILD SUCCESSFUL`; unsigned release APK produced | `.omo/evidence/task-3-android-ui/assemble-prod-release.log` |

### Clone-fidelity P1 correction verification

| Scenario | Invocation | Binary observable | Evidence |
|---|---|---|---|
| TDD RED for safe image/geometry/HELD propagation | `./gradlew --no-daemon --no-parallel :app:testDevDebugUnitTest` before correction | Compile failed on the deliberately missing presentation APIs and `heldSeatIds` | `.omo/evidence/task-3-android-ui-p1-fixes/01-red-unit-tests.log` |
| Focused JVM GREEN | same JVM invocation after correction | `BUILD SUCCESSFUL`; URL origin, marker geometry, state semantics, and ViewModel held-ID scenarios passed | `.omo/evidence/task-3-android-ui-p1-fixes/02-green-unit-tests.log` |
| Compose source readiness | `./gradlew --no-daemon --no-parallel :app:compileDevDebugAndroidTestKotlin` | `BUILD SUCCESSFUL`; production tablet-path and graphical-map tests compile | `.omo/evidence/task-3-android-ui-p1-fixes/03-ui-test-source-compile.log` |
| Fresh full serial gate | `./gradlew testDevDebugUnitTest compileDevDebugAndroidTestKotlin lintDevDebug assembleDevDebug assembleDevDebugAndroidTest assembleProdRelease --no-daemon --no-parallel --rerun-tasks` | `BUILD SUCCESSFUL in 1m 34s`; 135/135 tasks executed; 45 JVM tests, 0 failures/errors/skips; lint errors 0 | `.omo/evidence/task-3-android-ui-p1-fixes/05-fresh-full-gradle-rerun.log` |
| Built APKs | same fresh full serial gate | debug `8b015987…e801e27`; UI-test `7adcbcad…105ebae`; R8 release `9842a7fb…83b557` | `.omo/evidence/task-3-android-ui-p1-fixes/06-verification-receipt.txt` |

### Final fidelity correction verification

| Scenario | Invocation | Binary observable | Evidence |
|---|---|---|---|
| TDD RED for redirect policy | `./gradlew --no-daemon --no-parallel :app:testDevDebugUnitTest` before implementation | Compile failed because the redirect-rejecting image client did not exist | `.omo/evidence/task-3-android-ui-final-fixes/01-red-redirect-test.log` |
| HTTPS cross-origin redirect regression | MockWebServer JVM test through `seatMapImageHttpClient` | Initial HTTPS response remains `302`; redirect target receives 0 requests | `.omo/evidence/task-3-android-ui-final-fixes/06-https-redirect-green.log` |
| Expanded home source coverage | `./gradlew --no-daemon --no-parallel :app:compileDevDebugAndroidTestKotlin` | Production app-path scenarios compile for two-pane, search navigation, calendar, and support navigation/content | `.omo/evidence/task-3-android-ui-final-fixes/04-focused-green.log` |
| Fresh final serial gate | `./gradlew testDevDebugUnitTest compileDevDebugAndroidTestKotlin lintDevDebug assembleDevDebug assembleDevDebugAndroidTest assembleProdRelease --no-daemon --no-parallel --rerun-tasks` | `BUILD SUCCESSFUL in 1m 39s`; 135/135 tasks executed; 46 JVM tests, 0 failures/errors/skips; lint errors 0 | `.omo/evidence/task-3-android-ui-final-fixes/07-fresh-full-gradle-final.log` |
| Final APKs | same fresh final gate | debug `9c42fa65…792be25`; UI-test `3aca70ee…08cc417`; R8 release `119c4d5b…1b5105` | `.omo/evidence/task-3-android-ui-final-fixes/08-verification-receipt.txt` |
| Production tablet test correction | `./gradlew compileDevDebugAndroidTestKotlin lintDevDebug --no-daemon --no-parallel --rerun-tasks` | `BUILD SUCCESSFUL in 41s`; 38/38 tasks executed; tablet test renders `TicketGroundCustomerApp` with deterministic repository data and asserts reachable two-pane/search/calendar/support nodes | `.omo/evidence/task-3-android-ui-final-fixes/11-final-test-source-lint-green.log` |

The Compose UI test APK/source is ready, but instrumentation scenarios were intentionally not executed because Task 4 owns serial emulator/device QA.

## External qualification still required

- Google Play signing and Play Integrity cloud-project/device proof
- FCM project configuration and real push delivery
- Toss Payments Android SDK and merchant credentials
- Physical-device QR issuance and admission verification
