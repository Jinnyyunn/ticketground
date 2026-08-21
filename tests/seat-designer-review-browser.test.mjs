import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  beginBlank,
  beginWithReference,
  canvasGeometry,
  chooseTool,
  openV2Editor,
  selectVenue,
} from "./seat-designer-v2-browser-utils.mjs";

test("image uploads preserve intervening edits and block save or publish until settled", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t);
  await beginBlank(page);
  let releaseUpload;
  let uploadStarted;
  const release = new Promise((resolve) => { releaseUpload = resolve; });
  const started = new Promise((resolve) => { uploadStarted = resolve; });
  await page.route("**/api/seat-charts", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["content-type"]?.includes("multipart/form-data")) {
      uploadStarted();
      await release;
    }
    await route.continue();
  });

  const { click } = await canvasGeometry(page);
  await chooseTool(page, "image");
  const chooser = page.waitForEvent("filechooser");
  await click(280, 230);
  await (await chooser).setFiles(path.resolve("public/images/header/partner-nol.png"));
  await started;
  await page.getByRole("button", { name: "게시", exact: true }).waitFor({ state: "visible" });
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "게시" && button.disabled));
  assert.equal(await page.getByRole("button", { name: "저장", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "게시", exact: true }).isDisabled(), true);

  await chooseTool(page, "icon");
  await click(520, 260);
  assert.equal(await page.locator('[data-object-type="icon"]').count(), 1);
  releaseUpload();
  await page.locator('[data-object-type="image"]').waitFor();
  assert.equal(await page.locator('[data-object-type="icon"]').count(), 1, "upload completion must merge into the latest editor state");
  assert.equal(await page.getByRole("button", { name: "저장", exact: true }).isEnabled(), true);
  assert.equal(await page.getByRole("button", { name: "게시", exact: true }).isEnabled(), true);
  assert.deepEqual(runtimeErrors, []);
});

test("removing a reference invalidates a slower replacement and every advertised start format remains available", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t);
  const startInput = page.getByTestId("seat-designer-v2-reference-start").locator('input[type="file"]');
  assert.equal(await startInput.getAttribute("accept"), "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf");
  await beginWithReference(page, path.resolve("public/images/misc/2b6c799906bc4462.png"));

  let releaseUpload;
  let uploadStarted;
  const release = new Promise((resolve) => { releaseUpload = resolve; });
  const started = new Promise((resolve) => { uploadStarted = resolve; });
  await page.route("**/api/seat-charts", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["content-type"]?.includes("multipart/form-data")) {
      uploadStarted();
      await release;
    }
    await route.continue();
  });
  const controls = page.getByTestId("seat-designer-v2-reference-controls");
  await controls.getByText("도면 교체", { exact: true }).locator('input[type="file"]').setInputFiles(path.resolve("public/images/header/partner-nol.png"));
  await started;
  await controls.getByRole("button", { name: "참조 도면 제거" }).click();
  releaseUpload();
  await page.getByTestId("seat-designer-v2-reference-plan").waitFor({ state: "detached" });
  assert.equal(await page.getByTestId("seat-designer-v2-reference-plan").count(), 0);
  assert.deepEqual(runtimeErrors, []);
});

test("locked geometry remains selectable but cannot move, duplicate, or delete", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t);
  await beginBlank(page);
  const { drag } = await canvasGeometry(page);
  await chooseTool(page, "rectangle");
  await drag(260, 180, 500, 320);
  await chooseTool(page, "select");
  const shape = page.locator('[data-object-type="rectangle"] > rect').first();
  await shape.click({ force: true });
  const fields = page.getByTestId("seat-designer-v2-object-fields");
  await fields.getByLabel("객체 잠금").check();
  assert.equal(await page.getByTestId("seat-designer-v2-selection-handles").count(), 0);
  const before = await shape.getAttribute("x");
  const shapeBox = await shape.boundingBox();
  assert.ok(shapeBox);
  await page.mouse.move(shapeBox.x + 30, shapeBox.y + 30);
  await page.mouse.down();
  await page.mouse.move(shapeBox.x + 100, shapeBox.y + 80);
  await page.mouse.up();
  assert.equal(await shape.getAttribute("x"), before);
  await page.getByTitle("복제").click();
  await page.getByTitle("삭제").click();
  assert.equal(await page.locator('[data-object-type="rectangle"]').count(), 1);
  await shape.click({ force: true });
  await fields.getByLabel("객체 잠금").uncheck();
  await page.getByTestId("seat-designer-v2-selection-handles").waitFor();
  assert.deepEqual(runtimeErrors, []);
});

test("the image-first editor stays usable without horizontal overflow at tablet and phone widths", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t, { viewport: { width: 1024, height: 768 } });
  const evidenceRoot = path.resolve(".omo/evidence/seat-designer-v2/responsive");
  await mkdir(evidenceRoot, { recursive: true });
  await selectVenue(page);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.getByRole("button", { name: "빈 캔버스로 시작" }).click();
  await page.getByTestId("seat-designer-v2-reference-start").waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.equal(await page.getByTestId("seat-designer-v2-inspector").isVisible(), true);
  await page.screenshot({ path: path.join(evidenceRoot, "tablet.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.equal(await page.getByTestId("seat-designer-v2-inspector").isVisible(), false);
  assert.equal(await page.getByRole("navigation", { name: "좌석 배치 도구" }).isVisible(), true);
  assert.equal(await page.getByRole("button", { name: "게시", exact: true }).isVisible(), true);
  assert.equal(await page.getByText("선택 추가", { exact: true }).isVisible(), true);
  await page.getByTitle("속성 패널").click();
  const closeInspector = page.getByTitle("속성 패널 닫기");
  const closeInspectorBox = await closeInspector.boundingBox();
  assert.ok(closeInspectorBox, "mobile inspector close control must be visible");
  assert.ok(closeInspectorBox.width >= 44, "mobile inspector close control must be at least 44px wide");
  assert.ok(closeInspectorBox.height >= 44, "mobile inspector close control must be at least 44px high");
  assert.notEqual(
    await closeInspector.evaluate((element) => getComputedStyle(element).backgroundColor),
    "rgba(0, 0, 0, 0)",
    "mobile inspector close control must stay visually distinct over scrolling actions",
  );
  const mobileInspector = page.getByTestId("seat-designer-v2-inspector").last();
  await mobileInspector.getByText("캔버스 표시", { exact: true }).waitFor();
  assert.equal(await mobileInspector.getByLabel("스냅").isChecked(), true);
  await page.screenshot({ path: path.join(evidenceRoot, "mobile-inspector.png"), fullPage: true });
  const mobileActions = page.getByTestId("seat-designer-v2-mobile-actions");
  assert.equal(await mobileActions.getByRole("button", { name: "좌석 시점", exact: true }).count(), 1);
  for (const action of ["왼쪽 정렬", "가운데 정렬", "오른쪽 정렬", "위 정렬", "중간 정렬", "아래 정렬", "가로 균등 배치", "세로 균등 배치"]) {
    assert.equal(await mobileActions.getByRole("button", { name: action, exact: true }).count(), 1, `${action} must remain reachable below desktop width`);
  }
  await mobileActions.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByTestId("seat-designer-v2-mobile-status").getByText("초안 저장 완료", { exact: true }).waitFor();
  await mobileActions.getByRole("button", { name: "도움말", exact: true }).click();
  await page.getByTestId("seat-designer-v2-help-dialog").waitFor();
  const redoShortcut = page.getByText("⌘/Ctrl + Shift + Z", { exact: true });
  const redoLineCount = await redoShortcut.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getClientRects().length;
  });
  assert.equal(redoLineCount, 1, "redo shortcut must stay on one line");
  const redoShortcutBox = await redoShortcut.boundingBox();
  const redoDescriptionBox = await page.getByText("다시 실행", { exact: true }).boundingBox();
  assert.ok(redoShortcutBox && redoDescriptionBox, "redo help row must have measurable geometry");
  assert.ok(
    redoShortcutBox.x + redoShortcutBox.width <= redoDescriptionBox.x,
    "redo shortcut must not overlap its description",
  );
  await page.getByTitle("도움말 닫기").click();
  await page.getByTitle("속성 패널").click();
  await page.getByTitle("속성 패널 닫기").click();
  await page.screenshot({ path: path.join(evidenceRoot, "mobile.png"), fullPage: true });
  assert.deepEqual(runtimeErrors, []);
});
