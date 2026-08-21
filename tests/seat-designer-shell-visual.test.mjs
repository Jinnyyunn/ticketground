import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("seat designer shell consumes semantic visual tokens and exposes stable controls", async () => {
  const [css, shell, tools, toolbar] = await Promise.all([
    readFile("src/app/globals.css", "utf8"),
    readFile("src/components/seat-designer/seat-designer.tsx", "utf8"),
    readFile("src/components/seat-designer/tool-picker.tsx", "utf8"),
    readFile("src/components/seat-designer/top-toolbar.tsx", "utf8"),
  ]);
  for (const token of ["--editor-canvas", "--editor-panel", "--editor-surface", "--editor-text", "--editor-muted", "--editor-accent", "--editor-border", "--editor-selection", "--editor-elevation"]) {
    assert.match(css, new RegExp(token));
  }
  assert.match(shell, /seat-designer-shell/);
  assert.match(`${shell}\n${toolbar}`, /aria-live="polite"/);
  assert.match(tools, /data-testid={`tool-\$\{t\.id\}`}/);
  assert.match(toolbar, /data-testid="seat-designer-publish"/);
});
