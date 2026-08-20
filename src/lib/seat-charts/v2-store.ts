import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import type { ChartDocument, SeatChartDocumentV2 } from "../../types/seat-chart.ts";
import { countPlaces } from "../seat-designer/chart-ops.ts";
import { blockingValidationItems, type ValidationItem } from "../seat-designer/validation.ts";
import { createChartKey, type ChartKey, type RevisionId } from "./keys.ts";
import {
  deactivateVenueRevision,
  getPublishedVenueRevision,
  getSeatChartDraft,
  getVenueActiveRevision,
  publishVenueRevision,
  saveSeatChartDraft,
  type DraftRecord,
} from "./revisions.ts";
import type { SeatChartRecord, SeatChartSummary, SeatChartVenue } from "./types.ts";

const STORE_ROOT = process.env.TIG_SEAT_CHART_DATA_DIR
  ? path.resolve(process.env.TIG_SEAT_CHART_DATA_DIR)
  : path.join(process.cwd(), "data", "seat-chart-v2");

export class SeatChartVenueRequiredError extends Error {
  constructor() {
    super("SEAT_CHART_VENUE_REQUIRED");
    this.name = "SeatChartVenueRequiredError";
  }
}

export class SeatChartValidationError extends Error {
  readonly items: readonly ValidationItem[];

  constructor(items: readonly ValidationItem[]) {
    super("SEAT_CHART_VALIDATION_FAILED");
    this.name = "SeatChartValidationError";
    this.items = items;
  }
}

function isV2(chart: ChartDocument): chart is SeatChartDocumentV2 {
  return "version" in chart && chart.version === 2 && "chartKey" in chart && "draftRevision" in chart;
}

async function recordFromDraft(draft: DraftRecord): Promise<SeatChartRecord> {
  const active = await getVenueActiveRevision(STORE_ROOT, draft.document.venueId);
  const published = active?.chartKey === draft.chartKey;
  return {
    id: draft.chartKey,
    chart: { ...draft.document, published, publishedAt: published ? active.publishedAt : undefined },
    boundVenue: { id: draft.document.venueId, name: draft.document.venueName ?? draft.document.venueId },
    createdAt: draft.updatedAt,
    updatedAt: draft.updatedAt,
  };
}

export async function listSeatCharts(): Promise<SeatChartSummary[]> {
  let files: string[];
  try {
    files = await readdir(path.join(STORE_ROOT, "drafts"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const records = await Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => {
    const chartKey = file.slice(0, -5) as ChartKey;
    const draft = await getSeatChartDraft(STORE_ROOT, chartKey);
    return draft ? recordFromDraft(draft) : null;
  }));
  return records.filter((record): record is SeatChartRecord => record !== null).map(toSummary).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getSeatChart(id: string): Promise<SeatChartRecord | null> {
  if (!/^chart_[a-z0-9]+$/.test(id)) return null;
  const draft = await getSeatChartDraft(STORE_ROOT, id as ChartKey);
  return draft ? recordFromDraft(draft) : null;
}

export async function saveSeatChart(input: {
  readonly chart: ChartDocument;
  readonly boundVenue?: SeatChartVenue | null;
  readonly preserveBindings?: boolean;
}): Promise<SeatChartRecord> {
  const existing = /^chart_[a-z0-9]+$/.test(input.chart.id) ? await getSeatChart(input.chart.id) : null;
  const venue = input.boundVenue ?? existing?.boundVenue ?? null;
  if (!venue) throw new SeatChartVenueRequiredError();
  const chartKey = existing?.id as ChartKey | undefined ?? createChartKey();
  const expectedDraftRevision = isV2(input.chart) ? input.chart.draftRevision : 0;
  const document: SeatChartDocumentV2 = {
    ...input.chart,
    id: chartKey,
    version: 2,
    chartKey,
    venueId: venue.id,
    venueName: venue.name,
    venueType: input.chart.venueType ?? "simple",
    zones: input.chart.zones ?? [],
    assets: isV2(input.chart) ? input.chart.assets : [],
    draftRevision: expectedDraftRevision + 1,
  };
  const draft = await saveSeatChartDraft({ rootDir: STORE_ROOT, document, expectedDraftRevision });
  return recordFromDraft(draft);
}

export async function deleteSeatChart(id: string): Promise<boolean> {
  const record = await getSeatChart(id);
  if (!record || !record.boundVenue) return false;
  const active = await getVenueActiveRevision(STORE_ROOT, record.boundVenue.id);
  if (active?.chartKey === id) return false;
  await rm(path.join(STORE_ROOT, "drafts", `${id}.json`));
  return true;
}

export async function publishSeatChart(id: string, publish: boolean, boundVenue?: SeatChartVenue | null, actorId = "admin-session"): Promise<SeatChartRecord | null> {
  const current = await getSeatChart(id);
  if (!current) return null;
  const venue = boundVenue ?? current.boundVenue;
  if (!venue) throw new SeatChartVenueRequiredError();
  let saved = current;
  if (venue.id !== current.boundVenue?.id || venue.name !== current.boundVenue?.name) {
    saved = await saveSeatChart({ chart: current.chart, boundVenue: venue });
  }
  const document = saved.chart as SeatChartDocumentV2;
  if (publish) {
    const invalid = blockingValidationItems(document);
    if (invalid.length > 0) throw new SeatChartValidationError(invalid);
    await publishVenueRevision({ rootDir: STORE_ROOT, chartKey: document.chartKey, expectedDraftRevision: document.draftRevision, actorId, now: new Date() });
  } else {
    await deactivateVenueRevision(STORE_ROOT, venue.id, document.chartKey);
  }
  const draft = await getSeatChartDraft(STORE_ROOT, document.chartKey);
  return draft ? recordFromDraft(draft) : null;
}

export async function getPublishedChartForVenue(venueId: string): Promise<SeatChartRecord | null> {
  const active = await getVenueActiveRevision(STORE_ROOT, venueId);
  if (!active) return null;
  const revision = await getPublishedVenueRevision(STORE_ROOT, active.chartKey, active.revisionId);
  if (!revision) return null;
  return {
    id: revision.chartKey,
    chart: { ...revision.document, published: true, publishedAt: revision.publishedAt },
    boundVenue: { id: venueId, name: revision.document.venueName ?? venueId },
    createdAt: revision.publishedAt,
    updatedAt: revision.publishedAt,
  };
}

export async function getPublishedSeatChartRevision(chartKey: string, revisionId: string) {
  if (!/^chart_[a-z0-9]+$/.test(chartKey) || !/^rev_[a-z0-9]+$/.test(revisionId)) return null;
  return getPublishedVenueRevision(STORE_ROOT, chartKey as ChartKey, revisionId as RevisionId);
}

function toSummary(record: SeatChartRecord): SeatChartSummary {
  return {
    id: record.id,
    name: record.chart.name,
    published: Boolean(record.chart.published),
    publishedAt: record.chart.publishedAt,
    placeCount: countPlaces(record.chart),
    boundVenue: record.boundVenue,
    updatedAt: record.updatedAt,
    venueType: record.chart.venueType,
  };
}

export const seatChartStoreRoot = STORE_ROOT;
