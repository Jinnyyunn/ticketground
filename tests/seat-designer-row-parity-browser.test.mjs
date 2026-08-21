import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  beginBlank,
  canvasGeometry,
  chooseTool,
  openV2Editor,
} from "./seat-designer-v2-browser-utils.mjs";

test("row gestures expose live guides, variable depth, and staggered preview in the browser", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t);
  await beginBlank(page);
  const { point, drag } = await canvasGeometry(page);

  await chooseTool(page, "row");
  await page.mouse.move(point(180, 130).x, point(180, 130).y);
  await page.mouse.down();
  await page.mouse.move(point(360, 132).x, point(360, 132).y, { steps: 4 });
  assert.equal(await page.getByTestId("seat-designer-v2-guide-axis").count(), 1);
  await page.getByTestId("seat-designer-v2-row-count").waitFor();
  await page.mouse.up();

  await chooseTool(page, "multipleRows");
  await page.keyboard.press("Escape");
  await page.getByTestId("seat-designer-v2-multiple-layout").selectOption("staggered");
  await drag(450, 150, 680, 150);
  await page.mouse.move(point(450, 150).x, point(450, 150).y);
  await page.mouse.down();
  await page.mouse.move(point(450, 220).x, point(450, 220).y, { steps: 4 });
  const count = page.getByTestId("seat-designer-v2-row-count");
  await count.waitFor();
  assert.match(await count.textContent(), /^6 × /);
  assert.equal(await page.getByTestId("seat-designer-v2-row-preview").locator('[data-object-type="row"]').count(), 6);

  const evidenceRoot = path.resolve(".omo/evidence/seat-designer-v2/browser");
  await mkdir(evidenceRoot, { recursive: true });
  await page.screenshot({ path: path.join(evidenceRoot, "row-guides-and-multiple-preview.png"), fullPage: true });
  await page.mouse.up();
  assert.equal(await page.locator('[data-object-type="row"]').count(), 7);
  assert.deepEqual(runtimeErrors, []);
});
