# Mobile customer parity matrix

This matrix is the ordered release contract for matching the Ticketground web customer surface with native iOS and Android behavior. A row is repository-complete only when its route, native control, required states, automated check, and phone/tablet manual evidence are all present. Provider qualification is tracked separately and never inferred from repository completion.

## Ordered home contract

| Order | Web control | Web destination | iOS identifier/destination | Android tag/destination | Required states |
| --- | --- | --- | --- | --- | --- |
| 1 | Header/search | `/contents/search` | `header-search` / `.search` | `home-search` / `AppDestination.Search` | ready,error |
| 2 | Category navigation | `/contents/genre/:genre` | `discovery-category-*` / `.genre` | `home-category-*` / `CustomerRoute.Collection` | ready,empty,error |
| 3 | Featured hero | `/goods/:slug` | `discovery-featured-cta` / `.goods` | `home-featured` / `CustomerRoute.Event` | ready,media-fallback |
| 4 | Real-time ranking | `/contents/ranking` | `discovery-ranking-more` / `.ranking` | `home-ranking-more` / `CustomerRoute.Ranking` | ready,empty,error |
| 5 | Ticket-open upcoming | `/open` | `discovery-open-more` / `.open` | `home-open-more` / `CustomerRoute.OpenCalendar` | ready,empty,error |
| 6 | CLEAN ticket | `/resale` | `discovery-resale-pool` / `.resale` | `home-resale-pool` / `CustomerRoute.Resale` | ready,signed-out,error |
| 7 | Genre recommendations | `/contents/genre/:genre` | `discovery-genre-*` / `.genre` | `home-genre-*` / `CustomerRoute.Collection` | ready,empty,error |
| 8 | Editorial collection | `/event/ticketground-day` | `discovery-editorial-*` / `.event` | `home-editorial-*` / `CustomerRoute.Collection` | ready,empty,error |
| 9 | Shortcuts | matching customer route | `shortcut-*` / typed route | `home-shortcut-*` / typed route | ready,empty,error |

The source-level architecture guard is `tests/mobile-home-parity.test.mjs`. It fixes the six web-backed content sections in this order: `실시간 예매 랭킹 TOP10`, `티켓오픈 예정`, `CLEAN 티켓 공식 양도`, `장르별 추천`, `기획전`, `바로가기`. It also rejects `WKWebView`, Compose `AndroidView(WebView)`, and `android.webkit.WebView` substitutions.

## Customer journey contract

Identifiers and typed destinations below are required native contracts. `loading` means that the native navigation shell remains visible; `error` includes a scoped retry. Principal-bound actions must show `signed-out` without changing the protected login implementation.

| Surface | Web source/control | iOS identifier/destination | Android tag/destination | Required data source | Required states | Automated evidence | Manual evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Region discovery | Region control / `/contents/region` | `discovery-region-*` / `.region` | `home-region-all` / `CustomerRoute.Region` | public catalog and region APIs | ready,empty,error | route, filter, and state tests | phone/tablet region selection |
| Venue discovery | Venue control / `/place/:slug` | `discovery-venue-*` / `.place` | `event-venue` / `CustomerRoute.Venue` | public catalog and venue APIs | ready,empty,error | route, detail, and state tests | phone/tablet venue selection |
| Artist discovery | Artist control / `/artist/:slug` | `discovery-artist-*` / `.artist` | `event-artist` / `CustomerRoute.Artist` | public catalog and artist APIs | ready,empty,error | route, detail, and state tests | phone/tablet artist selection |
| Event detail | `/goods/:slug` event tile | `event-detail-*` / `.goods` | `event-detail-*` / `CustomerRoute.Event` | public catalog and performance APIs | loading,ready,empty,error,booking-unavailable | route, state, and event-detail tests | phone/tablet event selection |
| Seat selection | `/booking/:slug` seat entry | `seat-map` / `.seatMap` | `seat-map` / `CustomerRoute.SeatMapRoute` | seat snapshot API | loading,ready,empty,error,stale,seat-unavailable | route, seat-map, and stale-contract tests | phone/tablet graphical seat taps |
| Queue, hold, and draft | `/queue/:slug` then `/booking/:slug` | `booking-progress` / `.queue` then `.booking` | `booking-progress` / `CustomerRoute.Booking` | queue, hold, and reservation-draft APIs | pending,admitted,expired,seat-conflict,error,retry | queue, hold, draft, and idempotency tests | queue admit, expiry, and retry |
| Toss handoff | `/checkout/:slug` | `toss-checkout` / `.checkout` | `toss-checkout` / `CustomerRoute.Checkout` | reservation draft and Toss handoff contract | ready,submitting,provider-unavailable,cancelled,error | duplicate-submit and payment handoff tests | provider transition and safe native return |
| Watchlist | `/watchlist` and detail toggle | `watchlist` / `.watchlist` | `watchlist` / `AppDestination.Watchlist` | principal watchlist API | loading,ready,empty,signed-out,error,retry | route, mutation, rollback, and idempotency tests | add/remove and signed-out entry |
| Reservation detail | `/reservation/:id` | `reservation-detail` / `.reservation` | `reservation-detail` / `CustomerRoute.Reservation` | principal reservation API | loading,ready,signed-out,not-found,error | ownership and detail-state tests | owned reservation and denied access |
| Cancellation | `/cancel?reservation=:id` | `cancellation-request` / `.cancel` | `cancellation-request` / `CustomerRoute.Cancellation` | cancellation-request API | loading,ready,submitting,requested,signed-out,ineligible,error | authorization, idempotency, and request-state tests | request without refund-complete claim |
| Official resale lifecycle | `/resale`, `/resale/:poolId`, `/mypage/resale` | `resale-lifecycle` / `.resale` | `resale-lifecycle` / `CustomerRoute.ResaleLifecycle` | resale pool, listing, purchase, and cancel APIs | loading,ready,empty,signed-out,ineligible,submitting,error | list, buy, cancel, ownership, and idempotency tests | pool browse, list, buy, and cancel |
| Trusted device | account trusted-device control | `trusted-device` / `.mypage` | `trusted-device` / `CustomerRoute.TrustedDevice` | device challenge/proof API | loading,ready,untrusted,registering,revoked,signed-out,error | challenge, proof, revoke, and authorization tests | simulator/emulator repository flow |
| Push | account notification control | `push-notifications` / `.mypage` | `push-notifications` / `CustomerRoute.PushNotifications` | push-token registration API | loading,enabled,disabled,permission-denied,signed-out,error | token register/revoke and redaction tests | permission and toggle states |
| Admission QR | reservation admission control | `admission-qr` / `.reservation` | `admission-qr` / `CustomerRoute.Reservation` | short-lived admission QR API | loading,ready,expired,used,cancelled,offline,signed-out,error | expiry, rotation, consume, and redaction tests | QR state transitions without payload capture |
| Help | `/help` | `support-help` / `.help` | `support-help` / `CustomerRoute.Support` | public support API | loading,ready,empty,error,retry | route and support state tests | search FAQ and notice links |
| Inquiry | `/inquiry` and `/support/inquiry` | `support-inquiry` / `.inquiry` | `support-inquiry` / `CustomerRoute.Inquiry` | principal inquiry API | loading,ready,empty,signed-out,submitting,error | ownership, submit, and error tests | native inquiry history and submit |

Directed person-to-person transfer is excluded by product policy and is not a parity row.

## Task 7 repository status (2026-08-17)

The non-home audit is recorded in `.superpowers/sdd/2026-08-16-mobile-web-parity/task-7-report.md`. Search, calendar, genre, editorial, event detail, seat map, Toss handoff, watchlist, help, and the platform rows not listed below retained their earlier repository-complete status. Task 7 closed these proven route/evidence gaps:

| Surface | iOS repository status | Android repository status | Task 7 evidence |
| --- | --- | --- | --- |
| Ranking | implemented | implemented | Android repository-backed `CustomerRoute.Ranking`; loading/ready/empty/error/retry behavior checks |
| Region | implemented | implemented | canonical `discovery-region-*`; Android region API-backed `CustomerRoute.Region` with retry |
| Venue | implemented | implemented | typed venue destinations on both platforms; Android repository filtering and async states |
| Artist | implemented | implemented | typed artist destinations on both platforms; Android artist API boundary and async states |
| Queue, hold, and draft | implemented | implemented | Android `CustomerRoute.Booking` exposes waiting, server-confirmed hold/draft, expired, conflict, error, and retry without an optimistic success claim |
| Reservation detail | implemented | implemented | Android independent `reservation-detail` principal surface with authenticated and signed-out behavior |
| Cancellation request | implemented | implemented | Android independent `cancellation-request`; UI continues to say `요청` until terminal server state |
| Official resale lifecycle | implemented | implemented | Android independent account lifecycle surface remains separate from the public resale pool |
| Trusted device | implemented | implemented | independent typed surfaces on both platforms; real attestation externally blocked |
| Push | implemented | implemented | independent typed surfaces on both platforms; real delivery externally blocked |
| Admission QR | implemented | implemented | independent iOS typed subdestination with legacy mutation identifiers; real consume externally blocked |
| Inquiry | implemented | implemented | Android native signed-out/history/form/error route; Kakao availability externally blocked |

Task 7 verification on the final source: the correctly provisioned iOS unit boundary is 178/178 across the ordinary suite plus its separately provisioned live wrapper, the iOS UI suite executed 86 tests with 2 skipped and 0 failures, and the three corrected lifecycle subdestinations also passed 3/3 on a fresh iPad Simulator. Android fix4 retained receipts under `.superpowers/sdd/2026-08-16-mobile-web-parity/evidence/task7-fix4/`, but those receipts are superseded for final-source Android qualification because they predated the report/matrix correction commit and the retained tablet manual XML did not prove Search -> event detail -> Back restoration. The final Android proof is the exact-SHA fix5 evidence under `.superpowers/sdd/2026-08-16-mobile-web-parity/evidence/task7-fix5/`: JVM 81/81, customer Compose 34/34, installed tablet VisualCapture 21/21, source architecture contract 3/3, and assemble exit 0 must all record the same unchanged commit before and after each invocation. Direct installed-app controls must capture phone error-to-retry-to-ready, ranking, search, event detail, venue, artist, Back, and signed-out My Page hierarchy; tablet direct controls must capture a normal or fixture root, Search/list, an event tap, Event detail, system/app Back, and restored in-app Search/list state. Authenticated reservation, cancellation, official resale lifecycle, trusted device, push, and booking conflict remain local fixture-principal flows reached by in-app taps from My Page/home/seat-map roots in `VisualCaptureTest`, not by target-route injection and not as external-provider success evidence.

## Task 9 final row audit (2026-08-17)

All 25 rows below are implemented at the repository and local Simulator/Emulator level. Task 9 reran the source contract, iOS ordinary/live boundaries, and Android JVM/lint/assemble serially on exact source `44f9ae59874544823ecb7a0683183b7566e82f54`. “Implemented” never means that a provider, real device, production transaction, notification delivery, attestation, scanner consume, or Kakao channel was qualified. The web audit receipt is `.superpowers/sdd/2026-08-16-mobile-web-parity/evidence/task9/receipts/browser-visual-audit.md`; its screenshots remain transient under `/tmp` and are not committed.

### Ordered home rows

| Order / surface | Final status | Exact automated evidence | Exact manual evidence | External qualification |
| --- | --- | --- | --- | --- |
| 1 Header/search | implemented | Task 9 `logs/mobile-home-parity-after-matrix.log` and `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/final-phone-full.xml` and `xml/final-tablet-full.xml` | Live Chrome `IU` result and no-result searches in the Task 9 browser receipt; iOS Task 4 phone/tablet Search action; Android Fix6 `manual-phone/01-home.xml` → `02-search.xml` and tablet equivalents | not required |
| 2 Category navigation | implemented | Task 9 `logs/mobile-home-parity-after-matrix.log` and `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/final-phone-full.xml` and `xml/final-tablet-full.xml` | Live Chrome `/contents/genre/concert`; iOS Task 4 phone/tablet category action and `home-top.png`; Android Fix6 phone home and `09-tablet-expanded-home-parity.png` | not required |
| 3 Featured hero | implemented | Task 9 `logs/mobile-home-parity-after-matrix.log` and `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/final-phone-full.xml` and `xml/final-tablet-full.xml` | Live Chrome `/goods/iu-world-tour`; iOS Task 4 phone/tablet hero action and `home-top.png`; Android Fix6 `visual/22-installed-phone-window.png` and `09-tablet-expanded-home-parity.png` | not required |
| 4 Real-time ranking | implemented | Task 9 `logs/mobile-home-parity-after-matrix.log` and `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/final-phone-full.xml` and `xml/final-tablet-full.xml`; Task 7 Fix5 `logs/android-phone-compose-final.log` | Live Chrome `/contents/ranking`; iOS Task 4 phone/tablet ranking action and `home-top.png`; Android Task 7 Fix5 direct ranking hierarchy recorded by `task-7-report.md` | not required |
| 5 Ticket-open upcoming | implemented | Task 9 `logs/mobile-home-parity-after-matrix.log` and `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/final-phone-full.xml` and `xml/final-tablet-full.xml` | Live Chrome `/open`; iOS Task 4 phone/tablet `opening.png`; Android Fix6 `13-phone-home-opening-resale.png` and tablet expanded home | not required |
| 6 CLEAN ticket public pool | implemented | Task 9 `logs/mobile-home-parity-after-matrix.log` and `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/final-phone-full.xml` and `xml/final-tablet-full.xml` | Live Chrome `/resale`; iOS Task 4 phone/tablet `resale.png` and `signed-out-resale.png`; Android Fix6 `13-phone-home-opening-resale.png` | not required; authenticated resale lifecycle is row 11 below |
| 7 Genre recommendations | implemented | Task 9 `logs/mobile-home-parity-after-matrix.log` and `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/final-phone-full.xml` and `xml/final-tablet-full.xml` | Live Chrome genre event tap; iOS Task 4 phone/tablet `genre.png`; Android Fix6 `14-phone-home-genre-editorial.png` and tablet expanded home | not required |
| 8 Editorial collection | implemented | Task 9 `logs/mobile-home-parity-after-matrix.log` and `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/final-phone-full.xml` and `xml/final-tablet-full.xml` | Live Chrome `/event/ticketground-day`; iOS Task 4 phone/tablet `editorial.png`; Android Fix6 `14-phone-home-genre-editorial.png` | not required |
| 9 Shortcuts | implemented | Task 9 `logs/mobile-home-parity-after-matrix.log` and `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/final-phone-full.xml` and `xml/final-tablet-full.xml` | Live Chrome Region and Search shortcuts; iOS Task 4 phone/tablet `shortcuts.png`; Android Fix6 `15-phone-home-shortcuts.png` | not required |

The live web ready and search-empty states were directly observed. Web loading/error were not safely inducible through the public fixture, so they are supported only by the exact automated suites and the iOS Task 4 `loading.png`/`error.png` plus Android Fix6 `10-state-loading.png`/`12-state-error-retry.png`; no live-browser observation is claimed for those two states. Every iOS canonical screenshot hash was rechecked against the 20-file Task 4 table, and every Android final screenshot hash was rechecked against Task 8 Fix6 `hashes/visual-22.sha256`.

### Customer journey rows

| # / surface | Final status | Exact automated evidence | Exact manual evidence | External qualification |
| --- | --- | --- | --- | --- |
| 1 Region discovery | implemented | iOS Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/final-phone-full.xml`, `xml/final-tablet-full.xml`, and `xml/TEST-kr.ticketground.app.ui.CustomerAppViewModelTest.xml` | Live Chrome Region shortcut to `/contents/region`; Task 7 exact-SHA direct phone/tablet receipt in `task-7-report.md` | not required |
| 2 Venue discovery | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/final-phone-full.xml`, `xml/final-tablet-full.xml`; Task 7 Fix5 `logs/android-phone-compose-final.log` | Task 7 Fix5 direct phone Event → Venue hierarchy and tablet Event detail at `manual-tablet/04-event-detail.xml` | not required |
| 3 Artist discovery | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/final-phone-full.xml`, `xml/final-tablet-full.xml`; Task 7 Fix5 `logs/android-phone-compose-final.log` | Task 7 Fix5 direct phone Event → Artist hierarchy and tablet Event detail at `manual-tablet/04-event-detail.xml` | not required |
| 4 Event detail | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/final-phone-full.xml` and `xml/final-tablet-full.xml` | Live Chrome hero to `/goods/iu-world-tour`; Task 7 Fix5 tablet Search → `manual-tablet/08-event-detail-repeat.xml` → Back-restored `09-back-restored-search-list-repeat.xml`; Android Fix6 `02-phone-event-detail.png` | not required |
| 5 Seat selection | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/TEST-kr.ticketground.app.ui.SeatMapPresentationTest.xml`, `xml/final-phone-full.xml`, and `xml/final-tablet-full.xml` | iOS Task 4 phone/tablet action coverage; Android Fix6 `03-phone-seat-map-selected-held-sold.png` | not required |
| 6 Queue, hold, and draft | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/TEST-kr.ticketground.app.data.LifecycleApiWireTest.xml`, `xml/TEST-kr.ticketground.app.data.LifecyclePolicyTest.xml`, and connected XML | Task 7 installed fixture flow; Android Fix6 `21-tablet-booking-conflict.png` | not required |
| 7 Toss handoff | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/TEST-kr.ticketground.app.data.TossCheckoutTest.xml` and `xml/TEST-kr.ticketground.app.data.TossPaymentApiWireTest.xml` | Safe unavailable/return fixture in Task 7; Android Fix6 `08-phone-toss-blocked.png` | externally-blocked — merchant credentials, approval/webhook, settlement/refund, and production transaction |
| 8 Watchlist | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/TEST-kr.ticketground.app.data.AccountApiWireTest.xml`, `xml/final-phone-full.xml`, and `xml/final-tablet-full.xml` | Task 7 phone/tablet signed-out/account flow; Android Fix6 `04-phone-watchlist.png` | not required for repository behavior; real account data was not production-qualified |
| 9 Reservation detail | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/TEST-kr.ticketground.app.data.AccountApiWireTest.xml`, `xml/TEST-kr.ticketground.app.data.LifecycleApiWireTest.xml`, and connected XML | Task 7 installed fixture-principal flow; Android Fix6 `16-phone-reservation-detail.png` | not required for repository behavior; real account data was not production-qualified |
| 10 Cancellation | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/TEST-kr.ticketground.app.data.AccountApiWireTest.xml`, `xml/TEST-kr.ticketground.app.data.LifecyclePolicyTest.xml`, and connected XML | Task 7 installed fixture-principal flow; Android Fix6 `17-phone-cancellation-request.png`, which retains request-not-refund-complete wording | not required for repository behavior; no refund success claimed |
| 11 Official resale lifecycle | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/TEST-kr.ticketground.app.data.AccountApiWireTest.xml`, `xml/TEST-kr.ticketground.app.data.LifecyclePolicyTest.xml`, and connected XML | Task 7 installed fixture-principal flow; Android Fix6 `18-phone-account-resale.png`; kept distinct from public home resale row | not required for repository behavior; no production list/buy/cancel claimed |
| 12 Trusted device | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/TEST-kr.ticketground.app.data.GateApiWireTest.xml`, `xml/TEST-kr.ticketground.app.data.PlatformBoundaryTest.xml`, and connected XML | Task 7 local simulator/emulator fixture; Android Fix6 `19-phone-trusted-device.png` | externally-blocked — Apple App Attest/Play Integrity credentials and real-device attestation |
| 13 Push | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/TEST-kr.ticketground.app.data.AccountApiWireTest.xml`, `xml/TEST-kr.ticketground.app.data.PlatformBoundaryTest.xml`, and connected XML | Task 7 permission/toggle fixture; Android Fix6 `20-phone-push-notifications.png` | externally-blocked — APNs/FCM credentials, real device, and delivered notification receipt |
| 14 Admission QR | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/TEST-kr.ticketground.app.gate.GateVerificationTest.xml`, `xml/TEST-kr.ticketground.app.data.GateApiWireTest.xml`, and connected XML | Task 7 local transition flow; Android Fix6 `07-phone-lifecycle-qr.png` without QR payload capture | externally-blocked — gate keys, physical scanner hardware, and one-time consume evidence |
| 15 Help | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/TEST-kr.ticketground.app.ui.CustomerAppViewModelTest.xml`, `xml/final-phone-full.xml`, and `xml/final-tablet-full.xml` | Task 7 native FAQ/notice flow; Android Fix6 `05-phone-support.png` | not required |
| 16 Inquiry | implemented | Task 9 `ios-ordinary/xcodebuild.log`; Android Task 8 Fix6 `xml/TEST-kr.ticketground.app.data.AccountApiWireTest.xml`, `xml/final-phone-full.xml`, and `xml/final-tablet-full.xml` | Task 7 native signed-out/history/form/error flow; Android Fix6 `05-phone-support.png` | externally-blocked — Kakao channel availability and provider-console qualification |

Final totals: **25/25 rows repository/local implemented**, **25/25 with exact automated evidence**, and **25/25 with exact manual evidence**. Five rows retain exact external gates: Toss, Trusted device, Push, Admission QR, and Inquiry. GitHub delivery and production/provider qualification were not performed by this local audit.

## External-provider qualification gates

Repository-complete native behavior and external qualification are independent release statuses.

| Capability | Repository-complete requirement | External qualification gate |
| --- | --- | --- |
| Toss Payments | Typed handoff, duplicate-submit prevention, provider-unavailable state, cancellation, and safe native return | Merchant credentials, approval/webhook behavior, settlement, refund, and production transaction evidence |
| Push | Permission states plus token registration/revocation without token disclosure | APNs and FCM credentials, real-device receipt, and production delivery evidence |
| Trusted device | Challenge/proof/revoke states that fail closed | Apple App Attest and Play Integrity credentials with real-device attestation evidence |
| Admission QR | Short-lived rotation, expiry, cancellation, offline, and used states without payload disclosure | Gate keys, physical scanner hardware, and one-time consume evidence |
| Kakao inquiry | Labelled external transition and safe return to originating native state | Kakao channel availability and provider-console qualification |

An unavailable external gate must show the named capability as unavailable and must not claim payment, refund, trust, delivery, admission, or inquiry success.

## Protected simple-login boundary

`.github/scripts/ticketground-bot.cjs` defines `PROTECTED_AUTH_PATTERNS`. The following matched paths remain read-only for every parity task:

- `.env*`
- `간편로그인-수정금지-지침.md`
- `src/app/api/auth/**`
- `src/app/auth/google-config/route.ts` and `src/app/auth/social-config/route.ts`
- `src/components/ticketing/google-sign-in-card.tsx`, `login-panel.tsx`, `login-session-panel.tsx`, and `social-login-buttons.tsx`
- `src/lib/auth*`, `src/lib/google*`, `src/lib/oauth*`, and `src/lib/social-auth*`
- `backend/social-oauth.js` and `backend/social-oauth-config.js`
- `tests/auth-preview-host-boundary*`, `tests/google-auth*`, `tests/social-auth*`, and `tests/social-login*`
- `server.js`, `backend/admin.js`, and `backend/admin-acl.js`

Signed-out parity uses the existing login entry only. No parity task may modify Google, Kakao, or Naver login UI, configuration, OAuth start/callback/session behavior, tests, environment variables, or provider consoles.

## Release checklist

For every row above, record the evidence against the same build and commit:

- [x] Web control and resulting destination/state rechecked; live loading/error remain explicitly limited to automated/native evidence.
- [x] iOS automated route/state checks pass.
- [x] iPhone and iPad installed fixture actions cover the corrected typed lifecycle destinations; provider-dependent outcomes remain explicitly unavailable.
- [x] Android automated route/state checks pass.
- [x] Android phone and tablet actions tapped, with authenticated lifecycle states exercised through installed fixture surfaces and external-provider results left unqualified.
- [x] Touch targets meet 44 points on iOS and 48 dp on Android; Korean copy is not clipped in the final phone/tablet evidence.
- [x] No WebView substitution, secret, session credential, personal data, payment key, push token, or QR payload appears in evidence.
- [x] External-provider gates remain explicitly unqualified until real credential/device/hardware evidence exists.
- [x] Local checks and Simulator/Emulator qualification are reported separately from unperformed GitHub delivery and production/provider qualification.
