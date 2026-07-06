"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_USER_ID, getSession, loginWithGoogle, type ApiSession } from "@/lib/ticketground-api";
import { GoogleLogo } from "@/components/ticketing/google-logo";

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
const GOOGLE_FALLBACK_BUTTON_CLASS =
  "flex h-12 w-full items-center justify-center gap-2 rounded-sm border border-neutral-300 bg-white px-4 text-base font-black text-neutral-900 shadow-sm transition-colors hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-white disabled:text-neutral-500 dark:border-neutral-300 dark:bg-white dark:text-neutral-900 dark:hover:border-neutral-400 dark:disabled:bg-white dark:disabled:text-neutral-500";
const GOOGLE_LOADING_BUTTON_CLASS = `absolute inset-0 ${GOOGLE_FALLBACK_BUTTON_CLASS}`;
const GOOGLE_READY_BUTTON_CLASS =
  "relative flex h-12 w-full overflow-hidden items-center justify-center gap-2 rounded-sm border border-neutral-300 bg-white px-4 text-base font-black text-neutral-900 shadow-sm transition-colors hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 dark:border-neutral-300 dark:bg-white dark:text-neutral-900 dark:hover:border-neutral-400";
const GOOGLE_RENDERED_HOST_CLASS =
  "absolute inset-0 z-0 h-full w-full opacity-0 [&>*]:!h-full [&>*]:!w-full [&_iframe]:!h-full [&_iframe]:!w-full";
const GOOGLE_VISIBLE_BUTTON_CLASS = `pointer-events-none absolute inset-0 z-10 ${GOOGLE_FALLBACK_BUTTON_CLASS}`;

type GoogleConfig = {
  readonly clientId: string;
  readonly allowedOrigins: readonly string[];
  readonly mockEnabled: boolean;
  readonly preferMock: boolean;
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
          mockEnabled: payload.mockEnabled === true,
          preferMock: payload.preferMock === true,
        });
      } catch {
        if (!cancelled) {
          setGoogleConfig({ clientId: "", allowedOrigins: [], mockEnabled: false, preferMock: false });
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

  async function handleMockGoogleLogin() {
    onStatusChange("Google QA mock 세션 확인 중");
    try {
      onAuthenticated(await getSession(DEMO_USER_ID));
    } catch (error) {
      onStatusChange(error instanceof Error ? error.message : "Google QA mock 로그인에 실패했습니다.");
    }
  }

  if (!googleClientId) {
    if (googleConfig?.mockEnabled) {
      return (
        <button
          type="button"
          onClick={handleMockGoogleLogin}
          className={GOOGLE_FALLBACK_BUTTON_CLASS}
          data-google-client-id=""
          data-google-scope={GOOGLE_AUTH_SCOPE}
          data-google-ready="mock"
        >
          <GoogleLogo />
          Google 계정으로 로그인하기
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled
        className={GOOGLE_FALLBACK_BUTTON_CLASS}
        data-google-client-id=""
        data-google-scope={GOOGLE_AUTH_SCOPE}
      >
        <GoogleLogo />
        Google 계정으로 로그인하기
      </button>
    );
  }

  if (googleConfig?.preferMock) {
    return (
      <button
        type="button"
        onClick={handleMockGoogleLogin}
        className={GOOGLE_FALLBACK_BUTTON_CLASS}
        data-google-client-id={googleClientId}
        data-google-scope={GOOGLE_AUTH_SCOPE}
        data-google-ready="mock"
        data-google-origin-supported="mock"
      >
        <GoogleLogo />
        Google 계정으로 로그인하기
      </button>
    );
  }

  if (originSupport === "unsupported") {
    return (
      <button
        type="button"
        onClick={() => onStatusChange("Google 로그인은 승인된 도메인에서만 사용할 수 있습니다.")}
        className={GOOGLE_FALLBACK_BUTTON_CLASS}
        data-google-client-id={googleClientId}
        data-google-scope={GOOGLE_AUTH_SCOPE}
        data-google-ready="false"
        data-google-origin-supported="false"
      >
        <GoogleLogo />
        Google 계정으로 로그인하기
      </button>
    );
  }

  return (
    <div
      role="button"
      aria-label="Google 계정으로 로그인하기"
      className={GOOGLE_READY_BUTTON_CLASS}
      data-google-client-id={googleClientId}
      data-google-scope={GOOGLE_AUTH_SCOPE}
      data-google-ready={googleReady ? "true" : "false"}
      data-google-origin-supported={originSupport}
    >
      <div
        ref={googleButtonRef}
        aria-hidden="true"
        className={GOOGLE_RENDERED_HOST_CLASS}
      />
      {!googleReady ? (
        <button
          type="button"
          onClick={() => onStatusChange("Google 로그인 버튼을 불러오는 중입니다.")}
          className={GOOGLE_LOADING_BUTTON_CLASS}
        >
          <GoogleLogo />
          Google 계정으로 로그인하기
        </button>
      ) : (
        <div aria-hidden="true" className={GOOGLE_VISIBLE_BUTTON_CLASS}>
          <GoogleLogo />
          Google 계정으로 로그인하기
        </div>
      )}
    </div>
  );
}
