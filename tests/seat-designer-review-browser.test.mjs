import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
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
