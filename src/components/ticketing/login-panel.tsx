"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearSessionUser,
  completeSocialLogin,
  getSession,
  lastLoginProvider,
  rememberLastLoginProvider,
  rememberSessionUser,
  storedSessionUserId,
  TicketgroundApiError,
  type ApiSession,
  type LastLoginProvider,
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

function LastUsedBadge() {
  return (
    <span className="absolute -top-2 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[10px] font-black text-on-ink shadow-[0_2px_8px_rgba(0,0,0,0.25)]">
      최근 로그인
    </span>
  );
}

export function LoginPanel({ initialMode = "login" }: { readonly initialMode?: LoginMode }) {
  const router = useRouter();
  const socialStatusLockRef = useRef(false);
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [profileName, setProfileName] = useState("");
  const [status, setStatus] = useState("로그인 또는 회원가입을 진행해 주세요");
  const [saving, setSaving] = useState(false);
  const [lastProvider, setLastProvider] = useState<LastLoginProvider | null>(null);
  const navigationLocked = session !== null && !session.profileConfirmed;

  const applySession = useCallback((nextSession: ApiSession, message: string) => {
    setSession(nextSession);
    setProfileName(nextSession.name);
    setStatus(message);
  }, []);

  useEffect(() => {
    setLastProvider(lastLoginProvider());
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
          rememberLastLoginProvider(socialProvider);
          setLastProvider(socialProvider);
          window.history.replaceState(null, "", window.location.pathname);
          if (nextSession.profileConfirmed) {
            router.replace("/");
            return;
          }
          applySession(nextSession, `${nextSession.name} ${socialProvider} 세션 연결됨 · 신뢰점수 ${nextSession.trustScore}`);
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
          if (!nextSession.profileConfirmed) {
            applySession(nextSession, `${nextSession.name} 님, 닉네임을 확인하고 프로필을 저장해 주세요`);
            return;
          }
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
    rememberLastLoginProvider("google");
    setLastProvider("google");
    if (nextSession.profileConfirmed) {
      router.push("/");
      return;
    }
    applySession(nextSession, `${nextSession.name} Google 세션 연결됨 · 신뢰점수 ${nextSession.trustScore}`);
  }, [applySession, router]);

  const handleGoogleStatusChange = useCallback((message: string) => {
    if (socialStatusLockRef.current) return;
    setStatus(message);
  }, []);

  const handleSocialMockSession = useCallback((nextSession: ApiSession, provider: "kakao" | "naver") => {
    rememberSessionUser(nextSession);
    rememberLastLoginProvider(provider);
    setLastProvider(provider);
    if (nextSession.profileConfirmed) {
      router.push("/");
      return;
    }
    applySession(nextSession, `${nextSession.name} ${provider} 세션 연결됨 · 신뢰점수 ${nextSession.trustScore}`);
  }, [applySession, router]);

  const handleSocialStatusChange = useCallback((message: string) => {
    if (socialStatusLockRef.current) return;
    setStatus(message);
  }, []);

  return (
    <section className="ticketground-container py-10">
      <div className="mb-3 flex items-center justify-end gap-2">
        {navigationLocked ? (
          <p role="status" aria-live="polite" className="break-keep text-xs font-bold text-ink-3">
            닉네임을 확인하고 프로필을 저장해야 다른 화면으로 이동할&nbsp;수&nbsp;있어요
          </p>
        ) : (
          <LoginHomeLink />
        )}
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
            <div className="relative">
              {lastProvider === "google" && <LastUsedBadge />}
              <GoogleSignInCard onAuthenticated={handleGoogleSession} onStatusChange={handleGoogleStatusChange} />
            </div>
            <SocialLoginButtons
              onAuthenticated={handleSocialMockSession}
              onStatusChange={handleSocialStatusChange}
              highlightProviderId={lastProvider === "kakao" || lastProvider === "naver" ? lastProvider : null}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
