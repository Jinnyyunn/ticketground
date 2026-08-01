# Issue 95 Google iOS Session Design

## Scope

Connect the existing iOS Google login surface to Google Sign-In and exchange the verified Google ID token for a revocable TicketGround native session. Preserve the existing web login behavior at `http://localhost:5501` and leave Kakao/Naver behavior unchanged for issue #96.

## Architecture

The app uses GoogleSignIn 9.0.0 with the iOS client ID for the URL callback and the existing web/server client ID as `GIDServerClientID`. It sends only the Google ID token to `POST /api/auth/google/native`, and only when the configured API base URL is HTTPS.

The backend verifies the Google token using the existing JWKS boundary, creates or finds the TicketGround user, and issues a random opaque native credential. Persistence stores only a SHA-256 hash with owner, expiry, and revocation state. Authenticated native requests resolve the bearer credential to the same owner; logout revokes it.

The app stores the returned credential and server user ID together in the existing Keychain store. Restore rehydrates the TicketGround session; logout revokes the server session when possible, removes Keychain data, and signs out of Google locally regardless of network outcome.

## Interfaces

- `POST /api/auth/google/native` body: `{ credential: string }`
- Success data: `{ user: PublicSessionUser, session: { credential: string, expiresAt: string } }`
- `POST /api/auth/native/logout` requires `Authorization: Bearer <credential>` and revokes the credential.
- Native bearer authentication is accepted only over HTTPS at the iOS client boundary and must match the user ID encoded in the requested resource.

## Error states

- User cancellation: no session mutation and a cancellation message.
- Missing Google configuration: `GOOGLE_AUTH_NOT_CONFIGURED`.
- Invalid Google token: `GOOGLE_AUTH_INVALID`.
- Non-HTTPS API base URL: local `insecureCredentialTransport`; no token leaves the device.
- Network/server failure: existing Keychain session remains unchanged.

## Verification and completion

Backend contract tests prove issuance, hash-only persistence, expiry/revocation, owner binding, and error separation. Swift tests prove HTTPS-only exchange, decoding, Keychain save/restore/logout, and presentation mapping. Existing web auth regression tests, full Node checks, Xcode unit/UI tests, and a simulator login-screen QA run must pass.

Issue #95 remains open unless a real Google account completes sign-in against an HTTPS endpoint on a signed device and Keychain restore/logout are observed. Internal green CI alone permits merge and an evidence comment, not issue closure.
