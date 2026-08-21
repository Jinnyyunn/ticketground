import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin seat designer is replaced by the clean-room v2 editor", async () => {
  const page = await readFile("src/app/admin/seat-designer/page.tsx", "utf8");
  const editorFiles = ["seat-designer-v2.tsx", "reference-start.tsx", "toolbar.tsx", "inspector.tsx", "service-credentials-panel.tsx", "object-factory.ts", "object-transform.ts", "canvas-objects.tsx", "floor-bar.tsx", "help-dialog.tsx", "row-geometry.ts", "smart-guides.ts", "node-geometry.ts", "reference-layout.ts"];
  const editor = (await Promise.all(editorFiles.map((file) => readFile(`src/components/seat-designer-v2/${file}`, "utf8")))).join("\n");

  assert.match(page, /seat-designer-v2\/seat-designer-v2/);
  assert.doesNotMatch(page, /components\/seat-designer\/seat-designer/);
  for (const contract of [
    "seat-designer-v2-shell",
    "seat-designer-v2-reference-start",
    "seat-designer-v2-tool-",
    "seat-designer-v2-row-preview",
    "seat-designer-v2-row-count",
    "seat-designer-v2-row-spacing",
    "seat-designer-v2-seat-spacing",
    "seat-designer-v2-help-strip",
    "seat-designer-v2-selection-layer",
    "seat-designer-v2-service-credentials",
    "seat-designer-v2-floor-bar",
    "seat-designer-v2-help-dialog",
    "seat-designer-v2-seat-fields",
    "seat-designer-v2-node-add-handle",
    "seat-designer-v2-guide-",
  ]) assert.match(editor, new RegExp(contract));
  assert.doesNotMatch(editor, /@\/lib\/seat-designer\//);
  assert.doesNotMatch(editor, /@\/components\/seat-designer\//);
});

test("v2 tool catalog owns every reference tool family", async () => {
  const catalog = await readFile("src/components/seat-designer-v2/tool-catalog.ts", "utf8");
  for (const tool of [
    "select", "seatSelect", "brush", "sameType", "node", "focal",
    "row", "section", "roundTable", "rectangularTable", "booth",
    "rectangularArea", "ellipticArea", "polygonalArea", "rectangle",
    "ellipse", "polygon", "line", "text", "image", "icon", "hand",
  ]) assert.match(catalog, new RegExp(`\\b${tool}\\b`), `${tool} must be v2-owned`);
});
