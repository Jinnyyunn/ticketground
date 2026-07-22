import type { ApiSession } from "./ticketground-api-types";

export const DEMO_USER_ID = "user_fan_a";
export const SESSION_USER_STORAGE_KEY = "ticketground:session-user-id";
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

function notifySessionUserChanged() {
  window.dispatchEvent(new Event(SESSION_USER_CHANGED_EVENT));
}

export function rememberSessionUser(session: ApiSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_USER_STORAGE_KEY, session.id);
  window.localStorage.removeItem(DEMO_AUTH_STORAGE_KEY);
  notifySessionUserChanged();
}

export function clearSessionUser() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_USER_STORAGE_KEY);
  window.localStorage.setItem(DEMO_AUTH_STORAGE_KEY, SIGNED_OUT_VALUE);
  notifySessionUserChanged();
}
