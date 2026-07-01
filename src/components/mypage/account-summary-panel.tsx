"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSession, type ApiSession, updateProfile } from "@/lib/ticketground-api";
import { readDemoCancelHistory } from "@/lib/demo-cancel-history";

type AccountSummaryPanelProps = {
  readonly reservationCount: number;
  readonly transferableSeatCount: number;
  readonly inquiryCount: number;
};

type AuthState = "loading" | "signed-in" | "signed-out" | "error";

const demoAuthStorageKey = "ticketground:demo-auth-state";
const signedOutValue = "signed-out";

export function AccountSummaryPanel({ reservationCount, transferableSeatCount, inquiryCount }: AccountSummaryPanelProps) {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [session, setSession] = useState<ApiSession | null>(null);
  const [cancelHistoryCount, setCancelHistoryCount] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [status, setStatus] = useState("세션 확인 중");
  const [saving, setSaving] = useState(false);

  const loadSession = useCallback(async () => {
    setAuthState("loading");
    setStatus("세션 확인 중");
    try {
      const nextSession = await getSession();
      setSession(nextSession);
      setDraftName(nextSession.name);
      setAuthState("signed-in");
      setStatus(`${nextSession.name} 세션 연결됨`);
      window.localStorage.removeItem(demoAuthStorageKey);
    } catch (error) {
      setAuthState("error");
      setStatus(error instanceof Error ? error.message : "세션을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => {
    setCancelHistoryCount(readDemoCancelHistory().length);

    if (window.localStorage.getItem(demoAuthStorageKey) === signedOutValue) {
      setAuthState("signed-out");
      setSession(null);
      setStatus("로그아웃되었습니다.");
      return;
    }

    void loadSession();
  }, [loadSession]);

  async function saveProfile() {
    const nextName = draftName.trim();
    if (!nextName) return;

    setSaving(true);
    setStatus("회원 정보를 저장하는 중");
    try {
      const nextSession = await updateProfile(nextName);
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
    window.localStorage.setItem(demoAuthStorageKey, signedOutValue);
    setSession(null);
    setEditing(false);
    setAuthState("signed-out");
    setStatus("로그아웃되었습니다.");
  }

  if (authState === "signed-out") {
    return (
      <div className="rounded-[12px] border border-[#eee] bg-[#29292d] p-6 text-white" data-account-panel data-auth-state="signed-out">
        <p className="text-[14px] font-bold text-[#ffe92e]">Ticketground MEMBERS</p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-[30px] font-bold">로그인이 필요합니다</h1>
            <p className="mt-2 text-[15px] text-[#d8d8d8]" data-account-status>
              {status}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="h-11 rounded-[8px] bg-white px-4 text-[14px] font-bold text-[#29292d]" onClick={() => void loadSession()} type="button">
              데모 계정으로 다시 로그인
            </button>
            <Link className="flex h-11 items-center rounded-[8px] border border-white/30 px-4 text-[14px] font-bold text-white" href="/login">
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
    { label: "양도", count: transferableSeatCount, href: "/transfer" },
    { label: "문의", count: inquiryCount, href: "/inquiry" },
  ] as const;

  return (
    <div className="rounded-[12px] border border-[#eee] bg-[#29292d] p-6 text-white" data-account-panel data-auth-state={authState}>
      <p className="text-[14px] font-bold text-[#ffe92e]">Ticketground MEMBERS</p>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="text-[32px] font-bold" data-account-name>
            {displayName} 회원
          </h1>
          <p className="mt-2 text-[15px] text-[#d8d8d8]">
            클린티켓 인증 기기 1대 · 예매 {reservationCount}건 · 양도 가능 {transferableSeatCount}석
          </p>
          <p className="mt-2 text-[13px] font-bold text-white/70" data-account-status>
            {status}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-3 text-center text-[13px] sm:gap-4">
          {counters.map((counter) => (
            <Link
              key={counter.label}
              href={counter.href}
              className="min-w-0 whitespace-nowrap rounded-[6px] px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffe92e]"
            >
              <strong className="block text-[22px]">{counter.count}</strong>
              <span className="text-[#bbb]">{counter.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          className="h-10 rounded-[8px] bg-white px-4 text-[14px] font-bold text-[#29292d] disabled:bg-white/40"
          disabled={authState !== "signed-in"}
          onClick={() => setEditing(true)}
          type="button"
        >
          회원정보 수정
        </button>
        <button
          className="h-10 rounded-[8px] border border-white/30 px-4 text-[14px] font-bold text-white disabled:text-white/45"
          disabled={authState === "loading"}
          onClick={logout}
          type="button"
        >
          로그아웃
        </button>
      </div>

      {editing && (
        <div className="mt-5 rounded-[10px] bg-white p-4 text-[#29292d]" data-account-edit-panel>
          <label className="grid gap-2 text-[14px] font-bold">
            닉네임
            <input
              className="h-11 rounded-[8px] border border-[#ddd] px-3 text-[14px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              maxLength={12}
              onChange={(event) => setDraftName(event.target.value)}
              value={draftName}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="h-10 rounded-[8px] bg-ticketground px-4 text-[14px] font-bold text-white disabled:bg-surface-3 disabled:text-ink-4"
              disabled={saving || !draftName.trim()}
              onClick={saveProfile}
              type="button"
            >
              {saving ? "저장 중" : "저장"}
            </button>
            <button className="h-10 rounded-[8px] border border-[#ddd] px-4 text-[14px] font-bold" onClick={() => setEditing(false)} type="button">
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
