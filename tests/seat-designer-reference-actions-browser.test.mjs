import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { bootstrapAdminPassword, startServer } from "./backend-test-utils.mjs";

async function login(adminUrl) {
  const response = await fetch(`${adminUrl}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: bootstrapAdminPassword }) });
  assert.equal(response.status, 200);
  const pair = response.headers.get("set-cookie").split(";")[0];
  const separator = pair.indexOf("=");
  return { name: pair.slice(0, separator), value: pair.slice(separator + 1) };
}

test("every reference creation and edit mode produces observable native geometry", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ticketground-reference-actions-"));
  await mkdir(path.join(root, "charts"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const server = await startServer(t, { env: { TIG_SEAT_CHART_DATA_DIR: path.join(root, "charts"), TIG_SEAT_CHART_CREDENTIAL_DIR: path.join(root, "credentials") } });
  const cookie = await login(server.adminUrl);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ ...cookie, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  page.setDefaultTimeout(8_000);
  const screenshotRoot = path.resolve(".omo/evidence/seat-designer-parity/reference-actions");
  await mkdir(screenshotRoot, { recursive: true });
  await page.goto(`${server.adminUrl}/admin/seat-designer`, { waitUntil: "networkidle" });
  const start = page.getByRole("dialog", { name: "새 좌석 차트 만들기" });
  await start.locator("select").selectOption({ index: 1 });
  await start.getByRole("button", { name: "빈 캔버스" }).click();
  await start.waitFor({ state: "hidden" });
  const canvas = page.getByTestId("designer-canvas");
  const box = await canvas.boundingBox();
  assert.ok(box);
  const at = (x, y) => ({ x: box.x + x, y: box.y + y });
  const click = async (x, y) => page.mouse.click(at(x, y).x, at(x, y).y);
  const drag = async (x1, y1, x2, y2) => {
    await page.mouse.move(at(x1, y1).x, at(x1, y1).y);
    await page.mouse.down();
    await page.mouse.move(at(x2, y2).x, at(x2, y2).y);
    await page.mouse.up();
  };
  const choose = async (tool, mode) => {
    await page.getByTestId(`tool-${tool}`).click();
    await page.locator(`[role="menuitem"][data-mode="${mode}"]`).click();
    assert.equal(await page.getByTestId(`tool-${tool}`).getAttribute("data-mode"), mode);
  };

  await page.getByTestId("tool-row").click();
  assert.equal(await page.getByTestId("tool-row").getAttribute("aria-expanded"), "true");
  await page.locator('[role="menuitem"][data-mode="row"]').click();
  assert.equal(await page.getByTestId("tool-row").getAttribute("data-mode"), "row");
  await drag(110, 100, 310, 100);
  assert.match(await page.getByTestId("designer-status").textContent(), /객체 추가/);
  assert.equal(await page.locator('[data-object-type="row"]').count(), 1);

  await choose("row", "rowSegmented");
  await click(110, 160); await click(220, 190); await click(330, 160); await page.keyboard.press("Enter");
  assert.equal((await page.locator('[data-object-type="row"]').nth(1).locator("polyline").first().getAttribute("points")).split(" ").length, 3);

  await choose("row", "rowsMultiple");
  await drag(420, 100, 620, 100);
  assert.equal(await page.locator('[data-object-type="row"]').count(), 7);

  await page.getByTestId("tool-section").click();
  await click(90, 250); await click(230, 240); await click(250, 340); await click(80, 350); await page.keyboard.press("Enter");
  assert.equal(await page.locator('[data-object-type="section"] path').count(), 1);

  await choose("table", "tableRound");
  await click(380, 280);
  assert.equal(await page.locator('[data-object-type="table"]').first().locator("circle").count(), 7);

  await choose("table", "tableRectangular");
  await drag(740, 120, 920, 200);
  assert.match(await page.getByTestId("designer-status").textContent(), /객체 추가/);
  assert.equal(await page.locator('[data-object-type="table"]').count(), 2);
  const rectangularTable = page.locator('[data-object-type="table"]').nth(1);
  await rectangularTable.locator("rect").waitFor();
  assert.equal(await rectangularTable.locator("circle").count(), 8);
  await page.getByTestId("tool-select").click();
  await rectangularTable.locator("rect").click({ force: true });
  await page.getByTestId("rectangular-table-inspector").waitFor();

  await page.getByTestId("tool-booth").click();
  await click(730, 280);
  const booth = page.locator('[data-object-type="booth"] rect').first();
  assert.equal(Number(await booth.getAttribute("width")), 50);
  assert.equal(Number(await booth.getAttribute("height")), 50);

  await choose("area", "areaRectangle"); await drag(80, 430, 210, 510);
  await choose("area", "areaEllipse"); await drag(250, 430, 380, 510);
  await choose("area", "areaPolygon"); await click(420, 430); await click(540, 430); await click(520, 520); await page.keyboard.press("Enter");
  assert.equal(await page.locator('[data-object-type="area"]').count(), 3);
  await page.locator('[data-object-type="area"]').nth(1).locator("ellipse").waitFor();

  await choose("rectangle", "shapeRectangle"); await drag(590, 420, 700, 500);
  await choose("rectangle", "shapeEllipse"); await drag(730, 420, 850, 500);
  await choose("rectangle", "shapePolygon"); await click(880, 420); await click(980, 430); await click(950, 510); await page.keyboard.press("Enter");
  assert.equal(await page.locator('[data-object-type="rectangle"]').count(), 3);

  await page.getByTestId("tool-line").click();
  await click(100, 600); await click(230, 570); await click(350, 610); await page.keyboard.press("Enter");
  assert.equal((await page.locator('[data-object-type="line"] polyline').getAttribute("points")).split(" ").length, 3);

  page.once("dialog", (dialog) => void dialog.accept("출입구 안내"));
  await page.getByTestId("tool-text").click(); await click(450, 600);
  await page.locator('[data-object-type="text"]').waitFor();

  await page.getByTestId("tool-icon").click(); await click(570, 600);
  const icon = page.locator('[data-object-type="icon"] circle');
  assert.equal(Number(await icon.getAttribute("r")), 22);

  await page.getByTestId("tool-image").click();
  const chooser = page.waitForEvent("filechooser");
  await click(670, 560);
  await (await chooser).setFiles(path.resolve("public/images/misc/2b6c799906bc4462.png"));
  await page.locator('[data-object-type="image"] image').waitFor();

  await page.getByTestId("tool-focal").click(); await click(520, 70);
  await page.getByTestId("chart-focal-point").waitFor();

  await page.getByTestId("tool-select").click();
  const polygonShape = page.locator('[data-object-type="rectangle"]').nth(2).locator("path");
  await polygonShape.click({ force: true });
  assert.equal(await page.getByTestId("resize-handle").count(), 4);
  const polygonBeforeResize = await polygonShape.getAttribute("d");
  const southEast = page.locator('[data-testid="resize-handle"][data-corner="se"]');
  const resizeBox = await southEast.boundingBox();
  assert.ok(resizeBox);
  await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + resizeBox.width / 2 + 45, resizeBox.y + resizeBox.height / 2 + 35);
  await page.mouse.up();
  assert.notEqual(await polygonShape.getAttribute("d"), polygonBeforeResize);
  await page.screenshot({ path: path.join(screenshotRoot, "shape-resized.png"), fullPage: true });

  const rotationHandle = page.getByTestId("rotation-handle");
  const rotationBox = await rotationHandle.boundingBox();
  assert.ok(rotationBox);
  await page.mouse.move(rotationBox.x + rotationBox.width / 2, rotationBox.y + rotationBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(rotationBox.x + 80, rotationBox.y + 35);
  await page.mouse.up();
  assert.notEqual(await page.getByLabel("회전").inputValue(), "0");

  await page.getByTestId("tool-node").click();
  assert.equal(await page.getByTestId("node-handle").count(), 3);
  const firstNode = await page.getByTestId("node-handle").nth(0).boundingBox();
  const secondNode = await page.getByTestId("node-handle").nth(1).boundingBox();
  assert.ok(firstNode && secondNode);
  await page.getByTestId("node-edge").dispatchEvent("click", {
    clientX: (firstNode.x + secondNode.x) / 2,
    clientY: (firstNode.y + secondNode.y) / 2,
  });
  assert.equal(await page.getByTestId("node-handle").count(), 4);
  await page.getByTestId("node-handle").first().click({ button: "right", force: true });
  assert.equal(await page.getByTestId("node-handle").count(), 3, "a polygon cannot be reduced below three nodes");
  await page.screenshot({ path: path.join(screenshotRoot, "polygon-node-edit.png"), fullPage: true });

  await page.getByTestId("tool-select").click();
  const image = page.locator('[data-object-type="image"] image');
  await image.click({ force: true });
  const imageHref = await image.getAttribute("href");
  await page.getByText(/불투명도/).locator("input").fill("0.5");
  assert.equal(await image.getAttribute("opacity"), "0.5");
  const replacement = page.getByText("이미지 교체").locator('input[type="file"]');
  await replacement.setInputFiles(path.resolve("public/images/header/partner-nol.png"));
  await page.waitForFunction((previous) => document.querySelector('[data-object-type="image"] image')?.getAttribute("href") !== previous, imageHref);
  const layerSelect = page.getByLabel("레이어");
  await layerSelect.selectOption("foreground");
  assert.equal(await layerSelect.inputValue(), "foreground");
  const lock = page.getByLabel("잠금");
  await lock.check();
  assert.equal(await page.getByTestId("selection-overlay").count(), 0);
  await lock.uncheck();
  assert.equal(await page.getByTestId("selection-overlay").count(), 1);
  await page.screenshot({ path: path.join(screenshotRoot, "image-edit-inspector.png"), fullPage: true });

  await page.getByTitle("미리보기").click();
  await page.getByRole("button", { name: "미리보기 종료" }).waitFor();
});
