import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  beginWithReference,
  canvasGeometry,
  chooseTool,
  openV2Editor,
} from "./seat-designer-v2-browser-utils.mjs";

test("reference import, geometry controls, object transforms, and node editing are observable", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t);
  await beginWithReference(page, path.resolve("public/images/misc/2b6c799906bc4462.png"));
  const reference = page.getByTestId("seat-designer-v2-reference-plan");
  assert.equal(await reference.getAttribute("opacity"), "0.5");
  const controls = page.getByTestId("seat-designer-v2-reference-controls");
  assert.equal(await controls.count(), 1, await page.getByTestId("seat-designer-v2-inspector").innerText());
  assert.equal(await controls.locator("input").count(), 7, await controls.innerHTML());
  await controls.locator('input[aria-label="X"]').fill("120");
  await controls.locator('input[aria-label="Y"]').fill("90");
  await controls.locator('input[aria-label="너비"]').fill("640");
  await controls.locator('input[aria-label="높이"]').fill("420");
  await controls.locator('input[aria-label="불투명도"]').fill("35");
  await controls.locator('input[aria-label="회전"]').fill("12");
  assert.equal(await reference.getAttribute("x"), "120");
  assert.equal(await reference.getAttribute("y"), "90");
  assert.equal(await reference.getAttribute("width"), "640");
  assert.equal(await reference.getAttribute("height"), "420");
  assert.equal(await reference.getAttribute("opacity"), "0.35");
  assert.match(await reference.getAttribute("transform"), /rotate\(12/);
  await controls.getByRole("button", { name: "숨기기" }).click();
  assert.equal(await reference.count(), 0);
  await controls.getByRole("button", { name: "보이기" }).click();
  await reference.waitFor();
  await controls.getByRole("button", { name: "잠금 해제" }).click();
  await controls.getByRole("button", { name: "캔버스에 맞춤" }).click();
  assert.equal(await reference.getAttribute("x"), "80");
  assert.equal(await reference.getAttribute("width"), "760");
  await controls.getByText("도면 교체", { exact: true }).locator('input[type="file"]').setInputFiles(path.resolve("public/images/header/partner-nol.png"));
  await page.getByText("참조 도면 교체됨", { exact: true }).waitFor();

  const { click, drag } = await canvasGeometry(page);
  await chooseTool(page, "polygon");
  for (const [x, y] of [[220, 180], [420, 180], [440, 330], [210, 340]]) await click(x, y);
  await page.keyboard.press("Enter");
  const polygon = page.locator('[data-object-type="rectangle"] polygon');
  await polygon.waitFor();

  await chooseTool(page, "select");
  await polygon.click({ force: true });
  const handles = page.getByTestId("seat-designer-v2-selection-handles").first();
  const beforeMove = await polygon.getAttribute("points");
  await drag(320, 250, 370, 290);
  assert.notEqual(await polygon.getAttribute("points"), beforeMove);

  const handleCircles = handles.locator("circle");
  assert.equal(await handleCircles.count(), 5);
  const resize = await handleCircles.nth(3).boundingBox();
  assert.ok(resize);
  await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
  await page.mouse.down();
  await page.mouse.move(resize.x + 55, resize.y + 45);
  await page.mouse.up();
  const rotation = await handleCircles.nth(4).boundingBox();
  assert.ok(rotation);
  const beforeRotation = await polygon.getAttribute("points");
  await page.mouse.move(rotation.x + rotation.width / 2, rotation.y + rotation.height / 2);
  await page.mouse.down();
  await page.mouse.move(rotation.x + 75, rotation.y + 30);
  await page.mouse.up();
  assert.notEqual(await polygon.getAttribute("points"), beforeRotation);

  await chooseTool(page, "node");
  assert.equal(await page.getByTestId("seat-designer-v2-node-handle").count(), 4);
  await polygon.dblclick({ position: { x: 100, y: 1 }, force: true });
  assert.equal(await page.getByTestId("seat-designer-v2-node-handle").count(), 5);
  await page.getByTestId("seat-designer-v2-node-handle").first().click({ button: "right", force: true });
  assert.equal(await page.getByTestId("seat-designer-v2-node-handle").count(), 4);

  await chooseTool(page, "rectangularTable");
  await click(680, 270);
  await chooseTool(page, "select");
  const table = page.locator('[data-object-type="table"]').last();
  await table.locator("rect").first().click({ force: true });
  const objectFields = page.getByTestId("seat-designer-v2-object-fields");
  await objectFields.locator('input[aria-label="너비"]').fill("160");
  await objectFields.locator('input[aria-label="오른쪽 의자"]').fill("2");
  assert.equal(await table.locator("g").first().locator("circle").count(), 10);

  await controls.getByRole("button", { name: "참조 도면 제거" }).click();
  assert.equal(await page.getByTestId("seat-designer-v2-reference-plan").count(), 0);
  assert.deepEqual(runtimeErrors, []);
});
