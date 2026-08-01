# Issue 96 Kakao and Naver iOS Session Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure, one-use Kakao/Naver OAuth handoff from fixed HTTPS callbacks to revocable TicketGround iOS sessions.

**Architecture:** Extend the existing state-verified social OAuth callback with an iOS-only handoff code whose hash is persisted and atomically consumed. Add an `ASWebAuthenticationSession` coordinator that exchanges the callback code over the existing HTTPS API boundary and saves the resulting native session in the existing Keychain-backed `SessionStore`.

**Tech Stack:** Node.js ESM backend, `node:test`, Swift 6, AuthenticationServices, XCTest, Xcode iOS simulator.

## Global Constraints

- Preserve real-provider-first behavior at `http://localhost:5501`.
- Never commit or print provider client secrets, provider tokens, handoff codes, or native credentials.
- Reject non-HTTPS API origins and callback-scheme mismatches before exchanging credentials.
- Handoff codes are random, hash-only at rest, provider-bound, single-use, and expire after five minutes.
- Reuse the native session and Keychain lifecycle implemented by issue #95.
- Leave 360-degree viewer code untouched.

---

### Task 1: Backend one-use handoff boundary

**Files:**
- Create: `backend/native-auth-handoff.js`
- Modify: `backend/social-oauth.js`
- Modify: `backend/api-router.js`
- Modify: `backend/persistence.js`
- Test: `tests/social-native-handoff.test.mjs`

**Interfaces:**
- Produces `issueNativeAuthHandoff(db, provider, userID, now)` and `consumeNativeAuthHandoff(db, provider, rawCode, now)`.
- Extends social start/callback with a fixed `client=ios` flow and adds `POST /api/auth/native/handoff`.

- [ ] Write failing tests proving hash-only persistence, five-minute expiry, single use, provider binding, and state mismatch issuing nothing.
- [ ] Run `node --test tests/social-native-handoff.test.mjs` and observe the missing handoff behavior fail.
- [ ] Implement the minimal handoff record, fixed app redirect, atomic consume, and native-session response.
- [ ] Run `node --test tests/social-native-handoff.test.mjs tests/social-auth-login.test.mjs tests/google-native-session.test.mjs` and require all tests to pass.
- [ ] Commit backend and tests as `feat(auth): issue social app handoff codes`.

### Task 2: iOS browser coordinator and session exchange

**Files:**
- Create: `ios/TicketGroundApp/TicketGroundApp/Auth/SocialLoginCoordinator.swift`
- Create: `ios/TicketGroundApp/TicketGroundApp/Auth/SocialNativeSessionClient.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift`
- Modify: `ios/TicketGroundApp/TicketGroundApp/Info.plist`
- Modify: `ios/TicketGroundApp/TicketGroundAppTests/TicketGroundAppTests.swift`
- Modify: `ios/TicketGroundApp/TicketGroundAppUITests/DiscoveryTests.swift`

**Interfaces:**
- Consumes `APIClient`, `SessionStore`, and the existing native session response contract.
- Produces provider-specific loading, cancelled, signed-in, and failed presentation states.

- [ ] Write failing XCTest cases for HTTPS-only start URLs, callback parsing, cancel preservation, exchange persistence, and provider mismatch.
- [ ] Run only the new XCTest methods and observe missing coordinator/client failures.
- [ ] Implement `ASWebAuthenticationSession`, fixed callback scheme validation, HTTPS exchange, and Keychain persistence.
- [ ] Connect only Kakao and Naver product buttons; retain deterministic UI-test gates and Google behavior.
- [ ] Run the new unit tests and affected login UI tests on the iPhone 17 Pro simulator and require them to pass.
- [ ] Commit iOS changes as `feat(ios): connect Kakao and Naver sessions`.

### Task 3: Verification, review, and GitHub delivery

**Files:**
- Verify all files changed from `origin/main` and evidence under a new issue-96 evidence root.

**Interfaces:**
- Produces a reviewed PR that references #96 without closing it.

- [ ] Run `git diff --check`, secret-pattern scans, focused Node tests, and the exact iOS test selection in `.github/workflows/ci.yml` serially.
- [ ] Capture login, Kakao cancel/failure, and Naver cancel/failure states with one consistent iPhone 17 Pro viewport if the rendered surface changed.
- [ ] Obtain one independent latest-HEAD code review and one visual QA review; repair only consequential findings.
- [ ] Push `agent/issue-96-kakao-naver-session`, create a ready PR with `Refs #96`, and wait for `quality` and `ios-native` success.
- [ ] Merge only on a clean latest HEAD. Keep #96 open with an externally blocked comment naming the production HTTPS callback registration, deployment secret references, signed-device real-account attestation, and evidence paths.
