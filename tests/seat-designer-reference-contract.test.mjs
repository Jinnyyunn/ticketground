import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const requiredRows = [
  "start.blank",
  "start.template",
  "start.image-jpg",
  "start.image-png",
  "start.document-pdf",
  "scanner.configure",
  "scanner.detect",
  "scanner.review",
  "scanner.accept",
  "global.save-exit",
  "global.preview",
  "global.theme",
  "history.undo",
  "history.redo",
  "viewport.zoom",
  "viewport.pan",
  "viewport.snap",
  "viewport.section-contents",
  "viewport.labels",
  "selection.select",
  "selection.seats",
  "selection.brush",
  "selection.same-type",
  "selection.node",
  "structure.focal-point",
  "create.row",
  "create.section",
  "create.round-table",
  "create.booth",
  "create.rectangular-area",
  "create.rectangle",
  "create.line",
  "create.text",
  "create.image",
  "create.icon",
  "context.align",
  "context.flip-horizontal",
  "context.flip-vertical",
  "context.duplicate",
  "context.copy-paste",
  "context.delete",
  "layers.all",
  "layers.foreground",
  "layers.interactive",
  "layers.background",
  "layers.surroundings",
  "structure.floors",
  "structure.zones",
  "structure.categories",
  "structure.seat-properties",
  "validation.invalid",
  "publish.venue",
  "publish.immutable-revision",
];

test("reference matrix enumerates every required tool and state", async () => {
  const raw = await readFile(
    "docs/research/seats-io-designer/tool-parity.json",
    "utf8",
  );
  const matrix = JSON.parse(raw);

  assert.equal(matrix.version, 1);
  assert.ok(Array.isArray(matrix.rows));

  const ids = new Set(matrix.rows.map((row) => row.id));
  for (const id of requiredRows) {
    assert.equal(ids.has(id), true, `missing ${id}`);
  }

  for (const row of matrix.rows) {
    assert.equal(typeof row.referenceState, "string", `${row.id} referenceState`);
    assert.ok(row.referenceState.length > 0, `${row.id} referenceState`);
    assert.ok(Array.isArray(row.actions) && row.actions.length > 0, `${row.id} actions`);
    assert.ok(Array.isArray(row.expected) && row.expected.length > 0, `${row.id} expected`);
    assert.equal(typeof row.tigTest, "string", `${row.id} tigTest`);
    assert.ok(row.tigTest.length > 0, `${row.id} tigTest`);
    assert.ok(Array.isArray(row.evidence) && row.evidence.length > 0, `${row.id} evidence`);
    assert.ok(["reference-captured", "tig-verified"].includes(row.status), `${row.id} status`);
  }
});
