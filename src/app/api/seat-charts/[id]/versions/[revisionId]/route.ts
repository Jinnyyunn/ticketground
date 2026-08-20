import { NextResponse } from "next/server";
import { publicSeatChartRevision, seatChartEtag } from "@/lib/seat-charts/public-revision";
import { authorizeSeatChartService } from "@/lib/seat-charts/service-auth";
import { getPublishedSeatChartRevision } from "@/lib/seat-charts/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string; revisionId: string }> }) {
  const authorization = await authorizeSeatChartService(request, "seat-chart:read");
  if (!authorization.ok) return NextResponse.json({ error: authorization.status === 429 ? "RATE_LIMITED" : "SERVICE_KEY_REQUIRED" }, { status: authorization.status });
  const { id, revisionId } = await context.params;
  const revision = await getPublishedSeatChartRevision(id, revisionId);
  if (!revision) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const etag = seatChartEtag(revision);
  if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  return NextResponse.json(publicSeatChartRevision(revision), { headers: { ETag: etag, "Cache-Control": "private, max-age=31536000, immutable" } });
}
