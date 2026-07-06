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

function isConfigured(...envNames: readonly string[]) {
  return envNames.some((name) => Boolean(runtimeEnv(name)));
}

export function GET(request: Request) {
  const mockEnabled = socialQaMockEnabled(request);

  return NextResponse.json({
    kakaoConfigured: isConfigured("TIG_KAKAO_REST_API_KEY", "TIG_KAKAO_CLIENT_ID"),
    naverConfigured: isConfigured("TIG_NAVER_CLIENT_ID"),
    mockEnabled,
    preferMock: mockEnabled,
  });
}
