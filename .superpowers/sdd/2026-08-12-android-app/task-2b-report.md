# Task 2B — Android ticket lifecycle, payment, device, push, and QR report

## Status

DONE_WITH_CONCERNS

## Commits

- `b8c50c2ada45b9e27769c82b7b05811ec63e5678` — `feat(security): add Android integrity verification`
- `81971cf1d26f7c285f99d7bac6a699378057c8fe` — `feat(android): add secure ticket lifecycle clients`
- `af3374ba66e8d5a585bfa53f0a3006718e56a29d` — `test(admission): migrate App Attest challenge flow`

## Delivered files

- Android production: `LifecycleApi.kt`, `LifecycleModels.kt`, `LifecyclePolicy.kt`, `PlatformProviders.kt`, `TossCheckout.kt`, `TicketGroundApiClient.kt`, and `app/build.gradle.kts` under `android/TicketGroundApp/`.
- Android JVM tests: `LifecycleApiWireTest.kt`, `LifecyclePolicyTest.kt`, `PlatformBoundaryTest.kt`, `TossCheckoutTest.kt`, `TossPaymentApiWireTest.kt`, and lifecycle fixtures in `ApiTestSupport.kt`.
- Minimum authorized backend contract: `backend/app-attest.js`, `backend/api-router.js`, `backend/app.js`, `backend/mobile-lifecycle.js`, `tests/app-attest-boundary.test.mjs`, and `tests/native-mobile-lifecycle-api.test.mjs`.
- Admission regression coverage: `tests/admission-flow.test.mjs` and its HTTPS App Attest verifier/challenge helpers in `tests/backend-test-utils.mjs`.

## Scope authorization

- The primary explicitly authorized the smallest backend expansion after the Android Play Integrity contract proved to be a blocking dependency. That authorization covered the platform discriminator, principal/purpose/device/ticket-bound single-use challenge, configured HTTPS Play Integrity verifier boundary, fail-closed behavior, and Apple App Attest compatibility. The backend changes listed above are that authorized minimum; protected login remained out of scope and unchanged.

## Security and contract decisions

- Lifecycle reads and mutations use bearer-principal routes. No lifecycle request accepts an Android-selected owner ID. Resale create/join/cancel, cancellation create, and push registration retain caller-supplied stable idempotency keys; resale cancel now has server-side replay/conflict receipts when a key is supplied.
- Cancellation creation requires an explicit refund acknowledgement and never represents an automatic refund. Resale KRW prices remain integral and must fit the owned ticket's server-provided minimum/maximum bounds before the action is eligible.
- Challenge responses are bound in Android memory to principal, purpose, device, optional ticket, challenge ID/value, and expiry. Unknown purpose/platform, expired challenge, mismatched ticket/device, rejected verifier responses, and replayed server challenges are non-actionable.
- The backend keeps the existing iOS App Attest challenge path compatible while adding an explicit `android` discriminator. Android proof tokens are sent only to `TIG_PLAY_INTEGRITY_VERIFIER_URL` when it is HTTPS and paired with `TIG_PLAY_INTEGRITY_VERIFIER_TOKEN`. The verifier must echo the expected package, challenge, purpose, device, and ticket binding; unset, HTTP, failed, malformed, or mismatched verification fails closed. Raw integrity tokens are not persisted.
- Android production provider factories default to no Play Integrity cloud project and no FCM configuration. They fail before requesting a token. Tests use explicit fakes; no successful local production attestation or push registration path exists.
- Trusted-device and push inventory models reject responses containing device tokens, token hashes, raw push tokens, or token digests. Admission QR signatures and integrity proofs are not stored by the app. Device tokens and payment keys remain operation-local.
- Toss preparation requires a configured public client key and a known `PENDING_PAYMENT`, unavailable owned ticket. Only `CREDIT_CARD`, `SIMPLE_PAY`, `BANK_TRANSFER`, and `MOBILE` are representable. Success confirms through `/api/payments/tosspayments/purchase`, preserves a stable retry key, suppresses duplicate confirmation, drops the payment key, and refetches the authoritative owned ticket. Cancellation/failure never confirms. No merchant/client secret or mock approval path is present in Android.
- Persistent checkout retry state contains only ticket ID, idempotency key, and confirmed flag; it never contains a Toss payment key. Protected Kakao/Naver/Google and admin-auth paths were not changed.

## Verification

Environment:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="/Users/jinny/Library/Android/sdk"
```

| Scenario | Invocation | Binary observable | Captured artifact |
| --- | --- | --- | --- |
| TDD RED — Play Integrity platform/verifier contract | `NODE_ENV=production node --test --test-concurrency=1 tests/app-attest-boundary.test.mjs tests/native-mobile-lifecycle-api.test.mjs` | exit 1; 3 expected failures before Android platform handling | `.omo/evidence/android-lifecycle-2026-08-12/red-backend-play-integrity.log` |
| TDD GREEN — Play Integrity platform/verifier contract | same focused command after implementation | exit 0; 10/10 passed | `.omo/evidence/android-lifecycle-2026-08-12/green-backend-play-integrity.log` |
| TDD RED/GREEN — stable resale cancel replay | focused `native resale pools` backend case before/after receipt integration | RED exit 1 with `POOL_CLOSED`; GREEN exit 0, 1/1 passed | `.omo/evidence/android-lifecycle-2026-08-12/red-resale-cancel-idempotency.log`, `.omo/evidence/android-lifecycle-2026-08-12/green-resale-cancel-idempotency.log` |
| TDD RED — Android lifecycle/provider/Toss boundaries | focused Gradle tests for `LifecycleApiWireTest`, `LifecyclePolicyTest`, `PlatformBoundaryTest`, and `TossCheckoutTest` | compile exit 1 on the intentionally missing production symbols | `.omo/evidence/android-lifecycle-2026-08-12/red-android-lifecycle.log` |
| TDD GREEN — Android focused boundaries | same focused Gradle selection after implementation | exit 0; `BUILD SUCCESSFUL`, 26 tasks executed | `.omo/evidence/android-lifecycle-2026-08-12/green-android-lifecycle.log` |
| TDD RED/GREEN — non-secret checkout retry continuity | focused `TossCheckoutTest` before/after persistent retry store | RED compile exit 1; GREEN exit 0 with `BUILD SUCCESSFUL` | `.omo/evidence/android-lifecycle-2026-08-12/red-checkout-retry-persistence.log`, `.omo/evidence/android-lifecycle-2026-08-12/green-checkout-retry-persistence.log` |
| Current backend lifecycle, payment, booking, account, persistence, and Apple/Android verifier contract | `NODE_ENV=production node --test --test-concurrency=1 tests/app-attest-boundary.test.mjs tests/native-mobile-lifecycle-api.test.mjs tests/tosspayments-payment.test.mjs tests/tosspayments-configured-amount.test.mjs tests/booking-holds-api.test.mjs tests/native-account-api.test.mjs tests/catalog-persistence.test.mjs` | exit 0; 34/34 passed | `.omo/evidence/android-lifecycle-2026-08-12/final-backend-tests-current.log` |
| Review RED — legacy admission callers omit server challenge | `NODE_ENV=production node --test --test-concurrency=1 tests/admission-flow.test.mjs` before test migration | exit 1; 0/5 passed, all five fail with `APP_ATTEST_CHALLENGE_INVALID` | `.omo/evidence/android-lifecycle-2026-08-12/admission-review-fix/red-admission-flow.log` |
| Review GREEN — admission flows use bearer-bound server challenges and configured HTTPS verifier | same complete admission file after test/helper migration | exit 0; 5/5 passed | `.omo/evidence/android-lifecycle-2026-08-12/admission-review-fix/green-admission-flow.log` |
| Final backend regression including admission | `NODE_ENV=production node --test --test-concurrency=1 tests/admission-flow.test.mjs tests/app-attest-boundary.test.mjs tests/native-mobile-lifecycle-api.test.mjs tests/tosspayments-payment.test.mjs tests/tosspayments-configured-amount.test.mjs tests/booking-holds-api.test.mjs tests/native-account-api.test.mjs tests/catalog-persistence.test.mjs` | exit 0; 39/39 passed | `.omo/evidence/android-lifecycle-2026-08-12/admission-review-fix/final-backend-with-admission.log` |
| Full Android JVM suite | from `android/TicketGroundApp`: `./gradlew testDevDebugUnitTest --rerun-tasks --no-daemon --console=plain` | exit 0; `BUILD SUCCESSFUL`; 40 tests, 0 failures/errors/skips | `.omo/evidence/android-lifecycle-2026-08-12/final-android-jvm-postreview.log` and generated XML under `android/TicketGroundApp/app/build/test-results/testDevDebugUnitTest/` |
| Android lint and APK assembly | `./gradlew lintDevDebug assembleDevDebug --no-daemon --console=plain` | exit 0; `BUILD SUCCESSFUL`; APK SHA-256 `c2459aebc5e58a11eea0c2894052efe20555e244ecb1c2ef610270f3e2884064` | `.omo/evidence/android-lifecycle-2026-08-12/final-android-lint-assemble-postreview.log`, `.omo/evidence/android-lifecycle-2026-08-12/app-dev-debug-postreview.apk.sha256` |
| Protected boundary, secret strings, file size, whitespace | changed-path protected-pattern scan, Android production source secret scan, Kotlin LOC, `git diff --check` | zero protected paths; zero forbidden client-secret fixtures in production; affected files under 250 lines; diff check exit 0 | `.omo/evidence/android-lifecycle-2026-08-12/final-static-checks.log` |

No emulator or physical device was run.

## External gates

- Google Play signing and a real Play Integrity cloud project/package integration.
- Configured HTTPS Play Integrity verifier credentials and real Google verdict validation.
- Firebase project configuration and real FCM token issuance/delivery.
- Toss merchant/client configuration, SDK UI integration, and real sandbox/merchant approval.
- Physical-device biometric/device-lock, trusted-device, rotating admission QR, and gate admission qualification.

## Concerns

- Resolved: all five admission scenarios now acquire bearer-principal-bound, server-issued iOS challenges and consume them through an explicitly configured test HTTPS verifier. The admission file contains no legacy HMAC proof caller, and no backend bypass was added.
- External provider and physical-device gates above remain unqualified by design. No production readiness claim is made for Play Integrity, FCM, Toss, or admission hardware.
