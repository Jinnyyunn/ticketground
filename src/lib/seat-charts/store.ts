import { promises as fs } from "node:fs";
import path from "node:path";
import type { ChartDocument } from "@/types/seat-chart";
import { countPlaces } from "@/lib/seat-designer/chart-ops";
import type { SeatChartRecord, SeatChartSummary } from "./types";

const STORE_DIR = path.join(process.cwd(), "data", "seat-charts");

async function ensureDir() {
  await fs.mkdir(STORE_DIR, { recursive: true });
}

function filePath(id: string) {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(STORE_DIR, `${safe}.json`);
}

export async function listSeatCharts(): Promise<SeatChartSummary[]> {
  await ensureDir();
  const files = await fs.readdir(STORE_DIR);
  const out: SeatChartSummary[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(STORE_DIR, file), "utf8");
      const rec = JSON.parse(raw) as SeatChartRecord;
      out.push(toSummary(rec));
    } catch {
      /* skip corrupt */
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getSeatChart(id: string): Promise<SeatChartRecord | null> {
  await ensureDir();
  try {
    const raw = await fs.readFile(filePath(id), "utf8");
    return JSON.parse(raw) as SeatChartRecord;
  } catch {
    return null;
  }
}

export async function saveSeatChart(input: {
  chart: ChartDocument;
  boundShowSlugs?: readonly string[];
  preserveBindings?: boolean;
}): Promise<SeatChartRecord> {
  await ensureDir();
  const existing = await getSeatChart(input.chart.id);
  const now = new Date().toISOString();
  const boundShowSlugs = input.boundShowSlugs
    ? [...input.boundShowSlugs]
    : input.preserveBindings && existing
      ? [...existing.boundShowSlugs]
      : existing
        ? [...existing.boundShowSlugs]
        : [];

  const rec: SeatChartRecord = {
    id: input.chart.id,
    chart: input.chart,
    boundShowSlugs,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await fs.writeFile(filePath(rec.id), JSON.stringify(rec, null, 2), "utf8");
  return rec;
}

export async function deleteSeatChart(id: string): Promise<boolean> {
  try {
    await fs.unlink(filePath(id));
    return true;
  } catch {
    return false;
  }
}

export async function publishSeatChart(
  id: string,
  publish: boolean,
  boundShowSlugs?: readonly string[],
): Promise<SeatChartRecord | null> {
  const existing = await getSeatChart(id);
  if (!existing) return null;
  const chart: ChartDocument = {
    ...existing.chart,
    published: publish,
    publishedAt: publish ? new Date().toISOString() : undefined,
  };
  return saveSeatChart({
    chart,
    boundShowSlugs: boundShowSlugs ?? existing.boundShowSlugs,
  });
}

export async function getPublishedChartForShow(slug: string): Promise<SeatChartRecord | null> {
  const all = await listSeatCharts();
  // Prefer published + bound to slug
  for (const summary of all) {
    if (!summary.published) continue;
    if (!summary.boundShowSlugs.includes(slug)) continue;
    const full = await getSeatChart(summary.id);
    if (full) return full;
  }
  // Fallback: any published chart (first)
  for (const summary of all) {
    if (!summary.published) continue;
    const full = await getSeatChart(summary.id);
    if (full) return full;
  }
  return null;
}

function toSummary(rec: SeatChartRecord): SeatChartSummary {
  return {
    id: rec.id,
    name: rec.chart.name,
    published: Boolean(rec.chart.published),
    publishedAt: rec.chart.publishedAt,
    placeCount: countPlaces(rec.chart),
    boundShowSlugs: rec.boundShowSlugs,
    updatedAt: rec.updatedAt,
    venueType: rec.chart.venueType,
  };
}
