# Open Issues Simulator Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete and simulator-qualify the repository-controlled work for issues #99, #100, #101, #102, #106, #107, and #108 while excluding external payment-provider integrations.

**Architecture:** Add principal-owned `/api/me/*` contracts and a durable idempotency layer on the existing disk-backed backend, then connect focused Swift feature views through the existing HTTPS-only `APIClient`. Verify each feature with Node integration tests, XCTest/XCUITest on the booted iPhone 17 Pro simulator, and a temporary Cloudflare HTTPS tunnel.

**Tech Stack:** Node.js 24 ESM, disk-backed JSON persistence, `node:test`, Swift 6, SwiftUI, XCTest/XCUITest, Xcode 26.6 iOS 26.5 simulator, Cloudflare Quick Tunnel.

## Global Constraints

- Do not modify the protected files listed in `간편로그인-수정금지-지침.md` or change real-provider-first localhost behavior.
- Never log, persist in plaintext, commit, screenshot, or post bearer credentials, QR secrets, APNs keys, provider secrets, or tunnel process metadata.
- Use the existing `nativeSessions` credential hash as the only consumer principal source.
- Reject credential-bearing HTTP requests in the iOS client; use a temporary Cloudflare HTTPS origin for simulator E2E.
- Require durable idempotency for every included consumer mutation and return `409 IDEMPOTENCY_CONFLICT` for same-key/different-payload reuse.
- Keep build, full tests, simulator execution, and browser work serial to protect host memory.
- Do not implement or claim Bootpay/PSP payment approval, webhook, receipt, refund, or settlement (#103 and payment-bound #104).
- Do not implement or claim external provider qualification (#105).
- Preserve current disabled/unsupported presentation for every excluded mutation.
- Do not commit or push unless the repository owner gives a separate explicit Git instruction.

---

### Task 1: Native-session principal and durable idempotency foundation

**Files:**
- Create: `backend/request-principal.js`
- Create: `backend/idempotency.js`
- Modify: `backend/native-session.js`
- Modify: `backend/catalog-persistence.js`
- Modify: `backend/app.js`
- Modify: `backend/api-router.js`
- Test: `tests/native-principal-idempotency.test.mjs`

**Interfaces:**
- Produces `nativeSessionPrincipal(db, req): { userId: string }` from the existing bearer credential.
- Produces `executeIdempotent(db, { actorId, operation, key, payload }, mutate)` returning the first stored response or throwing `IDEMPOTENCY_CONFLICT`.
- Adds `db.idempotencyRecords` normalization; records contain `actorId`, `operation`, `keyHash`, `requestHash`, `response`, and `createdAt`.

- [ ] Write a failing integration test that obtains a native credential through the existing Google native test flow, proves missing/invalid/revoked credentials return `401`, and proves a body `userId` cannot replace the bearer principal.
- [ ] Add failing restart and parallel-request tests showing same-key/same-payload returns one mutation result, same-key/different-payload returns `409`, and the result survives server restart.
- [ ] Run `NODE_ENV=production node --test --test-concurrency=1 tests/native-principal-idempotency.test.mjs`; require failures for missing principal/idempotency behavior rather than fixture errors.
- [ ] Extract principal resolution without changing credential issuance, OAuth files, login UI, or logout semantics.
- [ ] Implement hashed-key durable idempotency and database normalization with no raw key persistence.
- [ ] Wire the helpers into `createTicketgroundApp` and `createApiRouter` without changing existing public route behavior yet.
- [ ] Re-run the focused test plus `tests/google-native-session.test.mjs`, `tests/social-native-handoff.test.mjs`, and `tests/auth-preview-host-boundary.test.mjs`; require all pass.

### Task 2: Issue #99 support contract and native inquiry flow

**Files:**
- Create: `backend/support-contract.js`
- Create: `ios/TicketGroundApp/TicketGroundApp/UI/Support/LiveSupportView.swift`
- Modify: `backend/engagement.js`
- Modify: `backend/api-router.js`
- Modify: `backend/app.js`
- Modify: `backend/catalog-persistence.js`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Models/LiveBackendModels.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Data/LiveBackendService.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj`
- Test: `tests/support-native-contract.test.mjs`
- Test: `ios/TicketGroundApp/TicketGroundAppTests/LiveBackendServiceTests.swift`
- Test: `ios/TicketGroundApp/TicketGroundAppUITests/DiscoveryTests.swift`

**Interfaces:**
- Produces `GET /api/support/v1/public` with `{ version: "1", faqs, notices, categories }` and no authentication.
- Produces principal-owned `GET /api/me/support/threads`, `GET /api/me/support/threads/{threadId}`, `POST /api/me/support/threads`, and `POST /api/me/support/threads/{threadId}/messages`.
- Produces Swift `LiveSupportPublicContent`, `LiveSupportThreadDetail`, and request methods that never include `userId` or `actorId`.

- [ ] Write failing Node tests for public FAQ/notice decoding, unauthenticated rejection, thread ownership, detail 404/403 behavior, duplicate create/reply replay, payload conflict, concurrent retries, and restart durability.
- [ ] Run only `tests/support-native-contract.test.mjs` and confirm the new routes fail with 404.
- [ ] Implement the versioned public DTO and principal-owned support routes using Task 1 idempotency.
- [ ] Re-run the support tests and existing `tests/backend-api-flow.test.mjs` plus support selections in `tests/booking-admin-flow.test.mjs`.
- [ ] Write failing XCTest cases for the exact `/api/me/support/*` request shapes, response decoding, and error mapping; write XCUITest cases for public help, login-required inquiry, empty, list/detail, composing, disabled-while-sending, retry, and failure states.
- [ ] Implement `LiveSupportView` and route `.help`/`.inquiry` to it while preserving existing Ticketground tokens and stable accessibility identifiers.
- [ ] Run the focused XCTest and XCUITest selection on iPhone 17 Pro and require all states pass.

### Task 3: Issue #100 principal-owned account and reservation history

**Files:**
- Create: `backend/account-contract.js`
- Create: `ios/TicketGroundApp/TicketGroundApp/UI/Account/LiveAccountView.swift`
- Modify: `backend/api-router.js`
- Modify: `backend/app.js`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Models/LiveBackendModels.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Data/LiveBackendService.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj`
- Test: `tests/account-native-contract.test.mjs`
- Test: `ios/TicketGroundApp/TicketGroundAppTests/LiveBackendServiceTests.swift`
- Test: `ios/TicketGroundApp/TicketGroundAppUITests/DiscoveryTests.swift`

**Interfaces:**
- Produces `GET /api/me/profile`, `PATCH /api/me/profile`, `GET /api/me/reservations`, and `GET /api/me/reservations/{ticketId}`.
- Profile mutation accepts `{ name }` only and uses `Idempotency-Key`; reservation DTOs omit QR secrets and unrelated users.

- [ ] Write failing Node tests for unauthenticated denial, profile read/update, invalid names, IDOR attempts, only-current-user reservations, empty history, restart persistence, and PII/QR-secret omission.
- [ ] Verify red, implement the minimal account module and routes, then require the new tests and `tests/google-native-session.test.mjs` to pass.
- [ ] Write failing XCTest/XCUITest coverage for profile display/edit/save failure, session expiry, owner mismatch rejection, empty reservations, reservation detail, and logout returning to login-required state.
- [ ] Implement the focused account view and service methods without modifying simple-login components.
- [ ] Run focused native tests and inspect the simulator account and reservation screens for Korean truncation and action reachability.

### Task 4: Issue #101 watchlist and notification preference synchronization

**Files:**
- Create: `ios/TicketGroundApp/TicketGroundApp/UI/Watchlist/LiveWatchlistView.swift`
- Modify: `backend/engagement.js`
- Modify: `backend/api-router.js`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Models/LiveBackendModels.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Data/LiveBackendService.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj`
- Test: `tests/watchlist-native-contract.test.mjs`
- Test: `ios/TicketGroundApp/TicketGroundAppTests/LiveBackendServiceTests.swift`
- Test: `ios/TicketGroundApp/TicketGroundAppUITests/DiscoveryTests.swift`

**Interfaces:**
- Produces principal-owned `GET /api/me/watchlist`, `PUT /api/me/watchlist/{eventId}`, `DELETE /api/me/watchlist/{eventId}`, and `PUT /api/me/watchlist/{eventId}/notification`.
- Mutation response always returns the authoritative current item or `{ removed: true, eventId }`.

- [ ] Write failing Node tests for cross-user isolation, add/remove replay, same-key conflict, duplicate concurrency, notification disable cancelling pending jobs, and restart persistence.
- [ ] Verify red, implement the principal routes using existing engagement rules plus Task 1 idempotency, and run the new and existing watchlist tests.
- [ ] Write failing XCTest/XCUITest coverage for add/remove, notification toggle, duplicate tap suppression, optimistic failure rollback, empty state, relaunch reconciliation, and login-required behavior.
- [ ] Implement the focused watchlist view, reconcile every mutation from its server response, and display separate notification-preference and delivery-availability states.
- [ ] Run focused native tests and simulator QA.

### Task 5: Issue #102 queue, seat hold, and reservation draft state machine

**Files:**
- Create: `backend/booking-session.js`
- Create: `ios/TicketGroundApp/TicketGroundApp/UI/Booking/LiveBookingSessionView.swift`
- Modify: `backend/catalog-persistence.js`
- Modify: `backend/api-router.js`
- Modify: `backend/app.js`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Models/LiveBackendModels.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Data/LiveBackendService.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj`
- Test: `tests/booking-session-contract.test.mjs`
- Test: `ios/TicketGroundApp/TicketGroundAppTests/LiveBackendServiceTests.swift`
- Test: `ios/TicketGroundApp/TicketGroundAppUITests/DiscoveryTests.swift`

**Interfaces:**
- Adds `db.bookingQueues`, `db.seatHolds`, and `db.reservationDrafts` normalization.
- Produces `POST /api/me/booking/queues`, `GET /api/me/booking/queues/{queueId}`, revisioned `GET /api/me/booking/events/{eventId}/performances/{performanceId}/seats`, hold create/renew/release routes, and reservation draft create/read routes.
- Holds include `expiresAt` and inventory `revision`; drafts reference an active principal-owned hold and never mark seats paid or booked.

- [ ] Write failing Node tests for queue expiry, revision mismatch, two-user seat contention, idempotent hold creation, hold renew/release, automatic expiry, reconnect, principal ownership, draft creation, and parallel acquisition with one winner.
- [ ] Verify red, implement one explicit transition table in `booking-session.js`, and require all new backend tests to pass serially.
- [ ] Write failing native tests for queue polling, revision refresh, selectable/held/unavailable seats, countdown expiry, reconnect, conflict presentation, draft summary, and absence of any payment-complete state.
- [ ] Implement the booking-session view and wire it from the existing seat/detail flow while keeping checkout/payment disabled.
- [ ] Run simulator scenarios for success, contention, expiry, reconnect, and duplicate tap; capture each visible state.

### Task 6: Issue #106 simulator device trust and push lifecycle

**Files:**
- Create: `backend/device-registration.js`
- Create: `ios/TicketGroundApp/TicketGroundApp/Device/SimulatorDeviceTrustClient.swift`
- Create: `ios/TicketGroundApp/TicketGroundApp/UI/Account/LiveNotificationSettingsView.swift`
- Modify: `backend/catalog-persistence.js`
- Modify: `backend/api-router.js`
- Modify: `backend/app.js`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Models/LiveBackendModels.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Data/LiveBackendService.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj`
- Test: `tests/device-registration-contract.test.mjs`
- Test: `ios/TicketGroundApp/TicketGroundAppTests/TicketGroundAppTests.swift`
- Test: `ios/TicketGroundApp/TicketGroundAppUITests/DiscoveryTests.swift`

**Interfaces:**
- Produces principal-owned challenge, trust, push-token register/revoke, and notification-settings routes.
- In Debug simulator builds, `SimulatorDeviceTrustClient` signs the server nonce with the existing development attestation secret supplied at launch; Release builds cannot use this provider.
- Produces a sanitized `.apns` payload for `xcrun simctl push` with no bearer token or private account data.

- [ ] Write failing backend tests for nonce single use/expiry, principal-device binding, counter replay rejection, token rotation, logout revocation, duplicate registration, sanitized payloads, and restart persistence.
- [ ] Verify red and implement the device-registration module without adding production APNs credentials or changing provider login files.
- [ ] Write failing native tests for simulator-only provider gating, authorization denied/allowed UI, register/revoke requests, account switch cleanup, and payload handling.
- [ ] Implement the notification settings screen and Debug simulator trust client; keep Release dependent on a real attestation provider.
- [ ] Build and launch the app, register the booted simulator, inject the generated payload with `xcrun simctl push`, verify visible receipt, then log out and prove the same account no longer receives an app-generated delivery request.

### Task 7: Issue #107 signed QR issuance and one-time gate consumption

**Files:**
- Create: `backend/gate-auth.js`
- Create: `ios/TicketGroundApp/TicketGroundApp/UI/Tickets/LiveTicketQRView.swift`
- Modify: `backend/admission.js`
- Modify: `backend/catalog-persistence.js`
- Modify: `backend/api-router.js`
- Modify: `backend/app.js`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Models/LiveBackendModels.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Data/LiveBackendService.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj`
- Test: `tests/admission-native-contract.test.mjs`
- Test: `ios/TicketGroundApp/TicketGroundAppTests/LiveBackendServiceTests.swift`
- Test: `ios/TicketGroundApp/TicketGroundAppUITests/DiscoveryTests.swift`

**Interfaces:**
- Produces principal-owned ticket QR issue/refresh/revoke routes and separately authorized `POST /api/gate/v1/scan`.
- Gate credentials are stored as hashes, scoped to `admission:consume`, and provisioned only from local ignored environment configuration.
- Gate scan atomically transitions one QR from valid to used and returns explicit `VALID`, `EXPIRED`, `USED`, `REVOKED`, or `CANCELLED` states.

- [ ] Write failing tests for ticket ownership, eligible ticket state, short expiry, refresh revocation, raw-secret omission, gate-scope denial, expired/cancelled/replayed QR rejection, restart persistence, and two simultaneous scans producing exactly one success.
- [ ] Verify red, implement gate authentication and atomic consume using the serialized application mutation path, then run admission and existing QR tests.
- [ ] Write failing native tests for valid/refresh/expired/used/cancelled/network states and screenshot-safe hiding when the app backgrounds.
- [ ] Implement the ticket QR view without logging or persisting the raw QR beyond its display lifecycle.
- [ ] Run simulator QR issuance, refresh, successful first scan, rejected second scan, and cancelled-ticket states; capture sanitized screenshots only.

### Task 8: Cloudflare HTTPS and iOS Simulator end-to-end qualification

**Files:**
- Create: `scripts/qualify-ios-simulator-https.sh`
- Create: `docs/research/open-issues-simulator-qualification.md`
- Modify: `.gitignore` only if a generated evidence path is not already ignored.
- Test: `tests/ios-simulator-qualification-script.test.mjs`

**Interfaces:**
- The script accepts explicit server port, simulator UDID, app bundle ID, and evidence directory arguments; it never embeds a transient tunnel URL or secret.
- Produces sanitized receipts and screenshots under `.omo/evidence/open-issues-simulator-qualification/`.

- [ ] Write a failing script contract test for required arguments, secret redaction, process cleanup, HTTPS origin extraction, and refusal to run when the server health check fails.
- [ ] Verify red, implement the minimal script using the installed `cloudflared`, `xcrun simctl`, and existing Xcode project.
- [ ] Stop all development servers before any build; run backend focused tests, then build the native app serially.
- [ ] Start one local production server, start one Cloudflare Quick Tunnel, and verify `/api/health` and authenticated API traffic through HTTPS without printing bearer credentials.
- [ ] Install/launch on iPhone 17 Pro (`C156F0BE-5436-493F-A045-31CE9AE7941A`) with the temporary HTTPS base URL and deterministic test session bootstrap.
- [ ] Execute every included #99/#100/#101/#102/#106/#107 success, empty, denied, expiry, retry, duplicate, and relaunch scenario; save fresh screenshots and sanitized API receipts.
- [ ] Terminate the tunnel and local server through script traps; do not persist the Quick Tunnel URL.

### Task 9: Verification, visual QA, and issue #108 readiness ledger

**Files:**
- Modify: `docs/research/native-ios-api-capability-ledger.md`
- Create: `docs/research/ios-simulator-operations-checklist.md`
- Modify: issue-specific GitHub metadata only after all local gates pass.

**Interfaces:**
- Produces an exact matrix of repository-complete, simulator-qualified, payment-excluded, provider-excluded, and production-only requirements.

- [ ] Run `git diff --check`, focused Node suites from Tasks 1-8, `NODE_ENV=production node --test tests/auth-preview-host-boundary.test.mjs`, `npm run lint`, `npm run typecheck`, and `npm run build` serially.
- [ ] Run the CI-native XCTest selection and all changed XCUITest scenarios on the booted iPhone 17 Pro simulator.
- [ ] Measure every modified source file, split any touched file above the applicable size limit where practical, and review for raw credentials, PII, QR content, weak ownership checks, and non-durable idempotency.
- [ ] Run visual QA on fresh captures of every changed native screen; require functional interaction, readable Korean text, no clipping, and no skipped state.
- [ ] Update the capability ledger and operations checklist with evidence paths, simulator acceptance, temporary HTTPS use, and exact exclusions for #103/#104/#105.
- [ ] Re-read each issue body and map every completion criterion to a passing artifact. Close only issues whose criteria are satisfied under the user's simulator qualification rule; otherwise post one concise status comment with the remaining non-repository dependency.
- [ ] Update #108 last, summarizing the completed API contracts and the remaining payment/provider production inputs without exposing secret values.
