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

test("deleting a section also deletes every object scoped inside it", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t);
  await beginBlank(page);
  const { click, drag } = await canvasGeometry(page);

  await chooseTool(page, "section");
  for (const [x, y] of [[260, 180], [620, 180], [620, 420], [260, 420]]) await click(x, y);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "구역 내부 편집" }).click();
  await chooseTool(page, "row");
  await drag(330, 260, 540, 260);
  await page.getByRole("button", { name: /section-1 나가기/ }).click();
  await chooseTool(page, "select");
  await page.locator('[data-object-type="section"]').click({ force: true });
  await page.getByTitle("삭제").click();

  let savedObjects = null;
  await page.route("**/api/seat-charts", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["content-type"]?.includes("application/json")) {
      savedObjects = route.request().postDataJSON().chart.objects;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByText("초안 저장 완료", { exact: true }).first().waitFor();
  assert.equal(savedObjects.some((object) => object.sectionId), false, "deleting a section must remove its scoped contents");
  assert.deepEqual(runtimeErrors, []);
});

test("pasted objects move into the active floor and section scope", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t);
  await beginBlank(page);
  const { drag } = await canvasGeometry(page);
  await chooseTool(page, "row");
  await drag(330, 260, 540, 260);
  await chooseTool(page, "select");
  await page.locator('[data-object-type="row"]').click({ force: true });
  await page.getByTitle("복사").click();
  await page.getByTitle("층 추가").click();
  await page.getByTitle("붙여넣기").click();
  assert.equal(await page.locator('[data-object-type="row"]').count(), 1, "pasted row must appear in the current floor");
  await page.getByRole("button", { name: "1F", exact: true }).click();
  assert.equal(await page.locator('[data-object-type="row"]').count(), 1, "source row must stay in its original floor");
  assert.deepEqual(runtimeErrors, []);
});

test("floor data mutations create unsaved history", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t);
  await beginBlank(page);
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByText("초안 저장 완료", { exact: true }).first().waitFor();
  await page.getByTitle("층 추가").click();
  await page.getByText("저장되지 않은 변경", { exact: true }).first().waitFor();
  assert.equal(await page.getByTitle("실행 취소").isEnabled(), true, "floor creation must create an undo entry");
  await page.getByTitle("실행 취소").click();
  assert.equal(await page.getByRole("button", { name: "2F", exact: true }).count(), 0);
  assert.deepEqual(runtimeErrors, []);
});

test("preview renders only the active floor and section scope", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t);
  await beginBlank(page);
  const { drag } = await canvasGeometry(page);
  await chooseTool(page, "row");
  await drag(330, 260, 540, 260);
  await page.getByTitle("층 추가").click();
  await chooseTool(page, "row");
  await drag(330, 300, 540, 300);
  await page.getByRole("button", { name: "1F", exact: true }).click();
  await page.getByTitle("미리보기").click();
  const preview = page.getByTestId("seat-designer-v2-preview");
  assert.equal(await preview.locator('[data-object-type="row"]').count(), 1, "preview must only render the active floor");
  assert.deepEqual(runtimeErrors, []);
});
