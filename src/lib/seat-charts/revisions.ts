import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SeatChartDocumentV2 } from "../../types/seat-chart.ts";
import { createRevisionId, type ChartKey, type RevisionId } from "./keys.ts";

type DraftRecord = {
  readonly chartKey: ChartKey;
  readonly document: SeatChartDocumentV2;
  readonly updatedAt: string;
};

export type PublishedVenueRevision = {
  readonly chartKey: ChartKey;
  readonly revisionId: RevisionId;
  readonly venueId: string;
  readonly document: SeatChartDocumentV2;
  readonly publishedAt: string;
  readonly publishedBy: string;
  readonly contentHash: string;
};

export class StaleSeatChartDraftError extends Error {
  constructor() {
    super("STALE_SEAT_CHART_DRAFT");
    this.name = "StaleSeatChartDraftError";
  }
}

export class SeatChartDraftNotFoundError extends Error {
  constructor() {
    super("SEAT_CHART_DRAFT_NOT_FOUND");
    this.name = "SeatChartDraftNotFoundError";
  }
}

function safeSegment(value: string, label: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new TypeError(`${label} contains unsupported characters`);
  }
  return value;
}

function draftPath(rootDir: string, chartKey: ChartKey): string {
  return path.join(rootDir, "drafts", `${safeSegment(chartKey, "chartKey")}.json`);
}

async function readDraft(rootDir: string, chartKey: ChartKey): Promise<DraftRecord | null> {
  try {
    return JSON.parse(await readFile(draftPath(rootDir, chartKey), "utf8")) as DraftRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeJsonAtomic(targetPath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, targetPath);
}

async function withChartLock<T>(rootDir: string, chartKey: ChartKey, action: () => Promise<T>): Promise<T> {
  const lockDir = path.join(rootDir, "locks");
  await mkdir(lockDir, { recursive: true });
  const lockPath = path.join(lockDir, `${safeSegment(chartKey, "chartKey")}.lock`);
  let lock;
  try {
    lock = await open(lockPath, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new StaleSeatChartDraftError();
    }
    throw error;
  }
  try {
    return await action();
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
}

export async function saveSeatChartDraft(input: {
  readonly rootDir: string;
  readonly document: SeatChartDocumentV2;
  readonly expectedDraftRevision: number;
}): Promise<DraftRecord> {
  return withChartLock(input.rootDir, input.document.chartKey, async () => {
    const current = await readDraft(input.rootDir, input.document.chartKey);
    const currentRevision = current?.document.draftRevision ?? 0;
    if (currentRevision !== input.expectedDraftRevision) {
      throw new StaleSeatChartDraftError();
    }
    if (input.document.draftRevision !== input.expectedDraftRevision + 1) {
      throw new StaleSeatChartDraftError();
    }
    const record: DraftRecord = {
      chartKey: input.document.chartKey,
      document: input.document,
      updatedAt: new Date().toISOString(),
    };
    await writeJsonAtomic(draftPath(input.rootDir, input.document.chartKey), record);
    return record;
  });
}

export async function publishVenueRevision(input: {
  readonly rootDir: string;
  readonly chartKey: ChartKey;
  readonly expectedDraftRevision: number;
  readonly actorId: string;
  readonly now: Date;
}): Promise<PublishedVenueRevision> {
  const draft = await readDraft(input.rootDir, input.chartKey);
  if (!draft) throw new SeatChartDraftNotFoundError();
  if (draft.document.draftRevision !== input.expectedDraftRevision) {
    throw new StaleSeatChartDraftError();
  }

  const revisionId = createRevisionId();
  const publishedAt = input.now.toISOString();
  const canonicalDocument = JSON.stringify(draft.document);
  const revision: PublishedVenueRevision = {
    chartKey: input.chartKey,
    revisionId,
    venueId: draft.document.venueId,
    document: draft.document,
    publishedAt,
    publishedBy: input.actorId,
    contentHash: createHash("sha256").update(canonicalDocument).digest("hex"),
  };
  const revisionPath = path.join(
    input.rootDir,
    "revisions",
    safeSegment(input.chartKey, "chartKey"),
    `${safeSegment(revisionId, "revisionId")}.json`,
  );
  await mkdir(path.dirname(revisionPath), { recursive: true });
  const handle = await open(revisionPath, "wx");
  try {
    await handle.writeFile(`${JSON.stringify(revision, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await writeJsonAtomic(
    path.join(input.rootDir, "venues", `${safeSegment(draft.document.venueId, "venueId")}.json`),
    {
      venueId: draft.document.venueId,
      chartKey: input.chartKey,
      revisionId,
      publishedAt,
    },
  );
  return revision;
}
