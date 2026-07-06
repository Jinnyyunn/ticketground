import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function socialQaMockEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.TIG_SOCIAL_QA_MOCK_ENABLED === "1" ||
    process.env.NEXT_PUBLIC_SOCIAL_QA_MOCK_ENABLED === "1"
  );
}

function isConfigured(...envNames: readonly string[]) {
  return envNames.some((name) => Boolean(process.env[name]?.trim()));
}

export function GET() {
  return NextResponse.json({
    kakaoConfigured: isConfigured("TIG_KAKAO_REST_API_KEY", "TIG_KAKAO_CLIENT_ID"),
    naverConfigured: isConfigured("TIG_NAVER_CLIENT_ID"),
    mockEnabled: socialQaMockEnabled(),
  });
}
