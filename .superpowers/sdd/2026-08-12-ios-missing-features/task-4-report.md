# Task 4 Report — Native iOS Ticket Lifecycle

Status: DONE

## Delivered

- `reservation(id:)` now opens a live authenticated ticket detail with event, schedule, seat, payment, trusted-device, push-registration, and admission-QR states.
- `cancel` and `resale` are authenticated external-gate routes. Cancellation requires a reason and explicit refund acknowledgement, then shows pending review. Resale validates the owned ticket's min/max price, supports eligible pool join, and cancels an owned open listing.
- Trusted-device registration now requests a principal/device/purpose-bound, two-minute, one-use server challenge; performs local device-owner authentication; generates an Apple App Attest key and attestation; and sends it to an externally configured HTTPS verifier boundary. QR issuance repeats user presence and submits an App Attest assertion bound to the ticket challenge. Unsupported devices, simulators, absent verifier configuration, expired/replayed challenges, and process-restored credentials fail closed.
- APNs registration now requests notification permission, calls `registerForRemoteNotifications`, receives the raw token through `UIApplicationDelegate`, and immediately submits it through the typed idempotent upsert. The raw token is neither logged nor persisted by the app.
- Cancellation, resale listing, and admission QR controls are exposed only for the known `OWNED` plus inventory-unavailable state; unknown, stale, resale-listed, and contradictory available states fail closed.
- The former mixed lifecycle module is separated into lifecycle UI, production App Attest/APNs security provider, and UI-test fixture files. Mutation retry keys remain stable until success.
- `transfer` remains intentionally unsupported.
- Added scripted live UI fixtures and focused unit/UI coverage for happy, signed-out, unavailable capability, expired QR, and server-error states.

## Evidence

| Scenario | Invocation | Observable | Artifact |
|---|---|---|---|
| TDD RED | focused lifecycle unit tests before implementation | compile failure for missing `LiveLifecycleDisplay` | `.omo/evidence/task-4/red-unit.log` |
| Backend attestation/lifecycle | Node focused suites | App Attest boundary 2 plus existing admission/lifecycle 10, all pass | `.omo/evidence/task-4-fix-round-20260812/backend.log` |
| iPhone lifecycle | iPhone 17 Pro focused unit/UI suite | xcresult summary: 11 passed, 0 failed | `.omo/evidence/task-4-fix-round-20260812/iphone.xcresult` |
| iPad lifecycle | iPad Air 11-inch (M4), 6 UI scenarios | xcresult summary retained | `.omo/evidence/task-4-fix-round-20260812/ipad.xcresult` |
| Mobile render | live happy reservation route | readable single-column cards and reachable controls | `.omo/evidence/task-4/final-iphone-reservation.png` |
| Tablet render | live happy reservation route | regular-width two-column summary and reachable controls | `.omo/evidence/task-4/final-ipad-reservation.png` |

## External gates

- Real APNs delivery requires an Apple push environment and a signed-device run; debug/release APNs and App Attest entitlements are present.
- Production must configure `TIG_APP_ATTEST_VERIFIER_URL` (HTTPS) and `TIG_APP_ATTEST_VERIFIER_TOKEN` to a verifier that validates Apple's App Attest certificate chain, app identity, nonce hash, and monotonic assertion counter. The backend deliberately fails closed instead of implementing an incomplete local CBOR/certificate verifier.
- App Attest, biometric/device-owner authentication, and admission QR production qualification require a physical trusted device and the verifier configuration above.
- Simulator verification is local qualification, not production delivery proof.
