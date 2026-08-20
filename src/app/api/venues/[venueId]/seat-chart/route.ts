import { NextResponse } from "next/server";
import { publicSeatChartRevision, seatChartEtag } from "@/lib/seat-charts/public-revision";
import { getPublishedSeatChartRevision } from "@/lib/seat-charts/store";
import { getVenueActiveRevision } from "@/lib/seat-charts/revisions";
import { seatChartStoreRoot } from "@/lib/seat-charts/v2-store";
import { authorizeSeatChartService } from "@/lib/seat-charts/service-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ venueId: string }> }) {
  const authorization = await authorizeSeatChartService(request, "seat-chart:read");
  if (!authorization.ok) return NextResponse.json({ error: authorization.status === 429 ? "RATE_LIMITED" : "SERVICE_KEY_REQUIRED" }, { status: authorization.status });
  const { venueId } = await context.params;
  const active = await getVenueActiveRevision(seatChartStoreRoot, venueId);
  if (!active) return NextResponse.json({ status: "not_ready", message: "공연장 좌석 배치도 준비 중" }, { status: 404 });
  const revision = await getPublishedSeatChartRevision(active.chartKey, active.revisionId);
  if (!revision) return NextResponse.json({ status: "not_ready", message: "공연장 좌석 배치도 준비 중" }, { status: 404 });
  const etag = seatChartEtag(revision);
  if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  return NextResponse.json(publicSeatChartRevision(revision), { headers: { ETag: etag, "Cache-Control": "private, max-age=60" } });
}
