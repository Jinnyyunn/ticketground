"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  clearSessionUser,
  DEMO_USER_ID,
  getSession,
  storedSessionUserId,
  TicketgroundApiError,
  type ApiSession,
  rememberSessionUser,
  updateProfile,
} from "@/lib/ticketground-api";
import { GoogleSignInCard } from "@/components/ticketing/google-sign-in-card";
import { LoginHomeLink } from "@/components/ticketing/login-home-link";
import { LoginHeroAside } from "@/components/ticketing/login-hero-aside";
import { LoginModeTabs } from "@/components/ticketing/login-mode-tabs";
import { SocialLoginButtons } from "@/components/ticketing/social-login-buttons";

type LoginMode = "login" | "signup";

export function LoginPanel({ initialMode = "login" }: { readonly initialMode?: LoginMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [session, setSession] = useState<ApiSession | null>(null);
  const [profileName, setProfileName] = useState("");
  const [status, setStatus] = useState("세션 확인 대기");
  const [saving, setSaving] = useState(false);
  const [identityChecked, setIdentityChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const canLogin = email.trim().length > 3 && password.length > 3;
  const canSignup = canLogin && name.trim().length > 1 && identityChecked && termsChecked;

  useEffect(() => {
    let mounted = true;
    const loadInitialSession = async () => {
      const storedUserId = storedSessionUserId();
      if (storedUserId) {
        try {
          const nextSession = await getSession(storedUserId);
          if (!mounted) return;
          rememberSessionUser(nextSession);
          router.replace("/");
          return;
        } catch (error: unknown) {
          if (error instanceof TicketgroundApiError && error.code === "USER_NOT_FOUND") {
            clearSessionUser();
          } else {
            if (!mounted) return;
            setStatus(error instanceof Error ? error.message : "세션을 확인하지 못했습니다.");
            return;
          }
        }
      }
      try {
        const nextSession = await getSession(DEMO_USER_ID);
        if (!mounted) return;
        setSession(nextSession);
        setProfileName(nextSession.name);
        setStatus(`${nextSession.name} 세션 연결됨 · 신뢰점수 ${nextSession.trustScore}`);
      } catch (error: unknown) {
        if (!mounted) return;
        setStatus(error instanceof Error ? error.message : "세션을 불러오지 못했습니다.");
      }
    };
    void loadInitialSession();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function saveProfile() {
    const nextName = profileName.trim();
    if (!nextName || !session) return;
    setSaving(true);
    setStatus("프로필 저장 중");
    try {
      const nextSession = await updateProfile(nextName, session.id);
      rememberSessionUser(nextSession);
      setSession(nextSession);
      setProfileName(nextSession.name);
      setStatus(`${nextSession.name} 프로필 저장 완료`);
      router.push("/");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "프로필 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const handleGoogleSession = useCallback((nextSession: ApiSession) => {
    rememberSessionUser(nextSession);
    setSession(nextSession);
    setProfileName(nextSession.name);
    setStatus(`${nextSession.name} Google 세션 연결됨 · 신뢰점수 ${nextSession.trustScore}`);
  }, []);

  async function confirmMockAccount() {
    if (mode === "login" && !canLogin) return;
    if (mode === "signup" && !canSignup) return;

    setStatus(mode === "login" ? "데모 로그인 확인 중" : "데모 회원가입 확인 중");
    try {
      const nextSession = await getSession(DEMO_USER_ID);
      rememberSessionUser(nextSession);
      setSession(nextSession);
      setProfileName(nextSession.name);
      setStatus(mode === "login" ? `${nextSession.name} 데모 세션 연결됨` : `${nextSession.name} 데모 회원가입 완료`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "데모 계정 확인에 실패했습니다.");
    }
  }

  return (
    <section className="ticketground-container py-10">
      <div className="grid overflow-hidden rounded-[20px] border border-line bg-white shadow-ticket-2 lg:grid-cols-[0.92fr_1.08fr]">
        <LoginHeroAside />

        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mb-5 flex justify-end">
            <LoginHomeLink />
          </div>

          <LoginModeTabs mode={mode} onChange={setMode} />

          <div className="mt-8">
            <p className="text-sm font-black text-ticketground">{mode === "login" ? "로그인" : "회원가입"}</p>
            <h2 className="balanced-title mt-2 text-[24px] font-black leading-tight text-ink sm:text-[28px]">
              {mode === "login" ? "예매 내역을 확인해 주세요" : "본인 확인 후 가입을 진행해 주세요"}
            </h2>
            <p className="mt-3 text-sm leading-loose text-ink-3">
              {mode === "login"
                ? `데모 사용자 ${DEMO_USER_ID}의 세션 상태를 함께 확인합니다.`
                : "가입 전용 본인인증과 약관 동의 블록을 포함한 데모 가입 화면입니다."}
            </p>
          </div>

          <div className="mt-5 rounded-[10px] border border-line bg-surface p-4" aria-live="polite">
            <p className="text-sm font-black text-ink">세션 상태</p>
            <p className="mt-1 text-sm font-bold text-ink-3">{status}</p>
            {session && (
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="grid gap-2 text-sm font-black text-ink">
                  닉네임
                  <input
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    maxLength={12}
                    className="h-11 rounded-[8px] border border-line-strong bg-white px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  />
                </label>
                <button
                  type="button"
                  disabled={saving || !profileName.trim()}
                  onClick={saveProfile}
                  className="h-11 self-end rounded-[8px] bg-ink px-4 text-sm font-black text-white disabled:bg-surface-3 disabled:text-ink-4"
                >
                  {saving ? "저장 중" : "프로필 저장"}
                </button>
              </div>
            )}
          </div>

          <div className="mt-7 grid gap-3">
            <GoogleSignInCard onAuthenticated={handleGoogleSession} onStatusChange={setStatus} />
            <SocialLoginButtons />
          </div>

          <div className="my-7 flex items-center gap-3 text-xs font-bold text-ink-4">
            <span className="h-px flex-1 bg-line" aria-hidden />
            이메일 mock 입력
            <span className="h-px flex-1 bg-line" aria-hidden />
          </div>

          <div className="grid gap-4">
            {mode === "signup" && (
              <label className="grid gap-2 text-sm font-black text-ink">
                이름
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-12 rounded-[8px] border border-line-strong px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  placeholder="홍길동"
                />
              </label>
            )}
            <label className="grid gap-2 text-sm font-black text-ink">
              이메일
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 rounded-[8px] border border-line-strong px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                placeholder="qa@ticketground.kr"
              />
            </label>
            <label className="grid gap-2 text-sm font-black text-ink">
              비밀번호
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 rounded-[8px] border border-line-strong px-3 text-sm font-medium text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                placeholder="mock password"
              />
            </label>
          </div>

          {mode === "signup" && (
            <div className="signup-only mt-5 grid gap-3">
              <label className="flex items-start gap-3 rounded-[10px] border border-line bg-surface p-4 text-sm leading-relaxed text-ink-2">
                <input
                  type="checkbox"
                  checked={identityChecked}
                  onChange={(event) => setIdentityChecked(event.target.checked)}
                  className="mt-1 accent-[#1a47ff]"
                />
                <span>
                  <strong className="block text-ink">본인인증 완료</strong>
                  휴대폰 본인확인과 기기 확인을 완료한 것으로 처리하는 mock 블록입니다.
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-[10px] border border-line bg-surface p-4 text-sm leading-relaxed text-ink-2">
                <input
                  type="checkbox"
                  checked={termsChecked}
                  onChange={(event) => setTermsChecked(event.target.checked)}
                  className="mt-1 accent-[#1a47ff]"
                />
                <span>
                  <strong className="block text-ink">필수 약관 동의</strong>
                  이용약관, 개인정보 처리, 클린티켓 정책 안내를 확인했습니다.
                </span>
              </label>
            </div>
          )}

          <button
            type="button"
            disabled={mode === "login" ? !canLogin : !canSignup}
            onClick={confirmMockAccount}
            className="mt-6 h-12 w-full rounded-[8px] bg-ticketground text-[16px] font-black text-white transition enabled:hover:bg-ticketground/90 disabled:bg-surface-3 disabled:text-ink-4"
          >
            {mode === "login" ? "mock 로그인 확인" : "mock 회원가입 완료"}
          </button>
        </div>
      </div>
    </section>
  );
}
