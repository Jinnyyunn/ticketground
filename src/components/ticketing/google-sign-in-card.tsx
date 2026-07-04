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
  readonly renderButton: (
    parent: HTMLElement,
    options: {
      readonly locale: "ko";
      readonly logo_alignment: "left";
      readonly shape: "rectangular";
      readonly size: "large";
      readonly text: "signin_with";
      readonly theme: "outline";
      readonly type: "standard";
      readonly width: number;
    },
  ) => void;
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

const GOOGLE_AUTH_SCOPE = "openid email profile";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_CONFIG_URL = "/auth/google-config";

type GoogleConfig = {
  readonly clientId: string;
  readonly allowedOrigins: readonly string[];
};

type GoogleSignInCardProps = {
  readonly onAuthenticated: (session: ApiSession) => void;
  readonly onStatusChange: (message: string) => void;
};

type GoogleCredentialHandler = (response: GoogleCredentialResponse) => void;
type GoogleOriginSupport = "checking" | "supported" | "unsupported";

let initializedGoogleClientId = "";
let activeGoogleCredentialHandler: GoogleCredentialHandler | null = null;

function handleGlobalGoogleCredential(response: GoogleCredentialResponse) {
  activeGoogleCredentialHandler?.(response);
}

function currentOriginCanLoadGoogleIdentityServices(allowedOrigins: readonly string[]) {
  if (typeof window === "undefined") return true;
  if (window.google?.accounts.id) return true;
  return new Set(allowedOrigins).has(window.location.origin);
}

export function GoogleSignInCard({ onAuthenticated, onStatusChange }: GoogleSignInCardProps) {
  const [googleConfig, setGoogleConfig] = useState<GoogleConfig | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [originSupport, setOriginSupport] = useState<GoogleOriginSupport>("checking");
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = googleConfig?.clientId ?? "";

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
    let cancelled = false;
    const loadGoogleConfig = async () => {
      try {
        const response = await fetch(GOOGLE_CONFIG_URL);
        const payload = (await response.json()) as Partial<GoogleConfig>;
        if (cancelled) return;
        setGoogleConfig({
          clientId: typeof payload.clientId === "string" ? payload.clientId : "",
          allowedOrigins: Array.isArray(payload.allowedOrigins) ? payload.allowedOrigins.filter((origin): origin is string => typeof origin === "string") : [],
        });
      } catch {
        if (!cancelled) {
          setGoogleConfig({ clientId: "", allowedOrigins: [] });
          onStatusChange("Google 로그인 설정을 불러오지 못했습니다.");
        }
      }
    };
    void loadGoogleConfig();
    return () => {
      cancelled = true;
    };
  }, [onStatusChange]);

  useEffect(() => {
    if (googleConfig === null) return;
    if (!googleClientId) {
      onStatusChange("Google 로그인 클라이언트 ID가 설정되지 않았습니다.");
      return;
    }
    const timer = window.setTimeout(() => {
      setOriginSupport(currentOriginCanLoadGoogleIdentityServices(googleConfig.allowedOrigins) ? "supported" : "unsupported");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [googleClientId, googleConfig, onStatusChange]);

  useEffect(() => {
    if (!googleClientId || originSupport !== "supported") {
      return;
    }

    let cancelled = false;
    activeGoogleCredentialHandler = handleGoogleCredential;
    function clearGoogleHandler() {
      cancelled = true;
      if (activeGoogleCredentialHandler === handleGoogleCredential) {
        activeGoogleCredentialHandler = null;
      }
    }

    function initializeGoogleButton() {
      const googleId = window.google?.accounts.id;
      const buttonHost = googleButtonRef.current;
      if (!googleId || !buttonHost || cancelled) return;
      if (initializedGoogleClientId !== googleClientId) {
        googleId.initialize({
          client_id: googleClientId,
          callback: handleGlobalGoogleCredential,
          ux_mode: "popup",
        });
        initializedGoogleClientId = googleClientId;
      }
      buttonHost.replaceChildren();
      googleId.renderButton(buttonHost, {
        locale: "ko",
        logo_alignment: "left",
        shape: "rectangular",
        size: "large",
        text: "signin_with",
        theme: "outline",
        type: "standard",
        width: Math.max(240, Math.floor(buttonHost.getBoundingClientRect().width || 400)),
      });
      setGoogleReady(true);
    }

    if (window.google?.accounts.id) {
      initializeGoogleButton();
      return clearGoogleHandler;
    }

    const handleScriptError = () => onStatusChange("Google 로그인 스크립트를 불러오지 못했습니다.");
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    const script = existingScript ?? document.createElement("script");
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", initializeGoogleButton);
    script.addEventListener("error", handleScriptError);
    if (!existingScript) document.head.appendChild(script);

    return () => {
      clearGoogleHandler();
      script.removeEventListener("load", initializeGoogleButton);
      script.removeEventListener("error", handleScriptError);
    };
  }, [googleClientId, handleGoogleCredential, onStatusChange, originSupport]);

  if (!googleClientId) {
    return (
      <button
        type="button"
        disabled
        className="h-12 w-full rounded-[8px] border border-line bg-white text-[15px] font-black text-ink-4"
        data-google-client-id=""
        data-google-scope={GOOGLE_AUTH_SCOPE}
      >
        Google 계정으로 로그인하기
      </button>
    );
  }

  if (originSupport === "unsupported") {
    return (
      <button
        type="button"
        onClick={() => onStatusChange("Google 로그인은 승인된 도메인에서만 사용할 수 있습니다.")}
        className="flex h-12 w-full items-center justify-center rounded-[8px] border border-line bg-white px-4 text-[15px] font-black text-ink transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        data-google-client-id={googleClientId}
        data-google-scope={GOOGLE_AUTH_SCOPE}
        data-google-ready="false"
        data-google-origin-supported="false"
      >
        Google 계정으로 로그인하기
      </button>
    );
  }

  return (
    <div
      aria-label="Google 계정으로 로그인하기"
      className="relative h-12 w-full overflow-hidden rounded-[8px] bg-white"
      data-google-client-id={googleClientId}
      data-google-scope={GOOGLE_AUTH_SCOPE}
      data-google-ready={googleReady ? "true" : "false"}
      data-google-origin-supported={originSupport}
    >
      <div
        ref={googleButtonRef}
        className={googleReady ? "h-full w-full" : "pointer-events-none h-full w-full opacity-0"}
      />
      {!googleReady ? (
        <button
          type="button"
          onClick={() => onStatusChange("Google 로그인 버튼을 불러오는 중입니다.")}
          className="absolute inset-0 flex h-12 w-full items-center justify-center rounded-[8px] border border-line bg-white px-4 text-[15px] font-black text-ink transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          Google 계정으로 로그인하기
        </button>
      ) : null}
    </div>
  );
}
