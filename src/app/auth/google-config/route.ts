import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function csv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is string => item.length > 0);
}

export function GET() {
  return NextResponse.json({
    clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || process.env.TIG_GOOGLE_CLIENT_ID?.trim() || "",
    allowedOrigins: csv(process.env.NEXT_PUBLIC_GOOGLE_ALLOWED_ORIGINS),
  });
}
