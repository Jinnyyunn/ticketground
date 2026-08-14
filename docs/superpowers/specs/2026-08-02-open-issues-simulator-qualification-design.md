# Open Issues Simulator Qualification Design

## Goal

Resolve every repository-controlled part of issues #99 through #108 without claiming a real payment-provider integration, and use the iOS Simulator plus a temporary Cloudflare HTTPS origin as the accepted native qualification surface.

## Approved scope

- Treat the booted iPhone 17 Pro simulator as the native acceptance device for this work.
- Use the existing native Google test credential only to create a normal revocable TicketGround native session in automated tests. Do not change Google, Kakao, Naver, or web simple-login behavior.
- Use a temporary `trycloudflare.com` HTTPS tunnel for credential-bearing simulator traffic. The tunnel URL is evidence, not committed configuration.
- Persist security-relevant state in the existing disk-backed JSON database so restart tests exercise the same storage path as the server.
- Include #99, #100, #101, #102, #106, #107, and the repository-controlled documentation/checklist work in #108.
- Exclude #103 payment approval, PSP callbacks/webhooks, receipts, and payment recovery.
- Exclude #104 mutations that require refund, settlement, or payment-provider state. Existing read-only and disabled states must not regress.
- Exclude #105 PortOne/Danal provider E2E. Existing test-mode identity code remains unchanged and must not be represented as provider qualification.
- Preserve the protected simple-login files and the real-provider-first localhost behavior documented in `간편로그인-수정금지-지침.md`.

## Architecture

### Authenticated API boundary

Credential-bearing consumer APIs move to `/api/me/*` and derive the actor from the existing bearer native session. Request bodies and query strings no longer select the authenticated user. `backend/native-session.js` exposes a principal resolver built from the existing timing-safe credential lookup; OAuth issuance and callback code are untouched.

Every state-changing endpoint requires `Idempotency-Key`. A focused persistence helper stores actor, operation, request hash, response, and creation time in `db.idempotencyRecords`. Reusing a key with the same request returns the stored response, while reusing it with a different payload returns `409 IDEMPOTENCY_CONFLICT`. The record is written in the same serialized database save as the mutation.

### Feature contracts

- Support (#99): versioned public FAQ/notices/categories plus authenticated thread list, detail, create, and reply.
- Account (#100): authenticated profile read/update and reservation/ticket history derived only from the principal.
- Watchlist (#101): authenticated list/add/remove and notification preference updates with idempotent mutations.
- Booking (#102): queue admission, revisioned seat snapshots, expiring holds, hold release/renewal, and reservation drafts. No payment completion is added.
- Device (#106): simulator attestation challenge/response, device registration/revocation, push-token lifecycle, and deterministic simulator push payload generation. No claim is made about production APNs delivery.
- Admission (#107): short-lived signed QR issuance, refresh/revoke, and a separately authenticated gate verification/consume boundary with atomic one-time use.

### Native UI

New feature views live in focused Swift files rather than adding more responsibilities to `DiscoveryRouteView.swift`. They reuse the existing design tokens and `APIClient`, expose loading/content/empty/error/retry states, and use stable accessibility identifiers. Mutations disable duplicate submission, show progress, and reconcile from the server after success or failure.

### Qualification

Node integration tests cover authorization, ownership, restart durability, idempotency conflicts, expiry, and concurrency. XCTest covers request construction, decoding, session ownership, and error presentation. XCUITest drives every included menu on the iPhone 17 Pro simulator. A live server is exposed through Cloudflare, the simulator is pointed at that HTTPS origin, and screenshots plus server receipts are stored under `.omo/evidence/open-issues-simulator-qualification/`.

## Completion rules

- An issue is closed only when all repository-controlled acceptance criteria for its included scope pass on the current revision and the simulator flow is captured.
- #103 and #105 remain open. #104 remains open unless its remaining acceptance criteria no longer require payment-provider behavior.
- #108 records exactly what is implemented, what is simulator-qualified, and which provider/production items remain unavailable; secrets and transient tunnel credentials never appear in GitHub comments or committed files.
- No source code or tests may imply that simulator push injection equals production APNs delivery, or that the existing identity test mode equals PortOne/Danal production verification.
