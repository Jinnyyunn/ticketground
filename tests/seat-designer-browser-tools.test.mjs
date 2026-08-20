import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import sharp from "sharp";
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

test("every native designer tool family is operable in the real admin browser", async (t) => {
  const evidenceRoot = await mkdtemp(path.join(os.tmpdir(), "ticketground-designer-browser-"));
  await mkdir(path.join(evidenceRoot, "charts"));
  const referencePath = path.join(evidenceRoot, "seat-reference.png");
  const circles = Array.from({ length: 20 }, (_, index) => `<circle cx="${60 + (index % 5) * 45}" cy="${60 + Math.floor(index / 5) * 40}" r="8" fill="#111"/>`).join("");
  await sharp(Buffer.from(`<svg width="320" height="240" xmlns="http://www.w3.org/2000/svg"><rect width="320" height="240" fill="white"/>${circles}</svg>`)).png().toFile(referencePath);
  t.after(() => rm(evidenceRoot, { recursive: true, force: true }));
  const server = await startServer(t, { env: { TIG_SEAT_CHART_DATA_DIR: path.join(evidenceRoot, "charts"), TIG_SEAT_CHART_CREDENTIAL_DIR: path.join(evidenceRoot, "credentials") } });
  const cookie = await login(server.adminUrl);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ ...cookie, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await context.addInitScript(() => localStorage.setItem("ticketground.seat-designer.tutorial.v1", "done"));
  const page = await context.newPage();
  page.setDefaultTimeout(5_000);
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.goto(`${server.adminUrl}/admin/seat-designer`, { waitUntil: "networkidle" });
  await page.getByTestId("seat-designer-shell").waitFor();
  const screenshotRoot = path.resolve(".omo/evidence/seat-designer-parity/browser");
  await mkdir(screenshotRoot, { recursive: true });
  await page.screenshot({ path: path.join(screenshotRoot, "seat-designer-default.png"), fullPage: true });

  const shortcuts = { select: "v", selectSeats: "x", brush: "c", selectSame: "z", node: "a", focal: "f", row: "r", section: "s", table: "e", booth: "b", area: "g", rectangle: "h", line: "l", text: "t", image: "i", icon: "o" };
  for (const [tool, key] of Object.entries(shortcuts)) {
    await page.getByTestId(`tool-${tool}`).click();
    assert.equal(await page.getByTestId(`tool-${tool}`).getAttribute("aria-pressed"), "true", `${tool} click`);
    await page.keyboard.press(key);
    assert.equal(await page.getByTestId(`tool-${tool}`).getAttribute("aria-pressed"), "true", `${tool} shortcut`);
  }
  await page.getByTestId("tool-hand").click();
  assert.equal(await page.getByTestId("tool-hand").getAttribute("aria-pressed"), "true");

  await page.getByRole("button", { name: "새 차트 만들기" }).click();
  await page.getByRole("dialog", { name: "새 좌석 차트 만들기" }).getByRole("button", { name: /빈 차트/ }).click();
  const canvas = page.getByTestId("designer-canvas");
  const box = await canvas.boundingBox();
  assert.ok(box);
  const point = (x, y) => ({ x: box.x + x, y: box.y + y });

  const initialTransform = await canvas.locator("svg > g").first().getAttribute("transform");
  await page.getByTitle("확대").click();
  assert.notEqual(await canvas.locator("svg > g").first().getAttribute("transform"), initialTransform);
  await page.getByTitle("축소").click();
  for (const title of ["그리드에 맞추기", "구역 내부 좌석 표시", "항상 라벨 표시", "참조 도면 표시", "배경 이미지 표시", "다크 캔버스"]) {
    await page.getByTitle(title).click();
    await page.getByTitle(title).click();
  }
  await page.getByTitle("다크 캔버스").click();
  await page.screenshot({ path: path.join(screenshotRoot, "seat-designer-dark.png"), fullPage: true });
  await page.getByTitle("다크 캔버스").click();
  await page.getByTestId("tool-hand").click();
  const beforePan = await canvas.locator("svg > g").first().getAttribute("transform");
  await page.mouse.move(...Object.values(point(500, 400)));
  await page.mouse.down();
  await page.mouse.move(...Object.values(point(540, 430)));
  await page.mouse.up();
  assert.notEqual(await canvas.locator("svg > g").first().getAttribute("transform"), beforePan);

  await page.getByTestId("tool-focal").click();
  assert.equal(await page.getByTestId("tool-focal").getAttribute("aria-pressed"), "true");
  await canvas.dispatchEvent("pointerdown", { clientX: box.x + 600, clientY: box.y + 120, button: 0, pointerId: 1 });
  await canvas.dispatchEvent("pointerup", { clientX: box.x + 600, clientY: box.y + 120, button: 0, pointerId: 1 });
  await page.getByTestId("chart-focal-point").waitFor({ state: "attached" });

  await page.getByTestId("tool-row").click();
  await page.mouse.click(...Object.values(point(360, 280)));
  await page.mouse.click(...Object.values(point(560, 280)));
  await page.locator('[data-object-type="row"]').first().waitFor({ state: "attached" });

  await page.getByTestId("tool-table").click();
  await page.mouse.click(...Object.values(point(650, 340)));
  await page.locator('[data-object-type="table"]').first().waitFor({ state: "attached" });

  await page.getByTestId("tool-line").click();
  await page.mouse.click(...Object.values(point(180, 620)));
  await page.waitForTimeout(80);
  await page.mouse.click(...Object.values(point(430, 620)));
  await page.waitForTimeout(100);
  assert.equal(await page.locator('[data-object-type="line"]').count(), 1, await canvas.innerText());

  for (const tool of ["rectangle", "booth"]) {
    await page.getByTestId(`tool-${tool}`).click();
    await page.mouse.move(...Object.values(point(tool === "rectangle" ? 340 : 520, 500)));
    await page.mouse.down();
    await page.mouse.move(...Object.values(point(tool === "rectangle" ? 460 : 640, 570)));
    await page.mouse.up();
    await page.locator(`[data-object-type="${tool}"]`).first().waitFor({ state: "attached" });
  }

  for (const tool of ["section", "area"]) {
    await page.getByTestId(`tool-${tool}`).click();
    const polygon = tool === "section"
      ? [point(760, 300), point(880, 320), point(840, 420)]
      : [point(740, 600), point(920, 600), point(860, 710)];
    await page.mouse.click(...Object.values(polygon[0]));
    await page.waitForTimeout(50);
    await page.mouse.click(...Object.values(polygon[1]));
    await page.waitForTimeout(50);
    await page.mouse.click(...Object.values(polygon[2]));
    await page.waitForTimeout(50);
    await page.mouse.dblclick(...Object.values(polygon[0]));
    await page.locator(`[data-object-type="${tool}"]`).first().waitFor({ state: "attached" });
  }

  await page.getByTestId("tool-node").click();
  await page.locator('[data-object-type="section"] path').first().click({ force: true });
  await page.getByTestId("node-handle").first().waitFor({ state: "attached" });

  await page.getByTestId("tool-selectSeats").click();
  await page.locator('[data-object-type="row"] circle').first().click({ force: true });
  await page.getByText(/1개 좌석 선택됨/).waitFor();
  await page.getByTestId("tool-brush").click();
  await page.locator('[data-object-type="row"] circle').nth(1).click({ force: true });
  await page.getByText(/개 좌석 선택됨/).waitFor();

  page.once("dialog", (dialog) => void dialog.accept("출입구 안내"));
  await page.getByTestId("tool-text").click();
  await page.mouse.click(...Object.values(point(720, 520)));
  await page.locator('[data-object-type="text"]').first().waitFor({ state: "attached" });

  await page.getByTestId("tool-icon").click();
  await page.mouse.click(...Object.values(point(860, 520)));
  await page.locator('[data-object-type="icon"]').first().waitFor({ state: "attached" });

  await page.getByTestId("tool-image").click();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.mouse.click(...Object.values(point(120, 120)));
  const chooser = await chooserPromise;
  await chooser.setFiles(path.resolve("public/images/misc/2b6c799906bc4462.png"));
  await page.locator('[data-object-type="image"]').first().waitFor({ state: "attached" });

  await page.getByTestId("tool-select").click();
  await page.locator('[data-object-type="row"] circle').first().click({ force: true });
  const beforeDuplicate = await page.locator('[data-object-type="row"]').count();
  await page.getByTitle("좌우 반전").click();
  await page.getByTitle("상하 반전").click();
  await page.getByTitle("가운데 정렬").click();
  await page.getByTitle(/복제/).click();
  assert.equal(await page.locator('[data-object-type="row"]').count(), beforeDuplicate + 1);
  await page.getByTitle("복사 (⌘C)").click();
  await page.getByTitle("붙여넣기 (⌘V)").click();
  assert.equal(await page.locator('[data-object-type="row"]').count(), beforeDuplicate + 2);
  await page.getByTitle("삭제").click();
  assert.equal(await page.locator('[data-object-type="row"]').count(), beforeDuplicate + 1);
  await page.keyboard.press("Control+z");
  assert.equal(await page.locator('[data-object-type="row"]').count(), beforeDuplicate + 2);
  await page.keyboard.press("Control+Shift+z");
  assert.equal(await page.locator('[data-object-type="row"]').count(), beforeDuplicate + 1);

  await page.getByTitle("선택 레이어").click();
  for (const label of ["모든 객체", "전경 장식", "인터랙티브 객체", "배경 장식", "주변 요소"]) {
    await page.getByRole("button", { name: label }).click();
    if (label !== "주변 요소") await page.getByTitle("선택 레이어").click();
  }

  await page.getByTitle("층 편집").click();
  const floorsDialog = page.getByRole("heading", { name: "층 편집", exact: true }).locator("..").locator("..");
  await floorsDialog.getByRole("button", { name: "층 추가", exact: true }).click();
  assert.equal(await floorsDialog.locator('input[type="text"], input:not([type])').count(), 2);
  await floorsDialog.locator("button").first().click();

  await page.getByRole("button", { name: "관리", exact: true }).click();
  const categoriesDialog = page.getByRole("heading", { name: "카테고리 관리", exact: true }).locator("..").locator("..");
  const categoriesBefore = await categoriesDialog.locator('input[type="color"]').count();
  await categoriesDialog.getByRole("button", { name: /카테고리 추가/ }).click();
  assert.equal(await categoriesDialog.locator('input[type="color"]').count(), categoriesBefore + 1);
  await categoriesDialog.locator("button").first().click();

  await page.getByRole("button", { name: "설정", exact: true }).click();
  await page.getByText("공연장", { exact: true }).waitFor();
  const venue = await page.evaluate(async () => {
    const response = await fetch("/api/admin/venues");
    const body = await response.json();
    return body.data.venues[0];
  });
  assert.ok(venue?.name);
  await page.getByRole("button", { name: venue.name, exact: true }).click();
  await page.getByRole("button", { name: "존 추가", exact: true }).click();
  await page.screenshot({ path: path.join(screenshotRoot, "seat-designer-settings.png"), fullPage: true });
  await page.getByLabel("API 키 이름").fill("브라우저 검증 키");
  await page.getByRole("button", { name: "읽기 키 생성", exact: true }).click();
  await page.getByText("이 키는 다시 표시되지 않습니다.", { exact: true }).waitFor();
  await page.locator("div.fixed.inset-0.z-50 button").first().click();

  const saveResponsePromise = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/seat-charts");
  await page.getByRole("button", { name: "저장 후 나가기", exact: true }).click();
  const saveResponse = await saveResponsePromise;
  assert.equal(saveResponse.status(), 200, await saveResponse.text());
  const library = page.getByTestId("seat-chart-library-screen");
  await library.waitFor();
  await page.screenshot({ path: path.join(screenshotRoot, "seat-chart-library.png"), fullPage: true });
  await library.getByRole("button", { name: "열기", exact: true }).first().click();
  await page.getByTestId("seat-designer-shell").waitFor();

  await page.getByTitle("미리보기").click();
  const previewCanvasBox = await page.getByTestId("designer-canvas").boundingBox();
  assert.ok(previewCanvasBox);
  assert.ok(previewCanvasBox.height >= 700, `preview canvas collapsed to ${previewCanvasBox.height}px`);
  await page.screenshot({ path: path.join(screenshotRoot, "seat-designer-preview.png"), fullPage: true });
  await page.getByRole("button", { name: "미리보기 종료", exact: true }).click();
  await page.screenshot({ path: path.join(screenshotRoot, "seat-designer-tools.png"), fullPage: true });

  await page.getByRole("button", { name: "새 차트 만들기" }).click();
  const dialog = page.getByRole("dialog", { name: "새 좌석 차트 만들기" });
  await dialog.getByRole("button", { name: /도면 불러오기/ }).click();
  await dialog.locator('input[type="file"]').setInputFiles(referencePath);
  await dialog.getByRole("button", { name: "좌석 자동 인식", exact: true }).click();
  await dialog.getByRole("region", { name: "좌석 자동 인식 검토" }).waitFor();
  await page.screenshot({ path: path.join(screenshotRoot, "scanner-review.png"), fullPage: true });
  await dialog.getByRole("button", { name: "감지 좌석 확정", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await page.locator('[data-object-type="row"]').first().waitFor({ state: "attached" });
  await page.screenshot({ path: path.join(screenshotRoot, "scanner-accepted.png"), fullPage: true });

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`${server.adminUrl}/admin/seat-designer`, { waitUntil: "networkidle" });
  await page.getByTestId("seat-designer-shell").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(screenshotRoot, "seat-designer-compact.png"), fullPage: true });
  assert.deepEqual(runtimeErrors, []);
});
