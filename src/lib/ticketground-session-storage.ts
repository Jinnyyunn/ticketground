import type { ApiSession } from "./ticketground-api-types";

export const DEMO_USER_ID = "user_fan_a";
export const SESSION_USER_STORAGE_KEY = "ticketground:session-user-id";
export const SESSION_CREDENTIAL_STORAGE_KEY = "ticketground:session-credential";
export const DEMO_AUTH_STORAGE_KEY = "ticketground:demo-auth-state";
export const SIGNED_OUT_VALUE = "signed-out";
export const SESSION_USER_CHANGED_EVENT = "ticketground:session-user-changed";
export const LAST_LOGIN_PROVIDER_STORAGE_KEY = "ticketground:last-login-provider";

export type LastLoginProvider = "google" | "kakao" | "naver";

export function rememberLastLoginProvider(provider: LastLoginProvider) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_LOGIN_PROVIDER_STORAGE_KEY, provider);
}

export function lastLoginProvider(): LastLoginProvider | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(LAST_LOGIN_PROVIDER_STORAGE_KEY);
  return stored === "google" || stored === "kakao" || stored === "naver" ? stored : null;
}

export function currentSessionUserId() {
  if (typeof window === "undefined") return DEMO_USER_ID;
  const storedUserId = window.localStorage.getItem(SESSION_USER_STORAGE_KEY)?.trim();
  return storedUserId || DEMO_USER_ID;
}

export function hasStoredSessionUser() {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(SESSION_USER_STORAGE_KEY)?.trim());
}

export function storedSessionUserId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_USER_STORAGE_KEY)?.trim() || null;
}

export function storedSessionCredential() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_CREDENTIAL_STORAGE_KEY)?.trim() || null;
}

function notifySessionUserChanged() {
  window.dispatchEvent(new Event(SESSION_USER_CHANGED_EVENT));
}

export function rememberSessionUser(session: ApiSession) {
  if (typeof window === "undefined") return;
  const isSameUser = window.localStorage.getItem(SESSION_USER_STORAGE_KEY) === session.id;
  window.localStorage.setItem(SESSION_USER_STORAGE_KEY, session.id);
  if (session.credential) {
    // 로그인 성공 시에만 내려온다 — 서버 서명 토큰이므로 항상 최신 것으로 갱신한다.
    window.localStorage.setItem(SESSION_CREDENTIAL_STORAGE_KEY, session.credential);
  } else if (!isSameUser) {
    // 같은 사용자를 다시 조회한 게 아니라 다른 사용자로 바뀐 경우에만 지운다.
    // 새로고침 시 credential 없는 legacy 세션 조회(getSession)가 기존에 발급받은
    // credential을 조용히 지워버리지 않도록 하기 위함.
    window.localStorage.removeItem(SESSION_CREDENTIAL_STORAGE_KEY);
  }
  window.localStorage.removeItem(DEMO_AUTH_STORAGE_KEY);
  notifySessionUserChanged();
}

export function clearSessionUser() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_USER_STORAGE_KEY);
  window.localStorage.removeItem(SESSION_CREDENTIAL_STORAGE_KEY);
  window.localStorage.setItem(DEMO_AUTH_STORAGE_KEY, SIGNED_OUT_VALUE);
  notifySessionUserChanged();
}
