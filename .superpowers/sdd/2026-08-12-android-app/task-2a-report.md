# Task 2A — Android typed API and core customer operations report

## Status

DONE

## Delivered files

- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/data/ApiModels.kt`
- `android/TicketGroundApp/app/src/main/java/kr/ticketground/app/data/TicketGroundApiClient.kt`
- `android/TicketGroundApp/app/src/test/java/kr/ticketground/app/data/TicketGroundApiTest.kt`
- `android/TicketGroundApp/app/build.gradle.kts`
- `android/TicketGroundApp/gradle/libs.versions.toml`

## Contract decisions

- Production construction reads only `BuildConfig.API_BASE_URL`, validates it through the existing HTTPS-origin parser, and disables HTTP and HTTPS redirects.
- Public requests never read or attach the bearer credential. Account requests fail before network I/O when the configured origin is not HTTPS or the existing `SessionVault` credential is absent.
- Account routes use `/api/me` bearer-principal ownership. No account method accepts a user ID, and mutation bodies contain only deployed resource fields.
- Every account mutation accepts a non-blank caller-supplied idempotency key and sends it unchanged in `X-Idempotency-Key`, including backend mutations whose current handler does not otherwise require the header.
- The client decodes the `{ok,data,error}` envelope and maps transport, malformed response, 401, 403, 404, conflict/idempotency, retryable 429/5xx, and other server failures to explicit error types.
- Health version `78b3c7c` gates contracted reads; discovery and public-support payload version `1` is checked independently. Seat maps must return the requested event identity.
- Catalog reads enforce limit `1...100`, follow only server-issued cursors, reject empty/repeated cursors, and stop after 20 pages.
- Unknown account security and booking lifecycle values decode to `UNKNOWN`; all trust, leave, extend, release, and cancel eligibility properties fail closed. Display-only support status and role values tolerate `UNKNOWN`, matching the iOS behavior.
- No logging was added. The implementation never logs bearer tokens, request bodies, personal data, push/device/QR proof material, or payment secrets.
- Kakao, Naver, and Google login code, configuration, environment variables, and tests were not changed. Task 2B lifecycle, device, push, QR, and Toss work was not added.

## Verification

Environment:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="/Users/jinny/Library/Android/sdk"
```

| Scenario | Invocation | Binary observable | Captured artifact |
| --- | --- | --- | --- |
| Android JVM foundation and API contract suite | `./gradlew testDevDebugUnitTest --no-daemon --console=plain` | exit 0, `BUILD SUCCESSFUL`; 18 tests, 0 failures, 0 errors | `.omo/evidence/android-api-core-2026-08-12/testDevDebugUnitTest.log`, `.omo/evidence/android-api-core-2026-08-12/test-counts.log`, `.omo/evidence/android-api-core-2026-08-12/test-report/index.html` |
| API security, principal routing, idempotency, pagination, decode/encode, and error mapping | same invocation, `TicketGroundApiTest` | 12 tests, 0 failures, 0 errors | `.omo/evidence/android-api-core-2026-08-12/test-report/index.html` |
| Whitespace validation | `git diff --check` | exit 0, `git diff --check: PASS` | `.omo/evidence/android-api-core-2026-08-12/git-diff-check.log` |
| TDD initial API boundary RED | focused `TicketGroundApiTest` invocation before implementation | compilation failed because `TicketGroundApiClient` and typed models were absent | `.omo/evidence/android-api-core-2026-08-12/red-missing-api.log` |
| TDD empty PATCH RED | focused empty-PATCH test before request-body fix | failed with OkHttp `IllegalArgumentException` | `.omo/evidence/android-api-core-2026-08-12/red-empty-patch.log` |
| TDD profile and public-support identity RED | focused tests before each implementation | missing profile operation; incompatible support version was accepted | `.omo/evidence/android-api-core-2026-08-12/red-profile-mutation.log`, `.omo/evidence/android-api-core-2026-08-12/red-public-support-version.log` |

No emulator was run, as required by Task 2A.

## Commit

- `88f7bb7fd4b05123cc8867e1e346613a62fe091d feat(android): add typed customer API core`

## Concerns

- Google Play signing, Play Integrity, FCM delivery, Toss merchant credentials, physical-device admission, and emulator UI qualification remain in their planned later work units and are not Task 2A completion evidence.
