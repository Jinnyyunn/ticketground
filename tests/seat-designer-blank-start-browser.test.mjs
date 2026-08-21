import assert from "node:assert/strict";
import test from "node:test";
import { beginBlank, openV2Editor } from "./seat-designer-v2-browser-utils.mjs";

test("the clean-room designer starts image-first and can deliberately open a blank venue chart", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t);
  const start = page.getByTestId("seat-designer-v2-reference-start");
  await page.getByRole("heading", { name: "공연장 좌석 배치도 불러오기" }).waitFor();
  assert.equal(await page.getByText("적용 공연장", { exact: true }).count(), 1);
  assert.match(await start.locator('input[type="file"]').getAttribute("accept"), /application\/pdf/);
  assert.equal(await start.getByRole("button", { name: "빈 캔버스로 시작" }).isDisabled(), false);

  await beginBlank(page);
  assert.equal(await page.locator("[data-object-type]").count(), 0, "blank mode must not seed legacy TIG geometry");
  assert.equal(await page.getByTestId("seat-designer-v2-focal-point").count(), 0);
  const shell = await page.getByTestId("seat-designer-v2-shell").boundingBox();
  const toolbar = await page.getByRole("navigation", { name: "좌석 배치 도구" }).boundingBox();
  const inspector = await page.getByTestId("seat-designer-v2-inspector").boundingBox();
  assert.ok(shell && toolbar && inspector);
  assert.equal(Math.round(toolbar.width), 42);
  assert.equal(Math.round(inspector.width), 336);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(runtimeErrors, []);
});
