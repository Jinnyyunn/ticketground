import { NextResponse } from "next/server";
import { seatChartVenueSchema } from "@/lib/seat-charts/types";
import { publishSeatChart, SeatChartValidationError, SeatChartVenueRequiredError } from "@/lib/seat-charts/store";

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
      boundVenue?: unknown;
    };
    const publish = body.publish !== false;
    const venueResult = seatChartVenueSchema.nullable().optional().safeParse(body.boundVenue);
    if (!venueResult.success) {
      return NextResponse.json({ error: "INVALID_VENUE" }, { status: 400 });
    }
    const rec = await publishSeatChart(id, publish, venueResult.data, request.headers.get("x-tig-admin-id") ?? "admin-session");
    if (!rec) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ ok: true, record: rec });
  } catch (e) {
    if (e instanceof SeatChartVenueRequiredError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof SeatChartValidationError) {
      return NextResponse.json({ error: e.message, items: e.items }, { status: 422 });
    }
    return NextResponse.json(
      { error: "PUBLISH_FAILED", message: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
