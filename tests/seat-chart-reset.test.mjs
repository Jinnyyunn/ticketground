import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { archiveAndResetLegacyCharts } from "../src/lib/seat-charts/reset.ts";

test("legacy charts are archived before the active chart directory is reset", async () => {
  // Given
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "ticketground-seat-reset-"));
  const legacyDir = path.join(rootDir, "seat-charts");
  const archiveRoot = path.join(rootDir, "seat-chart-archives");
  const venuesPath = path.join(rootDir, "venues.json");
  await mkdir(legacyDir);
  await writeFile(path.join(legacyDir, "chart-a.json"), '{"id":"chart-a"}', "utf8");
  await writeFile(path.join(legacyDir, "chart-b.json"), '{"id":"chart-b"}', "utf8");
  await writeFile(venuesPath, '{"venues":[{"id":"venue-a"}]}', "utf8");
  const venueBytes = await readFile(venuesPath);

  // When
  const result = await archiveAndResetLegacyCharts({
    legacyDir,
    archiveRoot,
    now: new Date("2026-08-21T02:03:04.000Z"),
  });

  // Then
  assert.equal(result.archivedCount, 2);
  assert.equal(await readFile(path.join(result.archivePath, "chart-a.json"), "utf8"), '{"id":"chart-a"}');
  assert.equal(await readFile(path.join(result.archivePath, "chart-b.json"), "utf8"), '{"id":"chart-b"}');
  await assert.rejects(access(path.join(legacyDir, "chart-a.json")), { code: "ENOENT" });
  assert.deepEqual(await readFile(venuesPath), venueBytes);
});

test("an archive failure leaves every legacy chart active", async () => {
  // Given
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "ticketground-seat-reset-failure-"));
  const legacyDir = path.join(rootDir, "seat-charts");
  const archiveRoot = path.join(rootDir, "archive-file");
  await mkdir(legacyDir);
  await writeFile(path.join(legacyDir, "chart-a.json"), '{"id":"chart-a"}', "utf8");
  await writeFile(archiveRoot, "not a directory", "utf8");

  // When
  const reset = archiveAndResetLegacyCharts({
    legacyDir,
    archiveRoot,
    now: new Date("2026-08-21T02:03:04.000Z"),
  });

  // Then
  await assert.rejects(reset);
  assert.equal(await readFile(path.join(legacyDir, "chart-a.json"), "utf8"), '{"id":"chart-a"}');
});
