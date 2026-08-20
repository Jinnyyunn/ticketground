import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createChartKey } from "../src/lib/seat-charts/keys.ts";
import {
  publishVenueRevision,
  saveSeatChartDraft,
  StaleSeatChartDraftError,
} from "../src/lib/seat-charts/revisions.ts";

function document(chartKey, draftRevision, name = "주경기장") {
  return {
    version: 2,
    id: chartKey,
    chartKey,
    venueId: "venue_jamsil_sports_complex_main_stadium",
    name,
    venueType: "sectionsAndFloors",
    categories: [],
    floors: [{ id: "floor-1", name: "1층", index: 1 }],
    activeFloorId: "floor-1",
    zones: [],
    objects: [],
    assets: [],
    draftRevision,
  };
}

test("a venue chart keeps a stable opaque chart key while published revisions stay immutable", async () => {
  // Given
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "ticketground-seat-chart-v2-"));
  const chartKey = createChartKey();
  const firstDraft = document(chartKey, 1);
  await saveSeatChartDraft({ rootDir, document: firstDraft, expectedDraftRevision: 0 });

  // When
  const first = await publishVenueRevision({
    rootDir,
    chartKey,
    expectedDraftRevision: 1,
    actorId: "admin-test",
    now: new Date("2026-08-21T00:00:00.000Z"),
  });
  const secondDraft = document(chartKey, 2, "주경기장 개선안");
  await saveSeatChartDraft({ rootDir, document: secondDraft, expectedDraftRevision: 1 });
  const second = await publishVenueRevision({
    rootDir,
    chartKey,
    expectedDraftRevision: 2,
    actorId: "admin-test",
    now: new Date("2026-08-21T01:00:00.000Z"),
  });

  // Then
  assert.match(chartKey, /^chart_[a-z0-9]{20,}$/);
  assert.notEqual(first.revisionId, second.revisionId);
  assert.equal(first.chartKey, second.chartKey);
  const revisionFiles = await readdir(path.join(rootDir, "revisions", chartKey));
  assert.equal(revisionFiles.length, 2);
  const storedFirst = JSON.parse(
    await readFile(path.join(rootDir, "revisions", chartKey, `${first.revisionId}.json`), "utf8"),
  );
  assert.equal(storedFirst.document.name, "주경기장");
  const active = JSON.parse(
    await readFile(
      path.join(rootDir, "venues", "venue_jamsil_sports_complex_main_stadium.json"),
      "utf8",
    ),
  );
  assert.equal(active.chartKey, chartKey);
  assert.equal(active.revisionId, second.revisionId);
});

test("publishing rejects a stale draft revision before writing a revision", async () => {
  // Given
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "ticketground-seat-chart-stale-"));
  const chartKey = createChartKey();
  await saveSeatChartDraft({ rootDir, document: document(chartKey, 1), expectedDraftRevision: 0 });

  // When
  const publish = publishVenueRevision({
    rootDir,
    chartKey,
    expectedDraftRevision: 0,
    actorId: "admin-test",
    now: new Date("2026-08-21T00:00:00.000Z"),
  });

  // Then
  await assert.rejects(publish, StaleSeatChartDraftError);
  await assert.rejects(readdir(path.join(rootDir, "revisions", chartKey)), { code: "ENOENT" });
});
