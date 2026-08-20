import { NextResponse } from "next/server";
import type { ChartDocument } from "@/types/seat-chart";
import { seatChartVenueSchema } from "@/lib/seat-charts/types";
import { deleteSeatChart, getSeatChart, saveSeatChart } from "@/lib/seat-charts/store";
import { revokeServiceCredential, seatChartServiceCredentialRoot } from "@/lib/seat-charts/service-credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const rec = await getSeatChart(id);
  if (!rec) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ record: rec });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const body = (await request.json()) as {
      chart?: ChartDocument;
      boundVenue?: unknown;
    };
    if (!body.chart) {
      return NextResponse.json({ error: "INVALID_CHART" }, { status: 400 });
    }
    const venueResult = seatChartVenueSchema.nullable().optional().safeParse(body.boundVenue);
    if (!venueResult.success) {
      return NextResponse.json({ error: "INVALID_VENUE" }, { status: 400 });
    }
    const chart = { ...body.chart, id };
    const rec = await saveSeatChart({
      chart,
      boundVenue: venueResult.data,
    });
    return NextResponse.json({ ok: true, record: rec });
  } catch (e) {
    return NextResponse.json(
      { error: "SAVE_FAILED", message: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (id.startsWith("sck_")) {
    const record = await revokeServiceCredential(seatChartServiceCredentialRoot, id);
    if (!record) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true, revokedAt: record.revokedAt });
  }
  const ok = await deleteSeatChart(id);
  if (!ok) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
