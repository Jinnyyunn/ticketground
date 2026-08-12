# iOS missing-features implementation plan

## Goal

Replace the live-mode unsupported transaction destinations with native, authenticated customer flows while preserving the protected simple-login boundary.

## Work units

1. Add principal-bound backend contracts for official resale, cancellation requests, push registration, and admission-device state. Cover ownership, idempotency, invalid state, and cross-account access.
2. Extend the Swift API contract and typed service models for those routes. Cover request construction and response decoding before UI changes.
3. Add graphical available-seat selection and connect queue, seat hold, reservation draft, and existing Toss checkout navigation.
4. Add ticket lifecycle screens for reservation detail, cancellation request, official resale listing/purchase/cancel, trusted device, push registration, and admission QR.
5. Add focused unit and UI scenarios for successful flows, signed-out state, unavailable capability, expiry, and server errors.
6. Build and test on an iOS Simulator, then inspect the customer journey visually at phone and tablet sizes.
7. Commit, push, open the iOS PR, address review and CI findings, and merge only after required checks pass.

## Non-goals

- Modifying Google, Kakao, or Naver login code, tests, environment variables, or provider consoles.
- Enabling directed person-to-person transfer, which the current commerce policy explicitly blocks.
- Claiming production readiness for App Attest, APNs, Toss settlement, or gate hardware without real provider evidence.
