import type { ChartDocument } from "@/types/seat-chart";
import type { SeatChartRecord, SeatChartSummary } from "./types";
import type { InventoryResult } from "./inventory";
import { z } from "zod";

const adminSessionSchema = z.object({
  ok: z.literal(true),
  data: z.object({ csrf: z.string().min(1) }),
});

async function adminMutationHeaders(): Promise<Record<string, string>> {
  const response = await fetch("/api/admin/session", { cache: "no-store", credentials: "include" });
  if (!response.ok) throw new Error("ADMIN_SESSION_REQUIRED");
  const session = adminSessionSchema.parse(await response.json());
  return { "Content-Type": "application/json", "x-tig-csrf": session.data.csrf };
}

export async function apiListCharts(): Promise<SeatChartSummary[]> {
  const res = await fetch("/api/seat-charts", { cache: "no-store", credentials: "include" });
  if (!res.ok) throw new Error("LIST_FAILED");
  const data = (await res.json()) as { charts: SeatChartSummary[] };
  return data.charts;
}

export async function apiGetChart(id: string): Promise<SeatChartRecord> {
  const res = await fetch(`/api/seat-charts/${encodeURIComponent(id)}`, { cache: "no-store", credentials: "include" });
  if (!res.ok) throw new Error("GET_FAILED");
  const data = (await res.json()) as { record: SeatChartRecord };
  return data.record;
}

export async function apiDeleteChart(id: string): Promise<void> {
  const res = await fetch(`/api/seat-charts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
    headers: await adminMutationHeaders(),
  });
  if (!res.ok) throw new Error("DELETE_FAILED");
}

export async function apiSaveChart(
  chart: ChartDocument,
  boundShowSlugs?: readonly string[],
): Promise<SeatChartRecord> {
  const res = await fetch("/api/seat-charts", {
    method: "POST",
    credentials: "include",
    headers: await adminMutationHeaders(),
    body: JSON.stringify({ chart, boundShowSlugs }),
  });
  if (!res.ok) throw new Error("SAVE_FAILED");
  const data = (await res.json()) as { record: SeatChartRecord };
  return data.record;
}

export async function apiPublishChart(
  id: string,
  publish: boolean,
  boundShowSlugs?: readonly string[],
): Promise<SeatChartRecord> {
  const res = await fetch(`/api/seat-charts/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    credentials: "include",
    headers: await adminMutationHeaders(),
    body: JSON.stringify({ publish, boundShowSlugs }),
  });
  if (!res.ok) throw new Error("PUBLISH_FAILED");
  const data = (await res.json()) as { record: SeatChartRecord };
  return data.record;
}

export async function apiChartForShow(slug: string, prices?: {
  vip?: number;
  r?: number;
  s?: number;
  a?: number;
}): Promise<{
  source: "published" | "fallback";
  chart: ChartDocument | null;
  inventory: InventoryResult | null;
  record: { id: string; name: string; boundShowSlugs: readonly string[] } | null;
}> {
  const q = new URLSearchParams();
  if (prices?.vip) q.set("vip", String(prices.vip));
  if (prices?.r) q.set("r", String(prices.r));
  if (prices?.s) q.set("s", String(prices.s));
  if (prices?.a) q.set("a", String(prices.a));
  const res = await fetch(`/api/seat-charts/for-show/${encodeURIComponent(slug)}?${q}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("FETCH_FAILED");
  return res.json();
}
