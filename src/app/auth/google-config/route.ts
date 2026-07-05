import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function csv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is string => item.length > 0);
}

function googleQaMockEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.TIG_GOOGLE_QA_MOCK_ENABLED === "1" || process.env.NEXT_PUBLIC_GOOGLE_QA_MOCK_ENABLED === "1";
}

export function GET() {
  return NextResponse.json({
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || process.env.TIG_GOOGLE_CLIENT_ID?.trim() || "",
    allowedOrigins: csv(process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS),
    mockEnabled: googleQaMockEnabled(),
  });
}
