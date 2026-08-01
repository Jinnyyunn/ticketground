# Issue 95 Google iOS Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a verified, revocable Google-to-TicketGround native session for the iOS app.

**Architecture:** Add an opaque hash-at-rest native session boundary to the backend, then connect GoogleSignIn and the existing iOS Keychain/HTTPS client to that boundary. Preserve all web OAuth behavior.

**Tech Stack:** Node.js test runner, jose, Swift 5, SwiftUI, Security/Keychain, GoogleSignIn-iOS 9.0.0, XCTest.

## Global Constraints

- Never commit or log provider Client Secrets or session credentials.
- Preserve `http://localhost:5501` web provider behavior.
- Run Node, Xcode, browser, and simulator-heavy validation serially.
- Do not close #95 without real-account HTTPS signed-device E2E evidence.

---

### Task 1: Backend native session contract

**Files:**
- Create: `backend/native-session.js`
- Modify: `backend/session.js`, `backend/api-router.js`, `backend/app.js`, persistence normalization as required
- Test: `tests/google-native-session.test.mjs`

- [ ] Write tests for issuance, hash-only storage, owner binding, expiry, and revocation.
- [ ] Run the focused test and observe the missing-route/contract failure.
- [ ] Implement random opaque credential issuance and hash-at-rest lookup/revocation.
- [ ] Run focused and existing Google auth tests green.
- [ ] Commit the backend behavior and direct tests atomically.

### Task 2: iOS exchange and Keychain lifecycle

**Files:**
- Create: `ios/TicketGroundApp/TicketGroundApp/Auth/GoogleLoginService.swift`
- Modify: `AppEnvironment.swift`, `DiscoveryRouteView.swift`, `TicketGroundApp.swift`, `Info.plist`, `project.pbxproj`
- Test: `TicketGroundAppTests/GoogleLoginServiceTests.swift`, focused UI test

- [ ] Write XCTest cases for HTTPS-only exchange, response decoding, session persistence, logout, and error mapping.
- [ ] Run the focused XCTest and observe failure before production code.
- [ ] Add GoogleSignIn 9.0.0 package/configuration and minimal login coordinator.
- [ ] Connect only the Google button; keep Kakao/Naver externally gated.
- [ ] Run focused XCTest and login UI tests green.
- [ ] Commit iOS behavior and direct tests atomically.

### Task 3: Release verification and GitHub processing

- [ ] Run protected web auth tests and the full Node `npm run check` gate.
- [ ] Run Xcode unit/UI tests and a serial simulator QA of login states.
- [ ] Scan the diff for secrets and verify only intended files changed.
- [ ] Push `agent/issue-95-google-ios-session` and open a ready PR referencing #95 without auto-closing it.
- [ ] Wait for CI and latest-HEAD review; repair findings and merge only when green.
- [ ] Add an evidence comment to #95. Close only if the real-account HTTPS signed-device E2E criteria are also satisfied.
