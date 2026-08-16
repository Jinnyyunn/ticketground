# Mobile customer parity matrix

This matrix is the ordered release contract for matching the Ticketground web customer surface with native iOS and Android behavior. A row is repository-complete only when its route, native control, required states, automated check, and phone/tablet manual evidence are all present. Provider qualification is tracked separately and never inferred from repository completion.

## Ordered home contract

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

The source-level architecture guard is `tests/mobile-home-parity.test.mjs`. It fixes the six web-backed content sections in this order: `실시간 예매 랭킹 TOP10`, `티켓오픈 예정`, `CLEAN 티켓 공식 양도`, `장르별 추천`, `기획전`, `바로가기`. It also rejects `WKWebView`, Compose `AndroidView(WebView)`, and `android.webkit.WebView` substitutions.

## Customer journey contract

Identifiers and typed destinations below are required native contracts. `loading` means that the native navigation shell remains visible; `error` includes a scoped retry. Principal-bound actions must show `signed-out` without changing the protected login implementation.

| Surface | Web source/control | iOS identifier/destination | Android tag/destination | Required data source | Required states | Automated evidence | Manual evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Region discovery | Region control / `/contents/region` | `discovery-region-*` / `.region` | `home-region-*` / `CustomerRoute.Collection` | public catalog and region APIs | ready,empty,error | route, filter, and state tests | phone/tablet region selection |
| Venue discovery | Venue control / `/place/:slug` | `discovery-venue-*` / `.place` | `home-venue-*` / `CustomerRoute.Venue` | public catalog and venue APIs | ready,empty,error | route, detail, and state tests | phone/tablet venue selection |
| Artist discovery | Artist control / `/artist/:slug` | `discovery-artist-*` / `.artist` | `home-artist-*` / `CustomerRoute.Artist` | public catalog and artist APIs | ready,empty,error | route, detail, and state tests | phone/tablet artist selection |
| Event detail | `/goods/:slug` event tile | `event-detail-*` / `.goods` | `event-detail-*` / `CustomerRoute.Event` | public catalog and performance APIs | loading,ready,empty,error,booking-unavailable | route, state, and event-detail tests | phone/tablet event selection |
| Seat selection | `/booking/:slug` seat entry | `seat-map` / `.seatMap` | `seat-map` / `CustomerRoute.SeatMap` | seat snapshot API | loading,ready,empty,error,stale,seat-unavailable | route, seat-map, and stale-contract tests | phone/tablet graphical seat taps |
| Queue, hold, and draft | `/queue/:slug` then `/booking/:slug` | `booking-progress` / `.queue` then `.booking` | `booking-progress` / `CustomerRoute.Booking` | queue, hold, and reservation-draft APIs | pending,admitted,expired,seat-conflict,error,retry | queue, hold, draft, and idempotency tests | queue admit, expiry, and retry |
| Toss handoff | `/checkout/:slug` | `toss-checkout` / `.checkout` | `toss-checkout` / `CustomerRoute.Checkout` | reservation draft and Toss handoff contract | ready,submitting,provider-unavailable,cancelled,error | duplicate-submit and payment handoff tests | provider transition and safe native return |
| Watchlist | `/watchlist` and detail toggle | `watchlist` / `.watchlist` | `watchlist` / `AppDestination.Watchlist` | principal watchlist API | loading,ready,empty,signed-out,error,retry | route, mutation, rollback, and idempotency tests | add/remove and signed-out entry |
| Reservation detail | `/reservation/:id` | `reservation-detail` / `.reservation` | `reservation-detail` / `CustomerRoute.Reservation` | principal reservation API | loading,ready,signed-out,not-found,error | ownership and detail-state tests | owned reservation and denied access |
| Cancellation | `/cancel?reservation=:id` | `cancellation-request` / `.cancel` | `cancellation-request` / `CustomerRoute.Cancellation` | cancellation-request API | loading,ready,submitting,requested,signed-out,ineligible,error | authorization, idempotency, and request-state tests | request without refund-complete claim |
| Official resale lifecycle | `/resale`, `/resale/:poolId`, `/mypage/resale` | `resale-lifecycle` / `.resale` | `resale-lifecycle` / `CustomerRoute.Resale` | resale pool, listing, purchase, and cancel APIs | loading,ready,empty,signed-out,ineligible,submitting,error | list, buy, cancel, ownership, and idempotency tests | pool browse, list, buy, and cancel |
| Trusted device | account trusted-device control | `trusted-device` / `.mypage` | `trusted-device` / `CustomerRoute.TrustedDevice` | device challenge/proof API | loading,ready,untrusted,registering,revoked,signed-out,error | challenge, proof, revoke, and authorization tests | simulator/emulator repository flow |
| Push | account notification control | `push-notifications` / `.mypage` | `push-notifications` / `CustomerRoute.PushNotifications` | push-token registration API | loading,enabled,disabled,permission-denied,signed-out,error | token register/revoke and redaction tests | permission and toggle states |
| Admission QR | reservation admission control | `admission-qr` / `.reservation` | `admission-qr` / `CustomerRoute.AdmissionQr` | short-lived admission QR API | loading,ready,expired,used,cancelled,offline,signed-out,error | expiry, rotation, consume, and redaction tests | QR state transitions without payload capture |
| Help | `/help` | `support-help` / `.help` | `support-help` / `CustomerRoute.Support` | public support API | loading,ready,empty,error,retry | route and support state tests | search FAQ and notice links |
| Inquiry | `/inquiry` and `/support/inquiry` | `support-inquiry` / `.inquiry` | `support-inquiry` / `CustomerRoute.Inquiry` | principal inquiry API | loading,ready,empty,signed-out,submitting,error | ownership, submit, and error tests | native inquiry history and submit |

Directed person-to-person transfer is excluded by product policy and is not a parity row.

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

- [ ] Web control and resulting destination/state rechecked.
- [ ] iOS automated route/state checks pass.
- [ ] iPhone and iPad actions tapped; loading, empty, error, authentication, and unavailable-provider states captured as applicable.
- [ ] Android automated route/state checks pass.
- [ ] Android phone and tablet actions tapped with the same state coverage.
- [ ] Touch targets meet 44 points on iOS and 48 dp on Android; Korean copy is not clipped.
- [ ] No WebView substitution, secret, session credential, personal data, payment key, push token, or QR payload appears in evidence.
- [ ] External-provider gates remain explicitly unqualified until real credential/device/hardware evidence exists.
- [ ] Local checks, Simulator/Emulator qualification, GitHub CI/review/merge, and production/provider qualification are reported as separate completion levels.
