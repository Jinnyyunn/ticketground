# Ticketground mobile web parity design

## Context and goal

The Ticketground web customer surface is the product reference for the native iOS and Android applications. The current native homes include the shared header, category shortcuts, hero, ranking, and a subset of shortcuts, but omit customer-facing sections and destinations visible on the web home.

The goal is to make the native applications expose the same customer capabilities, content hierarchy, and intended actions as the web while using platform-native SwiftUI and Jetpack Compose components. The result must remain a native application rather than a WebView wrapper.

## Approved scope

Included customer surfaces:

- Home discovery and its full section order.
- Category, search, ranking, ticket-open calendar, genre recommendation, region, venue, artist, and editorial discovery.
- Event detail, graphical seat selection, queue, hold, reservation draft, and Toss Payments handoff.
- Watchlist, reservations, official resale, cancellation request, trusted device, admission QR, notifications, help, and inquiry.
- Loading, empty, error, signed-out, unavailable-provider, and retry states for each destination.
- Phone and tablet layouts for iOS and Android.

Excluded surfaces:

- Web admin, console, seller operations, company information, terms, and privacy pages.
- Directed person-to-person transfer, which remains blocked by product policy.
- Production qualification for APNs, FCM, Apple App Attest, Play Integrity, Toss merchant settlement, and physical gate hardware without provider credentials or real-device evidence.
- Any change to the protected Google, Kakao, or Naver simple-login UI, configuration, OAuth start/callback/session implementation, tests, environment variables, or provider consoles.

## Reference contract

The live web customer experience at `https://dev.ticketground.co.kr` is the behavioral and visual reference. The supplied screenshot specifically establishes the desktop home treatment for:

1. `티켓오픈 예정`
2. `CLEAN 티켓 공식 양도`
3. `장르별 추천`
4. The following editorial and shortcut content in the same home sequence

Native layouts must preserve the web information hierarchy, copy, imagery, destination, and state semantics while adapting geometry to platform conventions and touch targets. Pixel identity with the desktop viewport is not required; recognizable section anatomy, token fidelity, and action parity are required.

## Parity architecture

### Shared parity matrix

Add a versioned customer parity matrix under `docs/research/` that records every included web destination and interactive action. Each row must contain:

- Web source route and control.
- iOS destination and accessibility identifier.
- Android destination and test tag/content description.
- Required data source.
- Loading, empty, error, authentication, and unsupported states.
- Automated test and manual QA evidence.

The matrix is the release checklist and prevents a visually plausible home from hiding missing destinations.

### Data contracts

The native applications must consume the existing versioned public and principal-bound APIs. Home composition derives from catalog, open-calendar, support, watchlist, and lifecycle contracts. Static web-only presentation metadata may be represented by typed native configuration only when no public API field exists; it must reference real catalog identifiers and must not duplicate security-sensitive or transactional state.

No native client may infer ticket ownership, refund completion, trusted-device status, admission authorization, or payment success. Those states remain server-authoritative.

### Navigation contracts

iOS continues to use `AppRoute` and `NavigationStack`. Android extends its typed customer route model instead of opening web pages for missing native destinations. Every web home control maps to a native route:

- Ticket-open card and `더보기` -> ticket-open calendar, then event detail.
- CLEAN ticket card and `공식 풀 보기` -> official resale browser.
- Genre tab and tile -> filtered genre collection, then event detail.
- Editorial card -> curated event collection.
- Shortcut -> its matching search, region, ranking, resale, calendar, or same-day collection.

External Kakao inquiry and payment-provider handoffs remain explicit external transitions. Navigation must return to the originating native state safely.

## Home composition

Both applications must render this ordered customer home:

1. Brand header, login entry, menu, and search.
2. Category navigation.
3. Featured hero.
4. Real-time ranking.
5. Ticket-open upcoming cards with `더보기`.
6. CLEAN ticket official resale introduction and three safety controls.
7. Genre recommendation tabs and ranked tiles.
8. Editorial collection cards.
9. Customer shortcuts.

Sections use existing Ticketground color, typography, spacing, radius, media, and state primitives. New reusable primitives must be added to the platform token/component layers rather than hardcoded in the home screen.

### Responsive behavior

- Phone: one vertical scroll surface; horizontally scrollable ranking and genre tiles; no clipped text or nested vertical scrolling.
- Tablet: wider cards and multi-column content while preserving the same section order and actions.
- Touch targets must be at least 44 points on iOS and 48 dp on Android.
- Korean headings and labels must avoid orphaned syllables, clipped baselines, and fixed-height truncation.

## Destination behavior

### Discovery

Search, category, ranking, calendar, genre, region, venue, artist, editorial, and event detail screens must expose the same meaningful filters and links as the customer web. Selecting an event always reaches a native detail screen. Event detail must provide schedule selection, watchlist action, seat availability, and booking entry when supported.

### Booking and payment

The existing queue -> hold -> reservation draft -> Toss checkout sequence remains the only booking path. The UI must show pending, admitted, expired, unavailable-seat, confirmation, cancellation, and provider-unavailable states. Duplicate submission prevention and idempotency remain mandatory.

### Account and lifecycle

The account surface must include owned-ticket detail, cancellation request, official resale listing/purchase/cancel where the backend permits it, trusted-device state, push registration, and admission QR. A cancellation request must never be presented as a completed refund.

### Support

Help, notices, FAQ, and inquiry destinations remain native where repository APIs exist. Kakao chat is an explicit external support action. External navigation must be labeled before leaving the app.

## Error and security behavior

- Public discovery failure: retain navigation shell and offer a scoped retry.
- Empty collection: explain why it is empty and provide a useful next destination.
- Signed-out principal action: show the existing login entry without changing protected login code.
- Provider unavailable: fail closed and state which capability is unavailable without claiming success.
- Stale or incompatible API contract: stop the transaction and prompt refresh/update.
- Payment, resale, cancellation, device, push, and QR mutations must retain current authorization and idempotency boundaries.
- Secrets, session credentials, personal data, payment keys, and QR payloads must not appear in logs, screenshots, fixtures, or parity evidence.

## Verification design

### Automated checks

- Focused iOS unit tests for home composition, route mapping, state presentation, and lifecycle behavior.
- Focused iOS UI tests that tap every parity-matrix action on phone and tablet destinations.
- Focused Android unit and Compose UI tests for the same routes, states, and responsive layouts.
- Existing API-contract, booking, payment, lifecycle, and protected-auth tests must remain green.
- Web checks confirm the reference routes and actions still resolve as recorded in the parity matrix.

### Manual QA

Heavy verification runs serially:

1. Drive the live web controls and record their resulting destination/state.
2. Build and install iOS, then tap each corresponding action on an iPhone Simulator and an iPad Simulator.
3. Stop heavy iOS verification, build and install Android, then tap each action on phone and tablet emulators.
4. Capture fresh screenshots for all changed home sections and major destination states.
5. Run independent visual and functional review against the same build.
6. Fix and repeat until no blocking parity or visual finding remains.

At handoff, launch the final iOS phone build and Android phone build and leave both Simulator/Emulator windows open for user inspection.

## Delivery

Implementation ships on a dedicated branch through a pull request. Local tests, Simulator/Emulator qualification, GitHub review/CI/merge, and production/provider qualification are reported as separate completion levels. The pull request must not contain protected simple-login changes or unrelated product work.
