"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearSessionUser,
  completeSocialLogin,
  getSession,
  rememberSessionUser,
  storedSessionUserId,
  TicketgroundApiError,
  type ApiSession,
  type SocialLoginProvider,
  updateProfile,
} from "@/lib/ticketground-api";
import { GoogleSignInCard } from "@/components/ticketing/google-sign-in-card";
import { LoginHomeLink } from "@/components/ticketing/login-home-link";
import { LoginHeroAside } from "@/components/ticketing/login-hero-aside";
import { LoginModeTabs } from "@/components/ticketing/login-mode-tabs";
import { LoginSessionPanel } from "@/components/ticketing/login-session-panel";
import { SocialLoginButtons } from "@/components/ticketing/social-login-buttons";

type LoginMode = "login" | "signup";

const LOGIN_TITLE = "간편 로그인으로 계정을 시작해 주세요";
const LOGIN_DESCRIPTION = "별도 이메일 회원가입 없이 간편 로그인 완료 시 티켓그라운드 계정이 생성됩니다.";

function isSocialLoginProvider(value: string | null): value is SocialLoginProvider {
  return value === "kakao" || value === "naver";
}

export function LoginPanel({ initialMode = "login" }: { readonly initialMode?: LoginMode }) {
  const router = useRouter();
  const socialStatusLockRef = useRef(false);
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [profileName, setProfileName] = useState("");
  const [status, setStatus] = useState("로그인 또는 회원가입을 진행해 주세요");
  const [saving, setSaving] = useState(false);

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
      if (!mounted) return;
      setStatus("로그인 또는 회원가입을 진행해 주세요");
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

  const handleSocialMockSession = useCallback((nextSession: ApiSession, provider: "kakao" | "naver") => {
    rememberSessionUser(nextSession);
    applySession(nextSession, `${nextSession.name} ${provider} 세션 연결됨 · 신뢰점수 ${nextSession.trustScore}`);
  }, [applySession]);

  const handleSocialStatusChange = useCallback((message: string) => {
    if (socialStatusLockRef.current) return;
    setStatus(message);
  }, []);

  return (
    <section className="ticketground-container py-10">
      <div className="mb-3 flex justify-end">
        <LoginHomeLink />
      </div>

      <div className="grid overflow-hidden rounded-xl border border-line bg-card shadow-ticket-2 lg:grid-cols-[0.92fr_1.08fr]">
        <LoginHeroAside />

        <div className="p-6 sm:p-8 lg:p-10">
          <LoginModeTabs mode={mode} onChange={setMode} />

          <div className="mt-8">
            <p className="text-sm font-black text-ticketground">{mode === "login" ? "로그인" : "회원가입"}</p>
            <h2 className="balanced-title mt-2 text-[24px] font-black leading-tight text-ink sm:text-4xl">
              {LOGIN_TITLE}
            </h2>
            <p className="mt-3 text-sm leading-loose text-ink-3">
              {LOGIN_DESCRIPTION}
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
            <SocialLoginButtons onAuthenticated={handleSocialMockSession} onStatusChange={handleSocialStatusChange} />
          </div>
        </div>
      </div>
    </section>
  );
}
