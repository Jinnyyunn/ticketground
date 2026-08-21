import assert from "node:assert/strict";
import test from "node:test";
import {
  beginBlank,
  canvasGeometry,
  chooseTool,
  openV2Editor,
} from "./seat-designer-v2-browser-utils.mjs";

test("floors and section interiors keep independent editable object scopes", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t);
  await beginBlank(page);
  const { click, drag } = await canvasGeometry(page);

  await chooseTool(page, "section");
  for (const [x, y] of [[260, 180], [620, 180], [620, 420], [260, 420]]) await click(x, y);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "구역 내부 편집" }).click();
  await page.getByRole("button", { name: /section-1 나가기/ }).waitFor();
  assert.equal(await page.locator('[data-object-type="section"]').count(), 0);

  await chooseTool(page, "row");
  await drag(330, 260, 540, 260);
  assert.equal(await page.locator('[data-object-type="row"]').count(), 1);
  await page.getByRole("button", { name: /section-1 나가기/ }).click();
  assert.equal(await page.locator('[data-object-type="section"]').count(), 1);
  assert.equal(await page.locator('[data-object-type="row"]').count(), 0);

  await page.getByTitle("층 추가").click();
  await page.getByRole("button", { name: "2F", exact: true }).waitFor();
  assert.equal(await page.locator("[data-object-type]").count(), 0);
  await chooseTool(page, "row");
  await drag(330, 300, 540, 300);
  assert.equal(await page.locator('[data-object-type="row"]').count(), 1);
  await page.getByRole("button", { name: "1F", exact: true }).click();
  assert.equal(await page.locator('[data-object-type="section"]').count(), 1);
  assert.equal(await page.locator('[data-object-type="row"]').count(), 0);
  assert.deepEqual(runtimeErrors, []);
});
