import { NextResponse } from "next/server";
import { getShowBySlug } from "@/data/catalog-server";
import { chartToSellableSeats, type SellableTier } from "@/lib/seat-charts/inventory";
import { getPublishedChartForVenue } from "@/lib/seat-charts/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const defaultPrices: Record<SellableTier, number> = {
  VIP: 190000,
  R: 160000,
  S: 120000,
  A: 80000,
};

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const prices: Record<SellableTier, number> = {
    VIP: Number(url.searchParams.get("vip") || defaultPrices.VIP),
    R: Number(url.searchParams.get("r") || defaultPrices.R),
    S: Number(url.searchParams.get("s") || defaultPrices.S),
    A: Number(url.searchParams.get("a") || defaultPrices.A),
  };

  const show = await getShowBySlug(slug);
  const rec = show?.backendVenueId
    ? await getPublishedChartForVenue(show.backendVenueId)
    : null;
  if (!rec) {
    return NextResponse.json({
      ok: true,
      source: "not_ready",
      message: "공연장 좌석 배치도 준비 중",
      record: null,
      inventory: null,
    });
  }

  const inventory = chartToSellableSeats(rec.chart, prices);
  return NextResponse.json({
    ok: true,
    source: "published",
    record: {
      id: rec.id,
      name: rec.chart.name,
      boundVenue: rec.boundVenue,
      updatedAt: rec.updatedAt,
      published: rec.chart.published,
    },
    chart: rec.chart,
    inventory,
  });
}
