import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const editorRoot = "src/components/seat-designer-v2";

async function editorModules(directory = editorRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return editorModules(target);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

function pureLines(source) {
  return source.split("\n").filter((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("//");
  }).length;
}

test("admin seat designer is replaced by the clean-room v2 editor", async () => {
  const page = await readFile("src/app/admin/seat-designer/page.tsx", "utf8");
  const editor = (await Promise.all((await editorModules()).map((file) => readFile(file, "utf8")))).join("\n");

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
    "seat-designer-v2-seat-view-dialog",
    "seat-designer-v2-node-add-handle",
    "seat-designer-v2-guide-",
  ]) assert.match(editor, new RegExp(contract));
  assert.doesNotMatch(editor, /@\/lib\/seat-designer\//);
  assert.doesNotMatch(editor, /@\/components\/seat-designer\//);
  assert.doesNotMatch(editor.replace(/export const V2_OBJECT_COLORS = \{[\s\S]*?\} as const;/, ""), /#[0-9a-f]{3,8}|rgba?\(/i);
  assert.doesNotMatch(editor, /\b(?:bg|text|border)-(?:white|black|red-[0-9]+|green-[0-9]+)/);
  assert.doesNotMatch(editor, /(?:fill|stroke)="white"/);
  assert.doesNotMatch(editor, /["']white["']/);
  assert.doesNotMatch(editor, /(?:bg|text|border)-amber-[0-9]+/);
});

test("every clean-room v2 TypeScript module stays within 250 pure lines", async () => {
  const oversized = [];
  for (const file of await editorModules()) {
    const count = pureLines(await readFile(file, "utf8"));
    if (count > 250) oversized.push(`${file}: ${count}`);
  }
  assert.deepEqual(oversized, []);
});

test("save and publish status use shared semantic severity", async () => {
  const status = await readFile(`${editorRoot}/status.ts`, "utf8");
  assert.match(status, /type EditorStatusTone = "neutral" \| "success" \| "danger"/);
  assert.match(status, /"저장 실패"[\s\S]*?"danger"/);
  assert.match(status, /"게시 실패"[\s\S]*?"danger"/);
  assert.match(status, /"초안 저장 완료"[\s\S]*?"success"/);
  assert.match(status, /"게시 완료"[\s\S]*?"success"/);
});

test("canvas contrast and editor geometry use shared semantic tokens", async () => {
  const css = await readFile("src/app/globals.css", "utf8");
  const workspace = await readFile(`${editorRoot}/editor-workspace.tsx`, "utf8");
  const renderer = await readFile(`${editorRoot}/canvas-object-renderer.tsx`, "utf8");
  const icons = await readFile(`${editorRoot}/icon-node.tsx`, "utf8");
  const shell = await readFile(`${editorRoot}/seat-designer-v2.tsx`, "utf8");
  const toolbar = await readFile(`${editorRoot}/toolbar.tsx`, "utf8");
  const inspector = await readFile(`${editorRoot}/inspector.tsx`, "utf8");
  const header = await readFile(`${editorRoot}/editor-header.tsx`, "utf8");
  const model = await readFile(`${editorRoot}/editor-model.ts`, "utf8");

  for (const token of [
    "--editor-canvas-foreground-dark",
    "--editor-canvas-icon-dark",
    "--editor-header-height",
    "--editor-toolbar-width",
    "--editor-inspector-width",
    "--editor-shell-font-size",
    "--editor-shell-min-height",
  ]) assert.match(css, new RegExp(token));
  assert.match(workspace, /data-canvas-theme/);
  assert.match(renderer, /--editor-canvas-foreground/);
  assert.match(icons, /--editor-canvas-icon/);
  assert.doesNotMatch(shell, /(?:min-h|text)-\[(?:620px|13px)\]/);
  assert.doesNotMatch(toolbar, /w-\[42px\]/);
  assert.doesNotMatch(inspector, /w-\[336px\]/);
  assert.doesNotMatch(header, /h-\[46px\]/);
  assert.match(model, /tool:\s*"select"[\s\S]*?objects:\s*\[\]/);
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
