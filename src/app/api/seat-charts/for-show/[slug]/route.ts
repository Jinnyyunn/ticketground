import { NextResponse } from "next/server";
import { chartToSellableSeats, type SellableTier } from "@/lib/seat-charts/inventory";
import { getPublishedChartForShow } from "@/lib/seat-charts/store";

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

  const rec = await getPublishedChartForShow(slug);
  if (!rec) {
    return NextResponse.json({
      ok: true,
      source: "fallback",
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
      boundShowSlugs: rec.boundShowSlugs,
      updatedAt: rec.updatedAt,
      published: rec.chart.published,
    },
    chart: rec.chart,
    inventory,
  });
}
