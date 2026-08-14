import { NextResponse } from "next/server";
import { publishSeatChart } from "@/lib/seat-charts/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      publish?: boolean;
      boundShowSlugs?: string[];
    };
    const publish = body.publish !== false;
    const rec = await publishSeatChart(id, publish, body.boundShowSlugs);
    if (!rec) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true, record: rec });
  } catch (e) {
    return NextResponse.json(
      { error: "PUBLISH_FAILED", message: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
