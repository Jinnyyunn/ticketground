"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearSessionUser,
  completeSocialLogin,
  DEMO_USER_ID,
  getSession,
  storedSessionUserId,
  TicketgroundApiError,
  type ApiSession,
  type SocialLoginProvider,
  rememberSessionUser,
  updateProfile,
} from "@/lib/ticketground-api";
import { GoogleSignInCard } from "@/components/ticketing/google-sign-in-card";
import { LoginHomeLink } from "@/components/ticketing/login-home-link";
import { LoginHeroAside } from "@/components/ticketing/login-hero-aside";
import { LoginModeTabs } from "@/components/ticketing/login-mode-tabs";
import { LoginMockForm } from "@/components/ticketing/login-mock-form";
import { LoginSessionPanel } from "@/components/ticketing/login-session-panel";
import { SocialLoginButtons } from "@/components/ticketing/social-login-buttons";

type LoginMode = "login" | "signup";

function isSocialLoginProvider(value: string | null): value is SocialLoginProvider {
  return value === "kakao" || value === "naver";
}

export function LoginPanel({ initialMode = "login" }: { readonly initialMode?: LoginMode }) {
  const router = useRouter();
  const socialStatusLockRef = useRef(false);
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

  const applySession = useCallback((nextSession: ApiSession, message: string) => {
    setSession(nextSession);
    setProfileName(nextSession.name);
    setStatus(message);
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadInitialSession = async () => {
      const activeSearchParams = new URLSearchParams(window.location.search);
      const socialProvider = activeSearchParams.get("socialProvider")?.trim() || null;
      const socialError = activeSearchParams.get("socialError")?.trim();
      if (socialError) {
        socialStatusLockRef.current = true;
        clearSessionUser();
        setSession(null);
        setProfileName("");
        setStatus(`${socialError} 소셜 로그인 요청을 처리하지 못했습니다.`);
        return;
      }
      if (isSocialLoginProvider(socialProvider)) {
        socialStatusLockRef.current = true;
        setStatus(`${socialProvider} 세션 확인 중`);
        try {
          const nextSession = await completeSocialLogin(socialProvider);
          if (!mounted) return;
          rememberSessionUser(nextSession);
          applySession(nextSession, `${nextSession.name} ${socialProvider} 세션 연결됨 · 신뢰점수 ${nextSession.trustScore}`);
          window.history.replaceState(null, "", window.location.pathname);
          return;
        } catch (error: unknown) {
          if (!mounted) return;
          setStatus(error instanceof Error ? error.message : "소셜 세션을 확인하지 못했습니다.");
          clearSessionUser();
          setSession(null);
          setProfileName("");
          return;
        }
      }
      if (socialProvider) {
        socialStatusLockRef.current = true;
        clearSessionUser();
        setSession(null);
        setProfileName("");
        setStatus("지원하지 않는 소셜 로그인 요청입니다.");
        return;
      }

      socialStatusLockRef.current = false;
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
        applySession(nextSession, `${nextSession.name} 세션 연결됨 · 신뢰점수 ${nextSession.trustScore}`);
      } catch (error: unknown) {
        if (!mounted) return;
        setStatus(error instanceof Error ? error.message : "세션을 불러오지 못했습니다.");
      }
    };
    void loadInitialSession();
    return () => { mounted = false; };
  }, [applySession, router]);

  async function saveProfile() {
    const nextName = profileName.trim();
    if (!nextName || !session) return;
    setSaving(true);
    setStatus("프로필 저장 중");
    try {
      const nextSession = await updateProfile(nextName, session.id);
      rememberSessionUser(nextSession);
      applySession(nextSession, `${nextSession.name} 프로필 저장 완료`);
      router.push("/");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "프로필 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const handleGoogleSession = useCallback((nextSession: ApiSession) => {
    rememberSessionUser(nextSession);
    applySession(nextSession, `${nextSession.name} Google 세션 연결됨 · 신뢰점수 ${nextSession.trustScore}`);
  }, [applySession]);

  const handleGoogleStatusChange = useCallback((message: string) => {
    if (socialStatusLockRef.current) return;
    setStatus(message);
  }, []);

  async function confirmMockAccount() {
    if (mode === "login" && !canLogin) return;
    if (mode === "signup" && !canSignup) return;

    setStatus(mode === "login" ? "데모 로그인 확인 중" : "데모 회원가입 확인 중");
    try {
      const nextSession = await getSession(DEMO_USER_ID);
      rememberSessionUser(nextSession);
      applySession(nextSession, mode === "login" ? `${nextSession.name} 데모 세션 연결됨` : `${nextSession.name} 데모 회원가입 완료`);
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

          <LoginSessionPanel
            onProfileNameChange={setProfileName}
            onSaveProfile={saveProfile}
            profileName={profileName}
            saving={saving}
            session={session}
            status={status}
          />

          <div className="mx-auto mt-7 grid w-full max-w-[400px] gap-3">
            <GoogleSignInCard onAuthenticated={handleGoogleSession} onStatusChange={handleGoogleStatusChange} />
            <SocialLoginButtons />
          </div>

          <div className="my-7 flex items-center gap-3 text-xs font-bold text-ink-4">
            <span className="h-px flex-1 bg-line" aria-hidden />
            이메일 mock 입력
            <span className="h-px flex-1 bg-line" aria-hidden />
          </div>

          <LoginMockForm
            canLogin={canLogin}
            canSignup={canSignup}
            email={email}
            identityChecked={identityChecked}
            mode={mode}
            name={name}
            onConfirm={confirmMockAccount}
            onEmailChange={setEmail}
            onIdentityCheckedChange={setIdentityChecked}
            onNameChange={setName}
            onPasswordChange={setPassword}
            onTermsCheckedChange={setTermsChecked}
            password={password}
            termsChecked={termsChecked}
          />
        </div>
      </div>
    </section>
  );
}
