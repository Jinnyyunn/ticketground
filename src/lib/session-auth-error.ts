import { TicketgroundApiError } from "./ticketground-api";

// A native-session Bearer credential can go stale (expired or revoked - the
// server no longer recognizes it) well after a page already believed the
// visitor was logged in via storedSessionUserId(). When that happens, the
// backend's session-plumbing error codes below are internal/native-app-
// flavored ("앱 로그인 세션을 확인할 수 없습니다.") and must never be shown to a
// web user verbatim - they read as gibberish and give no way forward. Both
// codes here mean the same thing in practice: a credential WAS sent and the
// server actively rejected it, so the local session is definitely wrong and
// should be dropped so the UI falls back to a login prompt.
//
// LOGIN_REQUIRED is deliberately NOT included here even though it's also a
// session-shaped error: it fires client-side, before any request reaches the
// server, whenever storedSessionCredential() is simply empty - which is the
// normal, supported shape of a "legacy demo" session (see getSession()'s
// comment in ticketground-api.ts). AccountSummaryPanel and other mypage
// surfaces treat that credential-less state as a valid signed-in session; if
// this helper cleared it too, this identity check and that legacy-session
// restore would fight over local storage on every mypage load. Its message
// ("로그인이 필요합니다.") is already plain, accurate Korean, so it's fine to
// let it pass through as-is instead of remapping it here. Anything else NOT
// in this set is a domain-specific message the backend already wrote for
// end users (e.g. PHONE_ALREADY_VERIFIED, IDENTITY_VERIFICATION_REQUIRED)
// and should also keep passing through unchanged.
const SESSION_AUTH_ERROR_CODES = new Set([
  "NATIVE_SESSION_INVALID",
  "NOT_OWNER",
]);

export const SESSION_EXPIRED_MESSAGE = "로그인 정보를 확인할 수 없습니다. 간편 로그인을 다시 진행해 주세요.";

export function isSessionAuthError(error: unknown): error is TicketgroundApiError {
  return error instanceof TicketgroundApiError && SESSION_AUTH_ERROR_CODES.has(error.code);
}
