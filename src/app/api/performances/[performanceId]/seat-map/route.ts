import { NextResponse } from "next/server";
import { getTicketShows } from "@/data/catalog-server";
import { chartToSellableSeats, type SellableTier } from "@/lib/seat-charts/inventory";
import { getVenueActiveRevision } from "@/lib/seat-charts/revisions";
import { getPublishedChartForVenue } from "@/lib/seat-charts/store";
import { seatChartStoreRoot } from "@/lib/seat-charts/v2-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fallbackPrices: Record<SellableTier, number> = { VIP: 190000, R: 160000, S: 120000, A: 80000 };

export async function GET(request: Request, context: { params: Promise<{ performanceId: string }> }) {
  const { performanceId } = await context.params;
  const shows = await getTicketShows();
  const show = shows.find((candidate) => candidate.backendPerformances.some((performance) => performance.id === performanceId));
  if (!show?.backendVenueId || !show.backendEventId) {
    return NextResponse.json({ error: "PERFORMANCE_NOT_FOUND" }, { status: 404 });
  }
  const record = await getPublishedChartForVenue(show.backendVenueId);
  if (!record) {
    return NextResponse.json({ status: "not_ready", message: "공연장 좌석 배치도 준비 중", performanceId }, { status: 409 });
  }
  const prices = Object.fromEntries(Object.entries(fallbackPrices).map(([tier, fallback]) => [tier, show.prices.find((price) => price.grade === tier)?.price ?? fallback])) as Record<SellableTier, number>;
  const active = await getVenueActiveRevision(seatChartStoreRoot, show.backendVenueId);
  const origin = new URL(request.url).origin;
  const liveResponse = await fetch(`${origin}/api/seat-map?${new URLSearchParams({ eventId: show.backendEventId, performanceDateId: performanceId })}`, { cache: "no-store" });
  if (!liveResponse.ok) return NextResponse.json({ error: "LIVE_INVENTORY_UNAVAILABLE" }, { status: 503 });
  const live = (await liveResponse.json()) as unknown;
  return NextResponse.json({
    status: "ready",
    performanceId,
    chartKey: record.id,
    revisionId: active?.revisionId,
    chart: record.chart,
    layout: chartToSellableSeats(record.chart, prices),
    live,
  }, { headers: { "Cache-Control": "no-store" } });
}
