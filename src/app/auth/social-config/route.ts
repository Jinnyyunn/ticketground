import { NextResponse } from "next/server";
import { requestHostIsPrivatePreview } from "@/lib/auth-preview-host";

export const dynamic = "force-dynamic";

function runtimeEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function forceProviderMode() {
  return runtimeEnv("TIG_AUTH_FORCE_PROVIDER") === "1";
}

function socialQaMockEnabled(request: Request) {
  return (
    !forceProviderMode() &&
    (process.env.NODE_ENV !== "production" ||
      requestHostIsPrivatePreview(request) ||
      runtimeEnv("TIG_SOCIAL_QA_MOCK_ENABLED") === "1" ||
      runtimeEnv("NEXT_PUBLIC_SOCIAL_QA_MOCK_ENABLED") === "1")
  );
}

// Real credentials must win over host/env-based mock detection, regardless of
// how the request looks (localhost, private IP, NODE_ENV). Mock only exists as
// a fallback for providers that have no credentials configured at all, or when
// explicitly requested via a QA flag. See 간편로그인-수정금지-지침.md.
function socialQaExplicitOverride() {
  return (
    !forceProviderMode() &&
    (runtimeEnv("TIG_SOCIAL_QA_MOCK_ENABLED") === "1" || runtimeEnv("NEXT_PUBLIC_SOCIAL_QA_MOCK_ENABLED") === "1")
  );
}

function isConfigured(...envNames: readonly string[]) {
  return envNames.some((name) => Boolean(runtimeEnv(name)));
}

export function GET(request: Request) {
  return NextResponse.json({
    kakaoConfigured: isConfigured("TIG_KAKAO_REST_API_KEY", "TIG_KAKAO_CLIENT_ID"),
    naverConfigured: isConfigured("TIG_NAVER_CLIENT_ID"),
    mockEnabled: socialQaMockEnabled(request),
    preferMock: socialQaExplicitOverride(),
  });
}
