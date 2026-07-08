import { NextResponse } from "next/server";
import { requestHostIsPrivatePreview } from "@/lib/auth-preview-host";

export const dynamic = "force-dynamic";

function csv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is string => item.length > 0);
}

function runtimeEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function forceProviderMode() {
  return runtimeEnv("TIG_AUTH_FORCE_PROVIDER") === "1";
}

function googleQaMockEnabled(request: Request) {
  return (
    !forceProviderMode() &&
    (process.env.NODE_ENV !== "production" ||
      requestHostIsPrivatePreview(request) ||
      runtimeEnv("TIG_GOOGLE_QA_MOCK_ENABLED") === "1" ||
      runtimeEnv("NEXT_PUBLIC_GOOGLE_QA_MOCK_ENABLED") === "1")
  );
}

// Real credentials must win over host/env-based mock detection, regardless of
// how the request looks (localhost, private IP, NODE_ENV). Mock only exists as
// a fallback for a missing client id, or when explicitly requested via a QA
// flag. See 간편로그인-수정금지-지침.md.
function googleQaExplicitOverride() {
  return (
    !forceProviderMode() &&
    (runtimeEnv("TIG_GOOGLE_QA_MOCK_ENABLED") === "1" || runtimeEnv("NEXT_PUBLIC_GOOGLE_QA_MOCK_ENABLED") === "1")
  );
}

export function GET(request: Request) {
  const clientId = runtimeEnv("TIG_GOOGLE_CLIENT_ID") || runtimeEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID");

  return NextResponse.json({
    clientId,
    allowedOrigins: csv(runtimeEnv("NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS")),
    mockEnabled: googleQaMockEnabled(request),
    preferMock: googleQaExplicitOverride(),
  });
}
