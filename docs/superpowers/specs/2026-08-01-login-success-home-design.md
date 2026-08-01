# Login Success Home Navigation Design

## Goal

After Google, Kakao, or Naver creates a TicketGround native session, leave the login route and show the Home screen immediately. Provider cancellation and failure remain on the login route with the existing message.

## Scope

- Apply the same success navigation to Google, Kakao, and Naver.
- Preserve the native session already stored by each authentication client.
- Preserve the existing cancellation, provider failure, and logout behavior.
- Do not change OAuth credentials, provider callback handling, or backend session contracts.

## Design

`DiscoveryLoginView` already receives the shared `AppContainer`, whose `navigationPath` owns the app's `NavigationStack`. Each authentication task has a distinct signed-in result branch. In those branches, the view will first keep the existing success message assignment and then clear `container.navigationPath`. Clearing the path is the established project pattern for returning to Home and avoids adding a second routing abstraction.

The navigation change is event-driven rather than observing every session-store mutation. This limits automatic routing to a login attempt that just succeeded; restoring a Keychain session during app launch will not unexpectedly rewrite navigation.

## Error Handling

- Signed in: retain the stored session, clear the navigation path, show Home.
- Cancelled: keep the login route and existing cancellation message.
- Failed: keep the login route and existing provider error message.
- Idle or loading: no navigation change.

## Verification

1. Add a focused regression test that proves successful login completion clears a non-empty navigation path while cancellation and failure do not.
2. Run the focused iOS unit tests.
3. Build and install the app in the booted iPhone simulator.
4. Confirm an actual social-login success returns to Home and the session survives an app relaunch.
5. Confirm logout clears the local/server session and returns the UI to a logged-out state.

## Non-goals

- Redirecting successful users to My Page.
- Closing issue #96 before session restore, logout, and remaining provider evidence are complete.
- Changing the current OAuth provider configuration.
