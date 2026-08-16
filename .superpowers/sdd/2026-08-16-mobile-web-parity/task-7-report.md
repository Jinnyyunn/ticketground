# Task 7 report: remaining customer-route parity gaps

Date: 2026-08-17
Base: `d4b5ab90a177ec597d736546584453601b1703fb`
Status: **IMPLEMENTED LOCALLY — automated and manual evidence complete; external gates remain blocked**

## Pre-edit audit checkpoint

`implemented` below means the current tree has a typed native route, an observable loading/ready/empty/error or signed-out state as applicable, a focused automated assertion, and prior manual destination evidence. An API method, model, or inline button without an observable destination is not sufficient. External-provider qualification is never inferred from repository behavior.

| Row | iOS pre-edit status | Android pre-edit status | Audit evidence / exact gap |
| --- | --- | --- | --- |
| Search | implemented | implemented | iOS `.search` + `header-search`; Android `AppDestination.Search` + `home-search`; route/state tests and Task 4/6 manual evidence exist. |
| Ranking | implemented | **uncovered** | iOS `.ranking` + `route-ranking`; Android `home-ranking-more` incorrectly opens generic Search and has no ranking route/state destination. |
| Calendar | implemented | implemented | iOS `.open`; Android `CustomerRoute.OpenCalendar`; focused destination and Back evidence exist. |
| Genre | implemented | implemented | iOS `.genre`; Android `CustomerRoute.Collection`; ready/empty/error and destination tests exist. |
| Region discovery | **uncovered** | **uncovered** | iOS has typed `.region` and live state handling but no canonical `discovery-region-*` destination evidence. Android has neither a typed region route nor a region destination. |
| Venue discovery | **uncovered** | **uncovered** | iOS has typed `.place` and live detail handling but no canonical `discovery-venue-*` destination evidence. Android venue text is not a typed venue route. |
| Artist discovery | **uncovered** | **uncovered** | iOS has typed `.artist` and live detail handling but no canonical `discovery-artist-*` destination evidence. Android has no typed artist route. |
| Editorial | implemented | implemented | iOS `.event`; Android `CustomerRoute.Collection`; focused destination and manual evidence exist. |
| Event detail | implemented | implemented | iOS `.goods`; Android `CustomerRoute.Event`; native detail states and focused navigation evidence exist. |
| Seat map | implemented | implemented | iOS `.seatMap`; Android `CustomerRoute.SeatMapRoute`; loading/ready/empty/error/stale-unavailable contracts and graphical tap evidence exist. |
| Queue, hold, and draft | implemented | **uncovered** | iOS `.queue` then `.booking` with booking-session tests. Android repository behavior can return waiting/held, but no typed `CustomerRoute.Booking` destination exposes pending/admitted/expired/conflict/retry. |
| Toss handoff | implemented | implemented | iOS `.checkout`; Android `CustomerRoute.Checkout`; duplicate-submit/cancel/unavailable boundaries are tested. Merchant approval/webhook/settlement/refund remain externally blocked. |
| Watchlist | implemented | implemented | iOS `.watchlist`; Android `AppDestination.Watchlist`; loading/ready/empty/signed-out/error and mutation rollback evidence exist. |
| Reservation detail | implemented | **uncovered** | iOS `.reservation(id:)`; Android My Page renders an inline overview only, without typed reservation destination or `reservation-detail`. |
| Cancellation request | implemented | **uncovered** | iOS `.cancel`; Android mutation exists inline but has no typed cancellation destination. Success copy already says request/review, not refund completion. |
| Official resale lifecycle | implemented | **uncovered** | iOS `.resale` lifecycle route. Android `CustomerRoute.Resale` is the signed-out public pool only; account listing is inline and is not a lifecycle destination. |
| Trusted device | **uncovered** | **uncovered** | Both platforms have service/action code embedded in account/reservation UI, but neither exposes the required independently observable typed subdestination and canonical `trusted-device` state surface. Real attestation remains externally blocked. |
| Push | **uncovered** | **uncovered** | Both platforms have registration service/action code but no required independently observable typed subdestination and canonical `push-notifications` states. Real APNs/FCM delivery remains externally blocked. |
| Admission QR | **uncovered** | implemented | iOS QR is embedded in reservation with only lifecycle-prefixed evidence and no canonical subdestination. Android has the reservation-bound QR control/state and focused security tests; real scanner/consume remains externally blocked. |
| Help | implemented | implemented | iOS `.help`; Android `CustomerRoute.Support`; loading/ready/empty/error/retry destination tests and manual support evidence exist. |
| Inquiry | implemented | **uncovered** | iOS `.inquiry` has principal states and focused tests. Android public Support has no typed inquiry route/history/composer/signed-out destination. Kakao external transition remains externally blocked. |

Directed person-to-person transfer is `excluded-by-approved-scope` by product policy and is not a parity row. No other matrix row is excluded.

## External qualification boundaries

- Toss Payments production approval/webhook, settlement, refund, and real transaction evidence: `externally-blocked` by merchant credentials/provider environment.
- Trusted device attestation: `externally-blocked` by App Attest/Play Integrity credentials and real-device proof.
- Push delivery: `externally-blocked` by APNs/FCM credentials and real-device receipt.
- Admission QR consume: `externally-blocked` by gate keys, scanner hardware, and one-time physical consume evidence.
- Kakao inquiry availability: `externally-blocked` by Kakao channel/provider-console qualification.
- Google/Kakao/Naver simple-login remains read-only; signed-out rows may only navigate to the existing login entry.

## TDD ledger

All REDs were captured before the corresponding product implementation.

| Platform / rows | RED | GREEN |
| --- | --- | --- |
| iOS region, venue, artist, trusted device, push, admission QR | `scripts/run-ios-sim-test.sh ... xcodebuild test ... -only-testing:TicketGroundAppUITests/...`; exit 65, 6/6 focused tests failed (7 missing canonical assertions because venue asserts both control and destination). | Discovery focused 5/5 plus artist 1/1. Lifecycle compatibility/canonical focused 5/5 after replacing the first QR identifier collision. The final implementation attaches identifiers to the visible section headings, not hidden overlay content; post-heading focused 5/5 passed. |
| Android ranking, region, venue, artist, booking, reservation, cancellation, resale lifecycle, trusted device, push | `./gradlew :app:testDevCustomerDebugUnitTest --tests 'kr.ticketground.app.ui.CustomerAppViewModelTest'`; compilation failed on the 11 absent route types/open methods. | `CustomerAppViewModelTest`: 23/23 passed. |
| Android inquiry | Same focused JVM command after adding the inquiry test; compilation failed on absent `inquiries`, `submitInquiry`, and repository methods (`android-inquiry-red.log`). | Focused inquiry route and server-created-thread behavior passed (`android-inquiry-green.log`). |
| Android canonical destinations | `./gradlew :app:connectedDevCustomerDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=kr.ticketground.app.TicketGroundAppShellTest`; the first 30-test pass exposed 2 legacy selector regressions, so it remained RED. | Kept the legacy overview list tag and gave cancellation navigation distinct copy. Final `TicketGroundAppShellTest`: 30/30 passed in 52s. |

## Implemented gap disposition

| Row | iOS final | Android final | Observable contract |
| --- | --- | --- | --- |
| Ranking | implemented (unchanged) | implemented | `CustomerRoute.Ranking`; ready/empty list semantics; canonical destination test. |
| Region | implemented | implemented | iOS `discovery-region-*`; Android `CustomerRoute.Region` / `region-screen-*`. |
| Venue | implemented | implemented | iOS typed venue control/destination; Android `CustomerRoute.Venue` / `venue-screen-*`. |
| Artist | implemented | implemented | iOS canonical artist destination; Android `CustomerRoute.Artist` / `artist-screen-*`. |
| Queue, hold, draft | implemented (unchanged) | implemented | Android `CustomerRoute.Booking` renders server-returned pending/admitted/expired/conflict/error state and never infers success. |
| Reservation detail | implemented (unchanged) | implemented | `CustomerRoute.Reservation` / `reservation-detail`, including signed-out handling. |
| Cancellation request | implemented (unchanged) | implemented | `CustomerRoute.Cancellation` / `cancellation-request`; copy remains `요청` until terminal server state. |
| Official resale lifecycle | implemented (unchanged) | implemented | Separate `CustomerRoute.ResaleLifecycle`; the public resale pool remains separate. |
| Trusted device | implemented | implemented | Visible `trusted-device` state surface; Android typed subroute; provider proof still fails closed. |
| Push | implemented | implemented | Visible `push-notifications` state surface; Android typed subroute; no client-side delivery claim. |
| Admission QR | implemented | implemented (unchanged) | iOS visible `admission-qr` surface while preserving legacy QR button/image identifiers; no payload captured. |
| Inquiry | implemented (unchanged) | implemented | `CustomerRoute.Inquiry`; signed-out/history/form/error states; only a server-returned thread is shown as created. |

No WebView destination/page was added. Directed transfer remains excluded by approved policy.

## Verification totals

- iOS post-heading focused lifecycle regression: 5/5 passed.
- iOS post-heading UI full suite: 86 executed, 2 skipped, 0 failures in 973.216 seconds (`ios-complete-post-heading-final/xcodebuild.log`).
- The combined cached command also included the harness-only `BackendFixtureRunnerTests` without its environment file, so its aggregate exit was 65 even though the entire UI suite passed. This is not reported as green. The corrected clean wrapper explicitly skips only that separately provisioned integration harness: 177/177 unit tests passed, 0 failures, exit 0 (`ios-unit-post-heading-clean`).
- Android JVM suite after the last Android source edit: 80/80 across 16 suites, 0 failures/errors/skips (`android-unit-final.log`).
- Android emulator Compose suite: `TicketGroundAppShellTest` 32/32 passed after Fix round 1 (`android-fix1-compose-final.log`).
- Source architecture contract: `node --test tests/mobile-home-parity.test.mjs`, 3/3 passed.
- Android fresh `:app:assembleDevCustomerDebug --rerun-tasks`: 38/38 Gradle tasks executed, build successful in 15s.

## Manual action matrix and rendered evidence

Heavy UI work was serialized: the original iPhone Simulator run was stopped/deleted before Android started; Android was stopped before the final iOS post-heading rerun. iOS changed routes were exercised by real XCUITest destination actions on a fresh iPhone 17 Pro simulator. Android used the actual `kr.ticketground.app.dev` window with computer-use screenshots and Android UI hierarchy assertions.

| Action | Result / return state | Evidence |
| --- | --- | --- |
| Home ranking section → first ranking card | Ranking cards rendered and the first card opened event detail. | `android-manual-fix2-final/00-home-ranking.png`, `01-event-detail.png` |
| Event → venue | `잠실종합운동장 주경기장` destination; Back returned to home. | `02-venue.png`, `03-back-home-after-venue.png` |
| Event → artist | `IU` destination opened. | `04-artist.png` |
| Artist → Back | A distinct, later capture shows the returned home screen at a separately scrolled position. | `05-back-home-after-artist.png` |
| My Page while signed out | Existing sign-in entry shown; account routes fail closed without bypassing authentication. | `06-account-signed-out.png` |

Direct Android manual destinations/returns: 5 action families completed. Six uncovered Android subroutes were not falsely claimed as direct manual destinations: ranking/region hit-testing or scroll reachability, booking requires a selected server schedule, and reservation/cancellation/resale/trust/push/inquiry are principal-bound behind the signed-out root. Their native destination/state behavior is covered by the 32/32 real-emulator Compose suite. This is a local fixture/auth limitation, not external-provider success evidence.

Rendered review used only screenshots created after the last Android source edit. Korean headings, venue/artist names, signed-out copy, touch surfaces, and bottom navigation showed no clipping, mojibake, overlap, or unsafe payload. Existing system toolbar/cutout spacing remained intact. Evidence contains no QR value, PII, credential, push token, payment key, or provider secret. The seven filenames above are chronological; artist destination `04` is followed by the distinct Back-to-home capture `05`, so venue-return evidence is not reused as artist-return evidence.

## Protected auth and scope audit

The final diff is restricted to the matrix/report and its source contract, iOS discovery/account lifecycle files and their UI tests, and Android customer UI/data plus focused tests. No path matching `PROTECTED_AUTH_PATTERNS` changed. Google/Kakao/Naver login UI, config, OAuth, session, tests, env files, and provider consoles remained read-only.

## Cleanup and external blockers

- Android emulator `ticketground_phone_api36` was killed; `adb devices` returned no emulator.
- Each iOS run uses `scripts/run-ios-sim-test.sh`; its cleanup trap terminates, shuts down, and deletes the fresh simulator and records `device-cleanup=complete`.
- No backend, port, or dev server was started for Task 7. The Gradle daemon used for verification was stopped with `./gradlew --stop`.
- Still externally blocked: Toss merchant approval/webhook/settlement/refund; App Attest/Play Integrity real-device attestation; APNs/FCM real delivery; physical QR scanner/gate consume; Kakao channel/provider-console availability.

## Self-review

- Auth failures route only to the existing sign-in entry; no login code was touched.
- Provider failures remain unavailable/error and never claim payment, refund, trust, delivery, admission, or inquiry success.
- Cancellation remains a request until a terminal server state.
- No destination/page WebView or directed person-to-person transfer was introduced.
- Fresh build/test fixtures were used after source edits; failures were preserved in the ledger rather than overwritten by later green output.

## Fix round 1 — 2026-08-17

### Review findings and TDD

The visual review correctly identified two rendered Korean word splits and one evidence overclaim. Tests were added against the real customer composables constrained to 360 dp width before changing production typography.

| Finding | RED | Minimal production change | GREEN |
| --- | --- | --- | --- |
| Event detail split `상품입니다.` and `따라` | `eventDetailKoreanParagraph_keepsProductAndConnectiveWordsIntactAtPhoneWidth`; `상품입니다. must remain on one line` (`android-fix1-event-red.log`). The same test explicitly obtains the rendered `TextLayoutResult` for both `상품입니다.` and `따라`. | Apply existing `bodySmall` customer typography to the event summary and each notice. A first `LineBreak.Paragraph` attempt did not resolve the actual-width failure and was discarded. | Focused 1/1 passed; both phrase assertions executed (`android-fix1-event-green.log`). |
| Ranking venue split `주경기장` | `rankingVenueKoreanParagraph_keepsVenueWordIntactAtCardWidth`; `주경기장 must remain on one line` (`android-fix1-ranking-red.log`). | Apply existing `bodySmall` customer typography to ranking venue copy. | Focused 1/1 passed (`android-fix1-ranking-green.log`). |
| Artist return evidence absent | Prior `04-artist.png` had no later Back capture; the earlier home capture only proved venue return. | No product change. Recapture the complete action sequence after the final APK install. | `04-artist.png` is followed chronologically by unique `05-back-home-after-artist.png`. |

### Fix verification

- Real API 36 emulator Compose suite: 32/32 passed, 0 failures/skips (`android-fix1-compose-final.log`).
- JVM suite: 80/80 passed, 0 failures/skips (`android-fix1-jvm-final.log`).
- Source contract: 3/3 passed (`android-fix1-source-final.log`).
- Fresh affected assemble: `:app:assembleDevCustomerDebug --rerun-tasks`, 38/38 tasks executed, successful (`android-fix1-assemble-final.log`); that APK was installed before the action matrix.
- iOS source and tests were untouched in this fix round. The previous 86-executed UI and corrected 177/177 unit evidence remains the exact boundary; no iOS heavy rerun was performed.

### Fresh rendered evidence integrity

Final directory: `/tmp/ticketground-mobile-parity/task7/android-manual-fix1-final`.

- All seven files are valid RGBA PNGs, all seven SHA-256 digests are unique, and mtimes increase from `2026-08-17T03:33:43+0900` through `03:34:30+0900`, after the final Android source edit at `03:23:02+0900`.
- Computer-use ScreenCaptureKit dynamically emitted `553x1280` for the two photo-heavy home captures (`00`, `05`) and `822x1902` for the other five captures. Each file was directly inspected at its native size and contains a completely composited app screen; no partial frame, transparent hole, stale overlay, clipping, or mixed-state capture was accepted.
- `00` shows `주경기장` intact, and `01` shows `상품입니다.` and `따라` intact. `02` is venue, `03` is its Back-to-home state, `04` is artist, `05` is the later distinct Back-to-home state, and `06` is signed-out account.
- No capture contains a QR payload, PII, credentials, payment/provider keys, push token, or secret.

### Fix scope and cleanup

- Product/test edits are limited to Android customer UI typography and its rendered layout regressions; report-only evidence corrects the prior claim. No WebView, auth UI/config/OAuth/session/test/env file, provider console, iOS file, or directed-transfer behavior changed.
- Final cleanup stopped the Android emulator and Gradle daemon. No backend, port, or dev server was started.

## Fix round 2 — 2026-08-17

### Re-review finding and TDD

The round-1 re-review accepted all four prior findings and exposed one new product blocker: the final event notice rendered `있습니다.` as `있습` / `니다.`. The existing actual-360 dp regression was extended to assert the complete semantic predicate `제한될 수 있습니다.` on one rendered line, while retaining its `상품입니다.` and `따라` assertions.

- RED: focused 1/1 failed with `제한될 수 있습니다. must remain on one line`, exit 1 (`android-fix2-event-red.log`). A preceding SDK-path setup failure was not counted as product RED.
- Narrower typography, generic Compose phrase word-break, and letter-spacing variants did not satisfy the real TextLayout geometry and were discarded.
- GREEN: the unchanged notice words now place the exact terminal restriction predicate on a deliberate continuation line. The focused test locates the real rendered node by substring and verifies the whole predicate range, not an API or source-string surrogate. Focused 1/1 passed (`android-fix2-event-green.log`).

### Fix round 2 verification

- Real API 36 emulator Compose suite: 32/32 passed, 0 failures/skips (`android-fix2-compose-final.log`).
- JVM suite: 80/80 passed, 0 failures/skips (`android-fix2-jvm-final.log`).
- Source contract: 3/3 passed (`android-fix2-source-final.log`).
- Fresh assemble: 38/38 tasks executed, successful (`android-fix2-assemble-final.log`). The first generic uninstall returned `DELETE_FAILED_INTERNAL_ERROR`, so it was not accepted as clean-install evidence; explicit user-0 removal then returned `Success`, package absence was checked, and the final APK install returned `Success` before capture.
- iOS remained byte-for-byte untouched in round 2 and was not rerun. Its prior 86-executed UI and 177/177 unit boundary is unchanged.

### Fix round 2 manual and visual evidence

Final directory: `/tmp/ticketground-mobile-parity/task7/android-manual-fix2-final`.

- The complete chronological sequence was recreated after the last source edit and final APK install: `00` Home/ranking, `01` event, `02` venue, `03` venue Back-to-home, `04` artist, `05` distinct artist Back-to-home, and `06` signed-out My Page.
- Every image was opened directly at native size. `00` retains intact `주경기장`; `01` retains intact `상품입니다.` and `따라` and now renders the whole `제한될 수 있습니다.` on one line; `04` is followed by the unique, later `05` artist-return frame.
- All seven have PNG signature `89504e470d0a1a0a`, RGBA alpha, unique SHA-256 hashes, chronological mtimes from `03:55:22` through `03:56:07 +0900`, and are newer than the final rendered source edit at `03:52:03 +0900`.
- ScreenCaptureKit again emitted `553x1280` for photo-heavy Home frames `00` and `05`, and `822x1902` for the other five. All seven app viewports are fully composited; exterior transparent/black space outside the emulator window is not app content, and no partial frame, stale overlay, notification shade, mixed state, clipping, tofu, or sensitive artifact was accepted.
- No image contains QR payload, customer PII, credentials, payment/provider keys, push tokens, or secrets.

### Round 2 scope and cleanup

- The diff remains limited to the Android event-notice layout, its rendered regression, and this report. No WebView, iOS, protected auth UI/config/OAuth/session/test/env, provider-console, directed-transfer, payment-success, refund-success, device-success, push-success, QR-success, or admission-success behavior changed.
- Final cleanup stopped the Android emulator and Gradle daemon. No Task 7 backend, development server, or port was started.

## Fix round 3 — 2026-08-17

### Five-finding disposition and TDD

All five Important findings in `task-7-review.md` were reproduced against the reviewed baseline before production edits.

| Finding | RED | GREEN / final behavior |
| --- | --- | --- |
| Android queue/hold/draft flattened terminal failures | The focused JVM characterization failed to compile because `BookingProgress.Expired`, `.Conflict`, `.Error`, and `retryBooking` did not exist. | Server statuses now map to waiting, held/draft, expired, conflict, or error. A repository exception remains inside the typed booking destination, and retry reissues the remembered booking attempt. Compose verifies expired/conflict/error copy, retry, and absence of an inferred success. |
| Android discovery routes were precomputed Ready-only lists | The focused JVM characterization failed on the absent `discovery`, `retryDiscovery`, repository `ranking/region/venue/artist` boundaries, and the old list-carrying `CustomerRoute.Ranking`. | Each typed route now starts loading and calls the repository/API boundary. Empty and error states are observable and retry calls the repository again; region, venue, artist, and ranking no longer reuse a precomputed Ready-only route list. |
| Android account routes were outer-tag aliases | The authenticated Compose characterization showed the same lifecycle overview beneath all five route tags. | Reservation, cancellation request, account resale, trusted device, and push now render separate typed bodies and state tags. Focused authenticated assertions verify distinct content; the existing five signed-out route checks still fail closed to the existing login entry. |
| iOS lifecycle routes were headings on reservation | Three focused XCUITests failed 7 assertions because `trustedDevice`, `pushNotifications`, and `admissionQR` all launched the reservation aggregate and exposed the cancellation action. | `LiveLifecycleDestination` now has three independent cases. Each subdestination loads only its required state, has a unique root, and preserves the legacy lifecycle mutation identifiers. Focused iPhone GREEN was 5/5; fresh iPad destination coverage was 3/3. |
| Totals/form-factor evidence were overstated | The matrix said Compose 30/30 while the accepted receipt was 32/32, and direct phone/tablet state evidence was absent. | Final totals below are generated from the current results. Actual phone and tablet windows were controlled, with installed fixture surfaces used for authenticated states that cannot be reached from a signed-out local principal. |

The first Android attempts without an explicit JDK/SDK failed at environment discovery and are not counted as product RED. The product RED was the subsequent compile failure after `JAVA_HOME` and the Android SDK were supplied. No implementation was added for an API-name-only claim.

### Final verification

- iOS focused iPhone routes: 5/5 passed. The ordinary full command executed 178 unit tests with one expected failure only because the live backend environment file was intentionally absent; its other 177 unit tests passed. The separately provisioned live wrapper then passed 1/1, so the correctly invoked unit boundary is 178/178. The full UI suite executed 86 tests, skipped 2, and failed 0.
- iOS fresh iPad Pro 11-inch Simulator: trusted device, push, and admission QR 3/3 passed in 18.937s; `task7-fix3-ios-ipad/simulator.log` records `device-cleanup=complete`.
- Android focused behavior GREEN was followed by JVM `:app:testDevCustomerDebugUnitTest`: 81/81, 0 failures/errors/skips.
- Android API 36 phone `TicketGroundAppShellTest`: 34/34, 0 failures/skips. An earlier interrupted process and a stale uninstall failure were discarded; the accepted run used a wiped emulator and a fresh install.
- Android API 36 tablet `VisualCaptureTest`: 21/21, 0 failures/skips, build successful in 1m13s.
- `node --test tests/mobile-home-parity.test.mjs`: 3/3 passed.
- `:app:assembleDevCustomerDebug`: successful. The final rerun wrapper initially used the Android project as cwd and omitted `ANDROID_HOME`; that environment-only failure was corrected by invoking from the repository root with explicit JDK/SDK paths.

### Phone/tablet action and rendered evidence

Heavy runs were serialized. The Android tablet was stopped before the phone started, the phone was stopped before the final focused iPad run, and no two Simulator/Emulator builds overlapped.

| Form factor | Direct action sequence | Result / evidence |
| --- | --- | --- |
| Android phone, real installed app | Home error → tap Retry → Ready home → tap Ranking → Back to Home → tap Search → tap event → Event detail → tap My Page | Seven chronological ScreenCaptureKit frames plus UI hierarchy XML under `task7-fix3-manual-phone`. Retry reached Ready, ranking used the repository-backed destination, Back restored Home, event detail rendered, and My Page failed closed with `로그인이 필요합니다`. |
| Android tablet, real installed app | Home → tap Search → tap event → Event detail → Back to Search → tap My Page | Five chronological ScreenCaptureKit frames plus hierarchy XML under `task7-fix3-manual-tablet`. Back restored the prior search/result state and signed-out account remained protected. |
| Android phone/tablet installed fixture surfaces | Reservation, cancellation, account resale, trusted device, push, and booking conflict; plus the prior public customer states | Phone changed-state images were regenerated after the last source edit. The fresh tablet collection `TicketGroundVisualQA-1786909975226` contains 21/21 states, including changed images `16`–`21`. This is installed-app fixture evidence, not external-provider qualification. |
| iPhone/iPad installed fixture surfaces | Independent trusted-device, push, and admission-QR destinations | Fresh iPhone focused/full XCUITest and fresh iPad 3/3 action/state receipts. No QR payload was captured. |

The tablet collection contains 19 images at `780x1440` and two expanded-layout images at `2240x1440`; all 21 SHA-256 digests are unique. The phone ScreenCaptureKit frames are `822x1902`; the tablet desktop captures are `2560x1656`. Every changed image was opened directly. Korean text is intact, touch controls are unobscured, compositing is complete, and there is no clipping, tofu/mojibake, overlay, QR payload, PII, session credential, payment key, push token, or provider secret. The two dimensions in the tablet fixture set reflect the deliberately constrained phone-state viewport and the expanded tablet viewport rather than stale or partial frames.

### Boundaries, scope, and cleanup

- Toss merchant approval/webhook/settlement/refund, App Attest/Play Integrity real-device proof, APNs/FCM delivery, gate scanner/consume, and Kakao channel qualification remain externally blocked by those exact dependencies. None is inferred from a fixture or client state.
- Cancellation continues to say `요청`/review until terminal server state. Public resale and authenticated resale lifecycle remain distinct. No directed transfer or destination/page WebView was added.
- The round-3 product diff is limited to iOS lifecycle destinations/tests and Android customer UI/data/tests. `git diff d4b5ab9 --name-only` contains no protected simple-login path; Google/Kakao/Naver UI, config, OAuth, session, tests, environment, and provider consoles remained read-only.
- Cleanup: both Android emulators were killed and `adb devices` returned empty. The fresh iPad simulator was deleted by the wrapper (`device-cleanup=complete`); no Task 7 simulator, emulator, backend, listener, or xcodebuild process remains.
