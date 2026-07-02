"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loginWithGoogle, type ApiSession } from "@/lib/ticketground-api";

type GoogleCredentialResponse = {
  readonly credential?: string;
};

type GoogleAccountsId = {
  readonly initialize: (options: {
    readonly client_id: string;
    readonly callback: (response: GoogleCredentialResponse) => void;
    readonly ux_mode: "popup";
  }) => void;
  readonly renderButton: (element: HTMLElement, options: {
    readonly shape: "rectangular";
    readonly size: "large";
    readonly text: "signin_with";
    readonly theme: "outline";
    readonly type: "standard";
    readonly width: number;
  }) => void;
};

declare global {
  interface Window {
    readonly google?: {
      readonly accounts: {
        readonly id: GoogleAccountsId;
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const GOOGLE_AUTH_SCOPE = "openid email profile";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

type GoogleSignInCardProps = {
  readonly onAuthenticated: (session: ApiSession) => void;
  readonly onStatusChange: (message: string) => void;
};

export function GoogleSignInCard({ onAuthenticated, onStatusChange }: GoogleSignInCardProps) {
  const [googleReady, setGoogleReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const handleGoogleCredential = useCallback(async (response: GoogleCredentialResponse) => {
    if (!response.credential) {
      onStatusChange("Google 인증 정보를 받지 못했습니다.");
      return;
    }

    onStatusChange("Google 인증 확인 중");
    try {
      onAuthenticated(await loginWithGoogle(response.credential));
    } catch (error) {
      onStatusChange(error instanceof Error ? error.message : "Google 로그인에 실패했습니다.");
    }
  }, [onAuthenticated, onStatusChange]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      onStatusChange("Google 로그인 클라이언트 ID가 설정되지 않았습니다.");
      return;
    }

    let cancelled = false;

    function renderGoogleButton() {
      const target = googleButtonRef.current;
      const googleId = window.google?.accounts.id;
      if (!target || !googleId || cancelled) return;
      target.replaceChildren();
      googleId.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        ux_mode: "popup",
      });
      googleId.renderButton(target, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: Math.min(360, target.clientWidth || 320),
      });
      setGoogleReady(true);
    }

    if (window.google?.accounts.id) {
      renderGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    const handleScriptError = () => onStatusChange("Google 로그인 스크립트를 불러오지 못했습니다.");
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    const script = existingScript ?? document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", renderGoogleButton);
    script.addEventListener("error", handleScriptError);
    if (!existingScript) document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener("load", renderGoogleButton);
      script.removeEventListener("error", handleScriptError);
    };
  }, [handleGoogleCredential, onStatusChange]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div className="rounded-[10px] border border-line bg-white p-4" data-google-client-id="" data-google-scope={GOOGLE_AUTH_SCOPE}>
        <p className="text-sm font-black text-ink">Google로 계속하기</p>
        <p className="mt-1 text-xs font-bold text-ink-4">환경변수 NEXT_PUBLIC_GOOGLE_CLIENT_ID 설정 후 사용할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-line bg-white p-4" data-google-client-id={GOOGLE_CLIENT_ID} data-google-scope={GOOGLE_AUTH_SCOPE}>
      <p className="text-sm font-black text-ink">Google로 계속하기</p>
      <p className="mt-1 text-xs font-bold text-ink-4">이메일과 프로필 확인 범위만 요청합니다.</p>
      <div ref={googleButtonRef} className="mt-3 min-h-10" aria-label="Google 로그인 버튼" />
      {!googleReady && <p className="mt-3 text-sm font-bold text-ink-3">Google 버튼 로드 중</p>}
    </div>
  );
}
