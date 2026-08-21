import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { bootstrapAdminPassword, startServer } from "./backend-test-utils.mjs";

async function login(adminUrl) {
  const response = await fetch(`${adminUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: bootstrapAdminPassword }),
  });
  assert.equal(response.status, 200);
  const pair = response.headers.get("set-cookie").split(";")[0];
  const separator = pair.indexOf("=");
  return { name: pair.slice(0, separator), value: pair.slice(separator + 1) };
}

async function openEditor(t, initialize) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ticketground-review-browser-"));
  await mkdir(path.join(root, "charts"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const server = await startServer(t, { env: { TIG_SEAT_CHART_DATA_DIR: path.join(root, "charts"), TIG_SEAT_CHART_CREDENTIAL_DIR: path.join(root, "credentials") } });
  const cookie = await login(server.adminUrl);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ ...cookie, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await context.addInitScript((seed) => {
    localStorage.setItem("ticketground.seat-designer.tutorial.v1", "done");
    if (seed) localStorage.setItem("ticketground.seat-designer.chart.v5", JSON.stringify(seed));
  }, initialize ?? null);
  const page = await context.newPage();
  page.setDefaultTimeout(8_000);
  await page.goto(`${server.adminUrl}/admin/seat-designer`, { waitUntil: "networkidle" });
  await page.getByTestId("seat-designer-shell").waitFor();
  return { page, server };
}

async function beginBlank(page) {
  const dialog = page.getByRole("dialog", { name: "새 좌석 차트 만들기" });
  await dialog.locator("select").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "빈 캔버스" }).click();
  await dialog.waitFor({ state: "hidden" });
}

test("a restored local draft bypasses the destructive new-chart dialog", async (t) => {
  const restored = {
    id: "restored-chart",
    name: "복원된 초안",
    categories: [{ key: "vip", label: "VIP", color: "#111111" }],
    floors: [{ id: "floor-1", name: "1층", index: 1 }],
    activeFloorId: "floor-1",
    objects: [{ id: "row-1", type: "row", label: "A", layer: "interactive", start: { x: 100, y: 100 }, end: { x: 300, y: 100 }, seatCount: 2, seats: [{ id: "a1", label: "1", x: 100, y: 100 }, { id: "a2", label: "2", x: 300, y: 100 }] }],
  };
  const { page } = await openEditor(t, restored);
  assert.equal(await page.locator(".seat-designer-toolbar input").inputValue(), "복원된 초안");
  assert.equal(await page.getByRole("dialog", { name: "새 좌석 차트 만들기" }).count(), 0);
  assert.equal(await page.locator('[data-object-id="row-1"]').count(), 1);
});

test("snap, Shift, clipboard, lock, and table inspectors preserve their visible contracts", async (t) => {
  const { page } = await openEditor(t);
  await beginBlank(page);
  const canvas = page.getByTestId("designer-canvas");
  const box = await canvas.boundingBox();
  assert.ok(box);
  const point = (x, y) => ({ x: box.x + x, y: box.y + y });
  const drag = async (from, to) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y);
    await page.mouse.up();
  };

  await page.getByTitle("그리드에 맞추기").click();
  await page.getByTestId("tool-row").click();
  await page.locator('[role="menuitem"][data-mode="row"]').click();
  await drag(point(101.5, 111.5), point(204.5, 145.5));
  const freeRow = page.locator('[data-object-type="row"]').first();
  const freeX = Number(await freeRow.locator("circle").first().getAttribute("cx"));
  assert.notEqual(Math.round(freeX * 1000) % 8000, 0, "snap-off coordinates must remain free");

  await page.keyboard.down("Shift");
  await drag(point(310, 130), point(485, 195));
  await page.keyboard.up("Shift");
  const constrained = page.locator('[data-object-type="row"]').nth(1);
  const constrainedSeats = constrained.locator("circle");
  const first = { x: Number(await constrainedSeats.first().getAttribute("cx")), y: Number(await constrainedSeats.first().getAttribute("cy")) };
  const last = { x: Number(await constrainedSeats.last().getAttribute("cx")), y: Number(await constrainedSeats.last().getAttribute("cy")) };
  const angle = Math.atan2(last.y - first.y, last.x - first.x) * 180 / Math.PI;
  assert.ok(Math.abs(angle / 15 - Math.round(angle / 15)) < 0.01, `row angle ${angle} must honor Shift`);

  await page.getByTestId("tool-row").click();
  await page.locator('[role="menuitem"][data-mode="rowSegmented"]').click();
  for (const location of [point(600, 180), point(680, 240), point(760, 180)]) await page.mouse.click(location.x, location.y);
  await page.keyboard.press("Enter");
  const segmented = page.locator('[data-object-type="row"]').last();
  const sourcePoints = (await segmented.locator("polyline").first().getAttribute("points")).split(" ").map((entry) => entry.split(",").map(Number));
  await page.getByTestId("tool-select").click();
  await segmented.locator("polyline").first().dispatchEvent("click");
  await page.getByTestId("selection-overlay").waitFor();
  const rowCountBeforePaste = await page.locator('[data-object-type="row"]').count();
  await page.getByTitle("복사 (⌘C)").click();
  await page.getByTitle("붙여넣기 (⌘V)").click();
  assert.equal(await page.locator('[data-object-type="row"]').count(), rowCountBeforePaste + 1);
  const pasted = page.locator('[data-object-type="row"]').last();
  const pastedPoints = (await pasted.locator("polyline").first().getAttribute("points")).split(" ").map((entry) => entry.split(",").map(Number));
  assert.deepEqual(pastedPoints, sourcePoints.map(([x, y]) => [x + 32, y + 32]));

  const rowCountBeforeLock = await page.locator('[data-object-type="row"]').count();
  await page.getByLabel("잠금").check();
  await page.getByTitle("삭제").click();
  assert.equal(await page.locator('[data-object-type="row"]').count(), rowCountBeforeLock);

  await page.getByTestId("tool-table").click();
  await page.locator('[role="menuitem"][data-mode="tableRound"]').click();
  await page.mouse.click(point(900, 260).x, point(900, 260).y);
  const round = page.locator('[data-object-type="table"]').last();
  await page.getByTestId("tool-select").click();
  await round.locator("circle").first().click({ force: true });
  await page.getByLabel("가변 점유").check();
  await page.getByLabel("최소 인원").waitFor();
  await page.getByLabel("최대 인원").waitFor();

  await page.getByTestId("tool-table").click();
  await page.locator('[role="menuitem"][data-mode="tableRectangular"]').click();
  await page.mouse.click(point(980, 500).x, point(980, 500).y);
  const rectangular = page.locator('[data-object-type="table"]').last();
  assert.equal(Number(await rectangular.locator("rect").getAttribute("width")), 120);
  assert.equal(Number(await rectangular.locator("rect").getAttribute("height")), 36);
  await page.getByTestId("tool-select").click();
  await rectangular.locator("rect").click({ force: true });
  await page.getByLabel("전체 테이블로 예매").waitFor();
  await page.getByLabel("가변 점유").check();
  await page.getByLabel("최소 인원").waitFor();
  await page.getByLabel("최대 인원").waitFor();
});

test("reference names and concurrent image imports merge into the latest chart", async (t) => {
  const { page } = await openEditor(t);
  const dialog = page.getByRole("dialog", { name: "새 좌석 차트 만들기" });
  await dialog.locator("select").selectOption({ index: 1 });
  await dialog.getByLabel("좌석 배치도 이름").fill("공연장 기준 도면");
  await dialog.getByRole("button", { name: /도면 불러오기/ }).click();
  await dialog.locator('input[type="file"]').setInputFiles(path.resolve("public/images/misc/2b6c799906bc4462.png"));
  await dialog.getByRole("button", { name: "도면만 불러오기" }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await page.locator(".seat-designer-toolbar input").inputValue(), "공연장 기준 도면");

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
  const canvas = page.getByTestId("designer-canvas");
  const box = await canvas.boundingBox();
  assert.ok(box);
  await page.getByTestId("tool-image").click();
  assert.equal(await page.getByTestId("tool-image").getAttribute("aria-pressed"), "true");
  const chooser = page.waitForEvent("filechooser");
  await page.mouse.click(box.x + 260, box.y + 220);
  await (await chooser).setFiles(path.resolve("public/images/header/partner-nol.png"));
  await started;
  await page.getByTestId("tool-icon").click();
  await page.mouse.click(box.x + 520, box.y + 260);
  assert.equal(await page.locator('[data-object-type="icon"]').count(), 1);
  releaseUpload();
  await page.locator('[data-object-type="image"]').waitFor();
  assert.equal(await page.locator('[data-object-type="icon"]').count(), 1, "upload completion must preserve intervening edits");
  await page.getByRole("button", { name: "저장 후 나가기" }).click();
  await page.getByText("저장된 좌석 차트", { exact: true }).waitFor();
  const savedAssets = await page.evaluate(async () => {
    const list = await fetch("/api/seat-charts").then((response) => response.json());
    const latest = list.charts[0];
    const detail = await fetch(`/api/seat-charts/${latest.id}`).then((response) => response.json());
    return detail.record.chart.assets;
  });
  assert.equal(savedAssets.length, 2);
  assert.deepEqual(savedAssets.map((asset) => asset.kind).sort(), ["object", "reference"]);
});

test("reference import rejects files above ten megabytes before upload", async (t) => {
  const { page } = await openEditor(t);
  const dialog = page.getByRole("dialog", { name: "새 좌석 차트 만들기" });
  await dialog.locator("select").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: /도면 불러오기/ }).click();
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "too-large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await dialog.getByRole("alert").filter({ hasText: "도면 파일은 최대 10MB까지 불러올 수 있습니다." }).waitFor();
  assert.equal(await dialog.getByRole("button", { name: "도면만 불러오기" }).isDisabled(), true);
});

test("rotated polygon node controls follow the rendered geometry", async (t) => {
  const polygon = { id: "polygon", type: "rectangle", shape: "polygon", label: "다각형", layer: "background", rotation: 90, x: 100, y: 100, width: 220, height: 80, points: [{ x: 100, y: 100 }, { x: 320, y: 100 }, { x: 280, y: 180 }, { x: 100, y: 180 }] };
  const restored = { id: "rotated-chart", name: "회전 노드", categories: [], floors: [{ id: "floor-1", name: "1층", index: 1 }], activeFloorId: "floor-1", objects: [polygon] };
  const { page } = await openEditor(t, restored);
  const shape = page.locator('[data-object-id="polygon"] path');
  await shape.click({ force: true });
  await page.getByTestId("tool-node").click();
  const edge = page.getByTestId("node-edge");
  const shapeBox = await shape.boundingBox();
  const edgeBox = await edge.boundingBox();
  assert.ok(shapeBox && edgeBox);
  assert.ok(Math.abs(shapeBox.x + shapeBox.width / 2 - edgeBox.x - edgeBox.width / 2) < 1);
  assert.ok(Math.abs(shapeBox.y + shapeBox.height / 2 - edgeBox.y - edgeBox.height / 2) < 1);
  const nodeOffsets = await shape.evaluate((element, points) => {
    const matrix = element.getScreenCTM();
    const handles = [...document.querySelectorAll('[data-testid="node-handle"]')];
    if (!matrix || handles.length !== points.length) return null;
    return points.map((point, index) => {
      const expected = new DOMPoint(point.x, point.y).matrixTransform(matrix);
      const box = handles[index].getBoundingClientRect();
      return { x: box.x + box.width / 2 - expected.x, y: box.y + box.height / 2 - expected.y };
    });
  }, polygon.points);
  assert.ok(nodeOffsets);
  for (const offset of nodeOffsets) {
    assert.ok(Math.abs(offset.x) < 1, `rotated node x offset ${offset.x} must align with its vertex`);
    assert.ok(Math.abs(offset.y) < 1, `rotated node y offset ${offset.y} must align with its vertex`);
  }
});

test("shape border edits render after deselection", async (t) => {
  const ellipse = { id: "ellipse", type: "rectangle", shape: "ellipse", label: "타원", layer: "background", x: 100, y: 100, width: 220, height: 100, fill: "#eeeeee", stroke: "#111111" };
  const restored = { id: "stroke-chart", name: "도형 테두리", categories: [], floors: [{ id: "floor-1", name: "1층", index: 1 }], activeFloorId: "floor-1", objects: [ellipse] };
  const { page } = await openEditor(t, restored);
  const shape = page.locator('[data-object-id="ellipse"] ellipse');
  await shape.click({ force: true });
  await page.getByLabel("테두리").fill("#bc204b");
  await page.getByTestId("designer-canvas").click({ position: { x: 1000, y: 700 } });
  assert.equal(await shape.getAttribute("stroke"), "#bc204b");
});

test("oversized image replacement reports a visible error", async (t) => {
  const image = { id: "image", type: "image", label: "도면", layer: "background", x: 100, y: 100, width: 240, height: 160, href: "/images/header/partner-nol.png" };
  const restored = { id: "image-chart", name: "이미지 교체", categories: [], floors: [{ id: "floor-1", name: "1층", index: 1 }], activeFloorId: "floor-1", objects: [image] };
  const { page } = await openEditor(t, restored);
  await page.locator('[data-object-id="image"] image').click({ force: true });
  await page.getByText("이미지 교체", { exact: true }).locator('input[type="file"]').setInputFiles({ name: "too-large.png", mimeType: "image/png", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await page.getByText("이미지는 10MB 이하여야 합니다.", { exact: true }).waitFor();
});

test("active image mode accepts a file dropped on the canvas", async (t) => {
  const { page } = await openEditor(t);
  await beginBlank(page);
  await page.getByTestId("tool-image").click();
  const png = await readFile(path.resolve("public/images/header/partner-nol.png"));
  await page.getByTestId("designer-canvas").evaluate((element, base64) => {
    const transfer = new DataTransfer();
    const source = atob(base64);
    transfer.items.add(new File([Uint8Array.from(source, (character) => character.charCodeAt(0))], "dropped.png", { type: "image/png" }));
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
  }, png.toString("base64"));
  await page.locator('[data-object-type="image"]').waitFor();
});

test("locked objects remain selectable so they can be unlocked", async (t) => {
  const locked = { id: "locked", type: "rectangle", shape: "rectangle", label: "잠긴 도형", layer: "background", locked: true, x: 100, y: 100, width: 220, height: 100 };
  const restored = { id: "locked-chart", name: "잠금", categories: [], floors: [{ id: "floor-1", name: "1층", index: 1 }], activeFloorId: "floor-1", objects: [locked] };
  const { page } = await openEditor(t, restored);
  await page.locator('[data-object-id="locked"] rect').click({ force: true });
  const control = page.getByLabel("잠금");
  await control.waitFor();
  assert.equal(await control.isChecked(), true);
  assert.equal(await page.getByTestId("selection-overlay").count(), 0, "locked objects must not expose move handles");
  await page.getByTitle("복사 (⌘C)").click();
  await page.getByTitle("붙여넣기 (⌘V)").click();
  assert.equal(await page.locator('[data-object-type="rectangle"]').count(), 1, "locked objects must not enter the clipboard");
  await control.uncheck();
  await page.getByTestId("selection-overlay").waitFor();
});

test("selection overlay rotates around the rendered object pivot", async (t) => {
  const section = { id: "section", type: "section", label: "비대칭 구역", layer: "interactive", rotation: 135, points: [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 110 }, { x: 500, y: 120 }, { x: 500, y: 300 }], capacity: 30 };
  const restored = { id: "pivot-chart", name: "회전 중심", categories: [], floors: [{ id: "floor-1", name: "1층", index: 1 }], activeFloorId: "floor-1", objects: [section] };
  const { page } = await openEditor(t, restored);
  const shape = page.locator('[data-object-id="section"] path');
  await shape.click({ force: true });
  const transforms = await shape.evaluate((element) => ({
    object: element.parentElement?.parentElement?.getAttribute("transform"),
    overlay: document.querySelector('[data-testid="selection-overlay"]')?.getAttribute("transform"),
  }));
  assert.equal(transforms.overlay, transforms.object);
  await page.getByTitle("그리드에 맞추기").click();
  const handle = page.locator('[data-testid="resize-handle"][data-corner="se"]');
  const before = await handle.boundingBox();
  assert.ok(before);
  const target = { x: before.x + before.width / 2 + 90, y: before.y + before.height / 2 + 55 };
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y);
  await page.mouse.up();
  const after = await handle.boundingBox();
  assert.ok(after);
  assert.ok(Math.abs(after.x + after.width / 2 - target.x) < 2);
  assert.ok(Math.abs(after.y + after.height / 2 - target.y) < 2);
});

test("concurrent settings uploads merge overlays and assets into the latest chart", async (t) => {
  const { page } = await openEditor(t);
  await beginBlank(page);
  let releaseFirst;
  const firstBlocked = new Promise((resolve) => { releaseFirst = resolve; });
  let releaseReplacement;
  const replacementBlocked = new Promise((resolve) => { releaseReplacement = resolve; });
  let markReplacementStarted;
  const replacementStarted = new Promise((resolve) => { markReplacementStarted = resolve; });
  let releaseRemoval;
  const removalBlocked = new Promise((resolve) => { releaseRemoval = resolve; });
  let markRemovalStarted;
  const removalStarted = new Promise((resolve) => { markRemovalStarted = resolve; });
  let markRemovalCompleted;
  const removalCompleted = new Promise((resolve) => { markRemovalCompleted = resolve; });
  let uploadCount = 0;
  await page.route("**/api/seat-charts", async (route) => {
    if (route.request().method() !== "POST" || !route.request().headers()["content-type"]?.includes("multipart/form-data")) return route.continue();
    uploadCount += 1;
    if (uploadCount === 1) await firstBlocked;
    if (uploadCount === 3) {
      markReplacementStarted();
      await replacementBlocked;
    }
    if (uploadCount === 4) {
      markRemovalStarted();
      await removalBlocked;
    }
    await route.continue();
    if (uploadCount === 4) markRemovalCompleted();
  });
  await page.getByTitle("차트 설정 (공연장 연결·배경·참조도면·존)").click();
  const settings = page.getByText("차트 설정 (고급)", { exact: true }).locator("../..");
  const background = settings.locator("section").filter({ hasText: "배경 이미지" });
  const reference = settings.locator("section").filter({ hasText: "참조 도면" });
  let chooser = page.waitForEvent("filechooser");
  await background.getByRole("button", { name: "이미지 추가" }).click();
  await (await chooser).setFiles(path.resolve("public/images/header/partner-nol.png"));
  chooser = page.waitForEvent("filechooser");
  await reference.getByRole("button", { name: "도면 추가" }).click();
  await (await chooser).setFiles(path.resolve("public/images/misc/2b6c799906bc4462.png"));
  await reference.getByRole("button", { name: "도면 교체" }).waitFor();
  releaseFirst();
  await background.getByRole("button", { name: "이미지 교체" }).waitFor();
  chooser = page.waitForEvent("filechooser");
  await background.getByRole("button", { name: "이미지 교체" }).click();
  await (await chooser).setFiles(path.resolve("public/images/misc/2b6c799906bc4462.png"));
  await replacementStarted;
  await background.locator('input[type="range"]').fill("0.25");
  await page.getByText("차트 설정 변경", { exact: true }).waitFor();
  releaseReplacement();
  await page.getByText("배경 이미지 변경", { exact: true }).waitFor();
  assert.equal(await background.locator('input[type="range"]').inputValue(), "0.25");
  chooser = page.waitForEvent("filechooser");
  await background.getByRole("button", { name: "이미지 교체" }).click();
  await (await chooser).setFiles(path.resolve("public/images/header/partner-nol.png"));
  await removalStarted;
  await background.getByRole("button", { name: "제거" }).click();
  await background.getByRole("button", { name: "이미지 추가" }).waitFor();
  releaseRemoval();
  await removalCompleted;
  await background.getByRole("button", { name: "이미지 추가" }).waitFor();
  await settings.getByRole("button").first().click();
  await page.getByRole("button", { name: "저장 후 나가기" }).click();
  await page.getByText("저장된 좌석 차트", { exact: true }).waitFor();
  const saved = await page.evaluate(async () => {
    const list = await fetch("/api/seat-charts").then((response) => response.json());
    return fetch(`/api/seat-charts/${list.charts[0].id}`).then((response) => response.json());
  });
  assert.equal(saved.record.chart.backgroundImage, undefined);
  assert.ok(saved.record.chart.referenceChart);
  assert.deepEqual(saved.record.chart.assets.map((asset) => asset.kind).sort(), ["background", "background", "reference"]);
});

test("Enter inside inspector search never commits an unfinished draft", async (t) => {
  const { page } = await openEditor(t);
  await beginBlank(page);
  const canvas = page.getByTestId("designer-canvas");
  const box = await canvas.boundingBox();
  assert.ok(box);
  await page.getByTestId("tool-row").click();
  await page.locator('[role="menuitem"][data-mode="rowSegmented"]').click();
  await page.mouse.click(box.x + 200, box.y + 200);
  await page.mouse.click(box.x + 280, box.y + 240);
  await page.getByTitle("검색").click();
  const input = page.getByPlaceholder("검색");
  await input.fill("A열");
  await input.press("Enter");
  assert.equal(await page.locator('[data-object-type="row"]').count(), 0);
});
