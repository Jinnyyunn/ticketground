# Task 2A — Android typed API and core customer operations report

## Status

DONE

## Delivered scope

- Android typed customer API models, client, and JVM contract tests under `android/TicketGroundApp`.
- The unused unauthenticated `/api/state` client and broad user, ticket, seller-ID, venue, ledger, and resale-pool state models were removed. Public contract diagnosis remains limited to non-sensitive health/discovery/support endpoints.
- Account requests require an HTTPS origin and an existing bearer credential before network I/O. Public requests never attach the credential, and redirects remain disabled.
- Account routes use `/api/me` principal ownership. No Android account method accepts a user ID, and mutation bodies contain only deployed resource fields.
- Server-side durable API mutation receipts now replay the exact stored response for the same principal, operation, resource payload, and idempotency key. Reusing a key with a different payload returns `409 IDEMPOTENCY_CONFLICT`; receipts persist with the catalog database and are bounded to the newest 1,000 records.
- The Android mutation audit covers profile update, support create/reply, watchlist upsert/delete, queue enter/leave, seat-hold create/extend/release, and reservation-draft create/cancel. Pre-existing entity-local receipts remain in place for support create/reply, seat-hold create, and reservation-draft create; the shared receipt runner covers the remaining exposed mutations.
- The client decodes the `{ok,data,error}` envelope and maps transport, malformed response, authorization, not-found, conflict/idempotency, retryable, and other server failures to explicit Kotlin error types.
- No secrets, bearer tokens, request bodies, personal data, or payment/device proof material are logged.
- Kakao, Naver, and Google login code, configuration, environment variables, and tests were not changed.

## Delivered files

- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/data/ApiModels.kt`
- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/data/TicketGroundApiClient.kt`
- `android/TicketGroundApp/app/src/test/java/kr/ticketground/app/data/TicketGroundApiTest.kt`
- `backend/api-router.js`
- `backend/app.js`
- `backend/booking-holds.js`
- `backend/catalog-persistence.js`
- `backend/engagement.js`
- `backend/idempotent-mutation.js`
- `backend/session.js`
- `tests/booking-holds-api.test.mjs`
- `tests/native-account-api.test.mjs`
- `tests/native-watchlist-api.test.mjs`
- `.superpowers/sdd/2026-08-12-android-app/task-2a-report.md`

## Verification

Environment:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="/Users/jinny/Library/Android/sdk"
```

| Scenario | Invocation | Binary observable | Captured artifact |
| --- | --- | --- | --- |
| Backend replay, conflict, persistence, and mutation regression suite | `NODE_ENV=production node --test --test-concurrency=1 tests/booking-holds-api.test.mjs tests/native-account-api.test.mjs tests/native-watchlist-api.test.mjs tests/native-support-api.test.mjs tests/catalog-persistence.test.mjs` | exit 0; 24 tests, 24 passed, 0 failed | `.omo/evidence/android-api-core-review-2026-08-12/final-verification.log` |
| Android JVM foundation and API contract suite | `./gradlew testDevDebugUnitTest --rerun-tasks --no-daemon --console=plain` | exit 0, `BUILD SUCCESSFUL`; 23 tests, 0 failures, 0 errors | `.omo/evidence/android-api-core-review-2026-08-12/final-verification.log`, `.omo/evidence/android-api-core-review-2026-08-12/android-test-report/index.html` |
| HTTPS/account credential isolation | `TicketGroundApiTest` in the JVM suite | HTTP origin with a stored credential and HTTPS origin without a credential both fail before dispatch; public requests carry no authorization header | `.omo/evidence/android-api-core-review-2026-08-12/android-test-report/classes/kr.ticketground.app.data.TicketGroundApiTest.html` |
| Representative support/watchlist/queue/draft wire contracts | `TicketGroundApiTest` in the JVM suite | exact method, path, JSON body, bearer header, and caller idempotency key assertions pass | `.omo/evidence/android-api-core-review-2026-08-12/android-test-report/classes/kr.ticketground.app.data.TicketGroundApiTest.html` |
| Backend lost-response replay | focused booking/account/watchlist tests | exact response deep equality survives application restart; same key with conflicting payload returns `IDEMPOTENCY_CONFLICT`; receipt cap remains 1,000 | `.omo/evidence/android-api-core-review-2026-08-12/final-verification.log` |
| Whitespace and protected-login boundary | `git diff --check` plus changed-path comparison against protected auth patterns | exit 0; no changed protected-login path | `.omo/evidence/android-api-core-review-2026-08-12/final-verification.log` |
| TDD RED: durable booking replay | focused booking replay test before implementation | retry after restart returned a lifecycle conflict instead of the original response | `.omo/evidence/android-api-core-review-2026-08-12/red-backend-replay.log` |
| TDD RED: queue/profile/watchlist mutation audit | focused tests before implementation | queue retry produced a new entry; profile/watchlist conflicting reuse returned success instead of 409 | `.omo/evidence/android-api-core-review-2026-08-12/red-queue-enter-replay.log`, `.omo/evidence/android-api-core-review-2026-08-12/red-profile-watchlist-replay.log` |

No emulator was run; Task 2A requires JVM and backend contract qualification.

## Commits

- `88f7bb7fd4b05123cc8867e1e346613a62fe091d feat(android): add typed customer API core`
- `de17169f35502c5f8052b1d53d01644285a3bf94 fix(android): enforce safe API replay contracts`

## Remaining external gates

Google Play signing, Play Integrity, FCM delivery, Toss merchant credentials, and physical-device admission remain assigned to later work units and are not Task 2A evidence.
