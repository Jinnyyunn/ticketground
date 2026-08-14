# Ticketground mobile platform scope

## Delivery order

1. Complete repository-controlled iOS customer flows.
2. Build the Android application from the accepted iOS and public API contracts.
3. Add mobile operations to the existing web admin.

Each stage ships through its own pull request, targeted tests, manual surface QA, review, and CI before merge.

## Shared customer capabilities

| Capability | iOS | Android | Admin responsibility |
| --- | --- | --- | --- |
| Discovery and search | Existing, preserve | Native implementation | Published catalog |
| Graphical seat selection | Select an available marker on the venue map | Same contract and behavior | Publish seat charts |
| Queue, seat hold, reservation draft | Native flow | Native flow | Observe queue and holds |
| Toss Payments checkout | Existing native SDK flow, preserve | Native SDK flow | Reconciliation and refund operations |
| My tickets and reservation detail | Existing list, add lifecycle actions | Native implementation | Customer-support lookup |
| Official resale | List, cancel listing, and purchase through owner-bound APIs | Same | Pool oversight and exception handling |
| Direct transfer | Blocked by product policy | Blocked by product policy | Audit attempts only |
| Cancellation | Submit an owner-bound cancellation request; no client-side refund claim | Same | Review and execute approved refunds |
| Trusted device and admission QR | Device-bound admission flow; fail closed without attestation | Play Integrity/device-bound flow | Device revocation and admission audit |
| Push notification | Register platform token under the authenticated principal | Same | Delivery status and token revocation |
| Support, watchlist, account | Existing, preserve | Native implementation | Existing support and customer workspaces |

## Security boundaries

- Google, Kakao, and Naver simple-login code and provider configuration are read-only.
- Every account mutation derives ownership from the bearer principal. Caller-supplied user IDs are never trusted.
- Booking, resale, cancellation, device, push, and QR mutations require idempotency where retries can duplicate state.
- Admission QR issuance fails closed unless the server verifies the app attestation and trusted-device credential.
- A cancellation request is not a refund. Only an authorized admin operation may transition payment and ticket state.

## External qualification

Repository completion does not prove production APNs/FCM delivery, Apple App Attest, Play Integrity, Toss merchant settlement, or real gate hardware. Those remain open until provider credentials and real-device evidence are supplied.
