# Issue 96 Kakao and Naver iOS Session Handoff Design

## Goal

Connect Kakao and Naver OAuth to the iOS app without exposing provider tokens or server secrets, while preserving the existing web login behavior at `http://localhost:5501`.

## Approved constraints

- Provider callbacks remain fixed HTTPS backend URLs registered in Kakao Developers and Naver Developers.
- The app starts authentication with `ASWebAuthenticationSession` and receives only a short-lived, single-use handoff code through a fixed TicketGround app URL scheme.
- The app exchanges that code with the HTTPS TicketGround backend for the same revocable native session format used by Google, then stores only that native credential in Keychain.
- OAuth state stays cookie-bound, signed, and time-limited. A mismatch produces no user, handoff code, or native session.
- Provider access tokens, client secrets, handoff codes, and native credentials never enter logs, ledgers, comments, or committed configuration.
- Public provider identifiers may remain in committed configuration. Client secrets remain deployment-only values.
- The real-provider-first localhost behavior in the protected simple-login boundary must not regress.
- 360-degree viewer code is out of scope and must remain untouched.

## Data flow

1. iOS opens `/api/auth/{provider}/start?client=ios` on the configured HTTPS API origin.
2. The backend creates its existing signed state and HttpOnly state cookie, then redirects to the provider.
3. The provider returns to the fixed backend HTTPS callback. The backend validates state, exchanges the provider code, validates the provider profile, and upserts the TicketGround user.
4. For the iOS client only, the backend stores a hash of a random handoff code with provider, user, expiry, and unused state, then redirects to the fixed TicketGround callback scheme with the raw one-use code.
5. iOS POSTs the code and provider to `/api/auth/native/handoff` over HTTPS. The backend atomically consumes it and returns a revocable native session. Reuse or expiry returns a deterministic invalid-code error.
6. iOS saves the native session in Keychain and uses the existing server-validation and logout paths added by #95.

## Error handling and verification

- User cancellation is distinct from provider failure and does not change the current session.
- Missing provider configuration is reported before an external browser session starts.
- HTTP API origins and unexpected callback schemes are rejected before credentials are sent.
- Backend tests cover state mismatch, single use, expiry, hash-only storage, and cross-provider rejection.
- iOS tests cover URL construction, cancellation, exchange, Keychain persistence, HTTPS enforcement, and invalid/expired presentation.
- Real Kakao and Naver account qualification remains external and keeps #96 open until a signed device and production HTTPS endpoint attest both providers.
