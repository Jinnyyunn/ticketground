# Task 2A — Android typed API and core customer operations report

## Status

DONE

## Contract decisions

- Production construction uses only `BuildConfig.API_BASE_URL`. Account calls require the configured HTTPS origin and an existing `SessionVault` bearer before network I/O; public calls never attach the bearer and redirects remain disabled.
- The unused unauthenticated `/api/state` client and broad user, ticket, seller-ID, venue, ledger, and resale-pool state models remain removed. Public diagnosis uses only non-sensitive health, discovery, catalog, seat-map, and public-support contracts.
- Account routes use bearer-principal `/api/me` ownership. No account method accepts a user ID, and mutation bodies contain only deployed resource fields.
- All 12 Android-exposed mutations use the durable bounded `apiMutationReceipts` store. The same principal, operation, resource payload, and key replays an immutable deep-cloned first response across lifecycle/message changes and database restart; a different payload under the same scoped key returns `409 IDEMPOTENCY_CONFLICT`.
- Seat-hold create, reservation-draft create, support-thread create, and support-message create no longer recompute a mutable entity on retry. Their original public response snapshots are replayed after hold release, draft cancellation, later support messages, and restart.
- The receipt store retains the newest 1,000 records. The audit covers profile update, support thread/message create, watchlist upsert/delete, queue enter/leave, seat-hold create/extend/release, and reservation-draft create/cancel.
- Kotlin models fail closed for unknown action-driving security/lifecycle values and tolerate only display-only unknown support status/role values.
- Android source is split by responsibility into transport/envelope, public API/models, account API/models, and focused test support/security/wire/contract files. Every affected Kotlin file is 18–179 pure LOC.
- No bearer tokens, request bodies, personal data, device proofs, or payment secrets are logged. Kakao, Naver, and Google login code/configuration/tests were not changed.

## Delivered files

- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/data/ApiModels.kt`
- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/data/PublicApiModels.kt`
- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/data/AccountApiModels.kt`
- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/data/TicketGroundApiClient.kt`
- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/data/PublicApi.kt`
- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/data/AccountApi.kt`
- `android/TicketGroundApp/app/src/test/java/kr/ticketground/app/data/ApiTestSupport.kt`
- `android/TicketGroundApp/app/src/test/java/kr/ticketground/app/data/ApiSecurityTest.kt`
- `android/TicketGroundApp/app/src/test/java/kr/ticketground/app/data/AccountApiWireTest.kt`
- `android/TicketGroundApp/app/src/test/java/kr/ticketground/app/data/PublicApiContractTest.kt`
- `backend/api-router.js`, `backend/app.js`, `backend/booking-holds.js`, `backend/catalog-persistence.js`, `backend/engagement.js`, `backend/idempotent-mutation.js`, `backend/session.js`
- `tests/booking-holds-api.test.mjs`, `tests/native-account-api.test.mjs`, `tests/native-watchlist-api.test.mjs`, `tests/native-support-api.test.mjs`
- `.superpowers/sdd/2026-08-12-android-app/task-2a-report.md`

## Verification

Environment:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="/Users/jinny/Library/Android/sdk"
```

| Scenario | Invocation | Binary observable | Captured artifact |
| --- | --- | --- | --- |
| Backend durable replay, conflict, restart, bounded persistence, and mutation regressions | `NODE_ENV=production node --test --test-concurrency=1 tests/booking-holds-api.test.mjs tests/native-account-api.test.mjs tests/native-watchlist-api.test.mjs tests/native-support-api.test.mjs tests/catalog-persistence.test.mjs` | exit 0; 26 tests, 26 passed, 0 failed | `.omo/evidence/android-api-core-rereview-2026-08-12/final-backend-tests.log` |
| Four formerly entity-local create operations after later state changes and restart | focused booking/support cases in the same backend command | hold and draft replay their original `ACTIVE`/`PENDING_PAYMENT` responses after release/cancel; thread/message replay their original one/two-message snapshots after later messages; conflicting payloads return 409 | `.omo/evidence/android-api-core-rereview-2026-08-12/final-backend-tests.log` |
| Android JVM foundation and API suite | from `android/TicketGroundApp`: `./gradlew testDevDebugUnitTest --rerun-tasks --no-daemon --console=plain` | exit 0, `BUILD SUCCESSFUL`; 26/26 tasks executed; 23 tests, 0 failures/errors/skips, including 17 API tests | `.omo/evidence/android-api-core-rereview-2026-08-12/final-android-jvm.log` |
| Android lint | from `android/TicketGroundApp`: `./gradlew lintDevDebug --no-daemon --console=plain` | exit 0, `BUILD SUCCESSFUL` | `.omo/evidence/android-api-core-rereview-2026-08-12/final-android-lint.log` |
| Mutation audit and file-size split | enumerate `AccountApi` mutation calls, server receipt kinds, and pure Kotlin LOC | 12 client mutations map to 12 receipt kinds; affected Kotlin files are each below 250 pure LOC | `.omo/evidence/android-api-core-rereview-2026-08-12/precommit-static-checks.log` |
| Protected login boundary and whitespace | changed paths checked against repository protected patterns; `git diff --check` | zero protected paths; diff check exit 0 | `.omo/evidence/android-api-core-rereview-2026-08-12/protected-diff-check.log` |
| TDD RED for immutable create replay | focused booking/support test before the fix | both tests failed: hold replay returned `RELEASED`, and support-thread replay included later messages | `.omo/evidence/android-api-core-rereview-2026-08-12/red-immutable-create-replay.log` |
| TDD GREEN for immutable create replay | same focused booking/support test after the fix | 2 tests passed, 0 failed | `.omo/evidence/android-api-core-rereview-2026-08-12/green-immutable-create-replay.log` |

No emulator was run; Task 2A is headless data/domain work.

## Commits

- `88f7bb7fd4b05123cc8867e1e346613a62fe091d feat(android): add typed customer API core`
- `de17169f35502c5f8052b1d53d01644285a3bf94 fix(android): enforce safe API replay contracts`
- `ce6db15e2b97b3c10dd9daf7d72f15be8382825b fix(android): preserve mutation replay snapshots`

## Concerns

No Task 2A blocker remains. Google Play signing, Play Integrity, FCM delivery, Toss merchant credentials, and physical-device admission remain assigned to later work units.
