"use client";

import { useEffect, useState } from "react";
import { DEMO_USER_ID, getSession, type ApiSession } from "@/lib/ticketground-api";

type SocialProviderId = "kakao" | "naver";

const socialProviders = [
  {
    id: "kakao" as const,
    name: "카카오톡",
    label: "카카오톡 계정으로 로그인하기",
    href: "/api/auth/kakao/start",
    tone: "border-[#FFDE32] bg-[#FFDE32] text-[#2D1B1B] hover:bg-[#F7D51F]",
  },
  {
    id: "naver" as const,
    name: "네이버",
    label: "네이버 계정으로 로그인하기",
    href: "/api/auth/naver/start",
    tone: "border-[#03C75A] bg-[#03C75A] text-white hover:bg-[#02B351]",
  },
];

function KakaoLogo() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 32 32" className="size-6 shrink-0">
      <circle cx="16" cy="16" r="15" fill="#FFDE32" />
      <path
        fill="#3A2929"
        d="M16 8.2c-5.38 0-9.75 3.42-9.75 7.64 0 2.64 1.73 4.97 4.35 6.34l-.86 3.04a.46.46 0 0 0 .7.5l3.42-2.25c.7.13 1.42.2 2.14.2 5.38 0 9.75-3.42 9.75-7.64S21.38 8.2 16 8.2Z"
      />
    </svg>
  );
}

function NaverLogo() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="size-5 shrink-0">
      <rect width="24" height="24" rx="3" fill="#03C75A" />
      <path fill="#fff" d="M14.64 12.3 9.16 4.8H4.62v14.4h4.74v-7.5l5.48 7.5h4.54V4.8h-4.74v7.5Z" />
    </svg>
  );
}

type SocialConfig = {
  readonly kakaoConfigured: boolean;
  readonly naverConfigured: boolean;
  readonly mockEnabled: boolean;
};

const SOCIAL_CONFIG_URL = "/auth/social-config";

type SocialLoginButtonsProps = {
  readonly onAuthenticated: (session: ApiSession, provider: SocialProviderId) => void;
  readonly onStatusChange: (message: string) => void;
};

export function SocialLoginButtons({ onAuthenticated, onStatusChange }: SocialLoginButtonsProps) {
  const [config, setConfig] = useState<SocialConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(SOCIAL_CONFIG_URL, { cache: "no-store" });
        const payload = (await response.json()) as Partial<SocialConfig>;
        if (cancelled) return;
        setConfig({
          kakaoConfigured: payload.kakaoConfigured === true,
          naverConfigured: payload.naverConfigured === true,
          mockEnabled: payload.mockEnabled === true,
        });
      } catch {
        if (!cancelled) setConfig({ kakaoConfigured: false, naverConfigured: false, mockEnabled: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleMockLogin(provider: SocialProviderId, name: string) {
    onStatusChange(`${name} QA mock 세션 확인 중`);
    try {
      onAuthenticated(await getSession(DEMO_USER_ID), provider);
    } catch (error) {
      onStatusChange(error instanceof Error ? error.message : `${name} QA mock 로그인에 실패했습니다.`);
    }
  }

  return (
    <>
      {socialProviders.map((provider) => {
        const Icon = provider.id === "kakao" ? KakaoLogo : NaverLogo;
        const className = `flex h-12 items-center justify-center gap-2 rounded-sm border px-4 text-base font-black transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 ${provider.tone}`;
        const configured = config !== null && (provider.id === "kakao" ? config.kakaoConfigured : config.naverConfigured);
        const useMock = config !== null && !configured && config.mockEnabled;

        if (useMock) {
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => handleMockLogin(provider.id, provider.name)}
              className={className}
              data-social-provider={provider.id}
              data-social-ready="mock"
            >
              <Icon />
              {provider.label}
            </button>
          );
        }

        return (
          <a
            key={provider.id}
            href={provider.href}
            className={className}
            data-social-provider={provider.id}
            data-social-ready={configured ? "true" : "false"}
          >
            <Icon />
            {provider.label}
          </a>
        );
      })}
    </>
  );
}
