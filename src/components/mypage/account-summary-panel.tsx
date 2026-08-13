"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  clearSessionUser,
  DEMO_AUTH_STORAGE_KEY,
  getSession,
  rememberSessionUser,
  SESSION_USER_CHANGED_EVENT,
  SIGNED_OUT_VALUE,
  type ApiSession,
  updateProfile,
} from "@/lib/ticketground-api";
import { readDemoCancelHistory } from "@/lib/demo-cancel-history";

type AccountSummaryPanelProps = {
  readonly reservationCount: number;
  readonly resaleSeatCount: number;
  readonly inquiryCount: number;
};

type AuthState = "loading" | "signed-in" | "signed-out" | "error";

export function AccountSummaryPanel({ reservationCount, resaleSeatCount, inquiryCount }: AccountSummaryPanelProps) {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [session, setSession] = useState<ApiSession | null>(null);
  const [cancelHistoryCount, setCancelHistoryCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [status, setStatus] = useState("세션 확인 중");
  const [saving, setSaving] = useState(false);

  const showSignedOut = useCallback(() => {
    setSession(null);
    setEditing(false);
    setAuthState("signed-out");
    setStatus("로그아웃되었습니다.");
  }, []);

  const loadSession = useCallback(async () => {
    setAuthState("loading");
    setStatus("세션 확인 중");
    try {
      const nextSession = await getSession();
      setSession(nextSession);
      setDraftName(nextSession.name);
      setAuthState("signed-in");
      setStatus(`${nextSession.name} 세션 연결됨`);
      rememberSessionUser(nextSession);
    } catch (error) {
      setAuthState("error");
      setStatus(error instanceof Error ? error.message : "세션을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    setCancelHistoryCount(readDemoCancelHistory().length);

    if (window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY) === SIGNED_OUT_VALUE) {
      showSignedOut();
      return;
    }

    void loadSession();
  }, [loadSession, showSignedOut]);

  useEffect(() => {
    const syncSignedOut = () => {
      if (window.localStorage.getItem(DEMO_AUTH_STORAGE_KEY) === SIGNED_OUT_VALUE) {
        showSignedOut();
      }
    };
    window.addEventListener("storage", syncSignedOut);
    window.addEventListener(SESSION_USER_CHANGED_EVENT, syncSignedOut);
    return () => {
      window.removeEventListener("storage", syncSignedOut);
      window.removeEventListener(SESSION_USER_CHANGED_EVENT, syncSignedOut);
    };
  }, [showSignedOut]);

  async function saveProfile() {
    const nextName = draftName.trim();
    if (!nextName) return;

    setSaving(true);
    setStatus("회원 정보를 저장하는 중");
    try {
      const nextSession = await updateProfile(nextName, session?.id);
      rememberSessionUser(nextSession);
      setSession(nextSession);
      setDraftName(nextSession.name);
      setEditing(false);
      setAuthState("signed-in");
      setStatus(`${nextSession.name} 회원 정보 저장 완료`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "회원 정보 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearSessionUser();
    showSignedOut();
  }

  if (authState === "signed-out") {
    return (
      <div className="rounded-lg border border-line bg-ink-2 p-6 text-on-ink-2" data-account-panel data-auth-state="signed-out">
        <p className="text-sm font-bold text-accent-2">Ticketground MEMBERS</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-[30px] font-black">로그인이 필요합니다</h1>
            <p className="mt-2 text-base text-on-ink-2/75" data-account-status>
              {status}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="h-11 rounded-sm bg-card px-4 text-sm font-bold text-ink-2" onClick={() => void loadSession()} type="button">
              데모 계정으로 다시 로그인
            </button>
            <Link className="flex h-11 items-center rounded-sm border border-white/30 px-4 text-sm font-bold text-on-ink-2" href="/login">
              로그인 화면
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName = session?.name ?? (authState === "loading" ? "세션 확인 중" : "회원");
  const counters = [
    { label: "예매", count: reservationCount, href: "/mypage#reservations" },
    { label: "취소", count: cancelHistoryCount, href: "/mypage#cancel-history" },
    { label: "양도", count: resaleSeatCount, href: "/mypage/resale" },
    { label: "문의", count: inquiryCount, href: "https://pf.kakao.com/_xmTniX" },
  ] as const;

  return (
    <div className="rounded-lg border border-line bg-ink-2 p-6 text-on-ink-2" data-account-panel data-auth-state={authState}>
      <p className="text-sm font-bold text-accent-2">Ticketground MEMBERS</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-[32px] font-black" data-account-name>
            {displayName} 회원
          </h1>
          <p className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-base text-on-ink-2/75">
            <span className="whitespace-nowrap">Tig 티켓 인증 기기 1대</span>
            <span className="whitespace-nowrap">예매 {reservationCount}건</span>
            <span className="whitespace-nowrap">CLEAN 티켓 양도 {resaleSeatCount}석</span>
          </p>
          <p className="mt-2 text-sm font-bold text-on-ink-2/70" data-account-status>
            {status}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-3 text-center text-sm sm:gap-4">
          {counters.map((counter) => (
            counter.href.startsWith("http") ? (
              <a key={counter.label} href={counter.href} rel="noreferrer" target="_blank" className="min-w-0 whitespace-nowrap rounded-[6px] px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-2">
                <strong className="block text-2xl">{counter.count}</strong>
                <span className="text-on-ink-2/70">{counter.label}</span>
              </a>
            ) : (
              <Link key={counter.label} href={counter.href} className="min-w-0 whitespace-nowrap rounded-[6px] px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-2">
                <strong className="block text-2xl">{counter.count}</strong>
                <span className="text-on-ink-2/70">{counter.label}</span>
              </Link>
            )
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="h-10 rounded-sm bg-card px-4 text-sm font-bold text-ink-2 disabled:bg-card/40"
          disabled={authState !== "signed-in"}
          onClick={() => setEditing(true)}
          type="button"
        >
          회원정보 수정
        </button>
        <button
          className="h-10 rounded-sm border border-white/30 px-4 text-sm font-bold text-on-ink-2 disabled:text-on-ink-2/45"
          disabled={authState === "loading"}
          onClick={logout}
          type="button"
        >
          로그아웃
        </button>
      </div>

      {editing && (
        <div className="mt-5 rounded-md bg-card p-4 text-ink-2" data-account-edit-panel>
          <label className="grid gap-2 text-sm font-bold">
            닉네임
            <input
              className="h-11 rounded-sm border border-line-strong px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              maxLength={12}
              onChange={(event) => setDraftName(event.target.value)}
              value={draftName}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="h-10 rounded-sm bg-ticketground px-4 text-sm font-bold text-white disabled:bg-surface-3 disabled:text-ink-4"
              disabled={saving || !draftName.trim()}
              onClick={saveProfile}
              type="button"
            >
              {saving ? "저장 중" : "저장"}
            </button>
            <button className="h-10 rounded-sm border border-line-strong px-4 text-sm font-bold" onClick={() => setEditing(false)} type="button">
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
