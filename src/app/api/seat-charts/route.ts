import { NextResponse } from "next/server";
import type { ChartDocument } from "@/types/seat-chart";
import { listSeatCharts, saveSeatChart } from "@/lib/seat-charts/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const list = await listSeatCharts();
  return NextResponse.json({ charts: list });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      chart?: ChartDocument;
      boundShowSlugs?: string[];
    };
    if (!body.chart?.id || !body.chart?.name) {
      return NextResponse.json({ error: "INVALID_CHART" }, { status: 400 });
    }
    const rec = await saveSeatChart({
      chart: body.chart,
      boundShowSlugs: body.boundShowSlugs,
    });
    return NextResponse.json({ ok: true, record: rec });
  } catch (e) {
    return NextResponse.json(
      { error: "SAVE_FAILED", message: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
