import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  canvasGeometry,
  chooseTool,
  openV2Editor,
  selectVenue,
} from "./seat-designer-v2-browser-utils.mjs";

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function contrast(first, second) {
  const luminance = ([red, green, blue]) => 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
  const [lighter, darker] = [luminance(first), luminance(second)].toSorted((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

function rgb(value) {
  const channels = value.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
  assert.equal(channels?.length, 3, `expected an RGB color, received ${value}`);
  return channels;
}

test("every clean-room designer tool family is operable in the real admin browser", async (t) => {
  const { page, server, runtimeErrors } = await openV2Editor(t);
  await selectVenue(page);
  const evidenceRoot = path.resolve(".omo/evidence/seat-designer-v2/browser");
  await mkdir(evidenceRoot, { recursive: true });
  const venueId = await page.getByTestId("seat-designer-v2-venue").inputValue();
  await page.getByRole("button", { name: "빈 캔버스로 시작" }).click();
  await page.getByTestId("seat-designer-v2-reference-start").waitFor({ state: "hidden" });
  const { canvas, box, click, drag, point } = await canvasGeometry(page);

  for (const [tool, group] of [["row", "row"], ["roundTable", "table"], ["rectangularArea", "area"], ["rectangle", "shape"]]) {
    await page.getByTestId(`seat-designer-v2-tool-${tool}`).first().click();
    await page.getByTestId(`seat-designer-v2-flyout-${group}`).waitFor();
    await page.screenshot({ path: path.join(evidenceRoot, `flyout-${group}.png`), fullPage: true });
    await page.getByTestId(`seat-designer-v2-tool-${tool}`).first().click();
  }

  await chooseTool(page, "row");
  await drag(150, 110, 360, 110);
  await chooseTool(page, "segmentedRow");
  await click(150, 170);
  await click(260, 200);
  await click(370, 170);
  await click(370, 170);
  await chooseTool(page, "multipleRows");
  await drag(450, 100, 650, 100);
  await drag(450, 100, 450, 160);
  await chooseTool(page, "section");
  for (const [x, y] of [[720, 100], [880, 110], [860, 220], [710, 210]]) await click(x, y);
  await page.keyboard.press("Enter");

  await chooseTool(page, "roundTable");
  await click(480, 300);
  await chooseTool(page, "rectangularTable");
  await click(650, 300);
  await chooseTool(page, "booth");
  await click(820, 300);

  await chooseTool(page, "rectangularArea");
  await drag(100, 360, 220, 440);
  await chooseTool(page, "ellipticArea");
  await drag(250, 360, 370, 440);
  await chooseTool(page, "polygonalArea");
  for (const [x, y] of [[410, 360], [530, 365], [500, 450]]) await click(x, y);
  await page.keyboard.press("Enter");

  await chooseTool(page, "rectangle");
  await drag(560, 360, 670, 440);
  await chooseTool(page, "ellipse");
  await drag(700, 360, 820, 440);
  await chooseTool(page, "polygon");
  for (const [x, y] of [[850, 360], [960, 370], [930, 450]]) await click(x, y);
  await page.keyboard.press("Enter");

  await chooseTool(page, "line");
  await drag(120, 530, 330, 570);
  await chooseTool(page, "text");
  await click(420, 540);
  await chooseTool(page, "icon");
  await click(560, 540);
  await chooseTool(page, "image");
  const chooser = page.waitForEvent("filechooser");
  await click(690, 520);
  await (await chooser).setFiles(path.resolve("public/images/header/partner-nol.png"));
  await page.locator('[data-object-type="image"]').waitFor();
  await chooseTool(page, "focal");
  await click(860, 540);

  for (const [type, minimum] of [["row", 6], ["section", 1], ["table", 2], ["booth", 1], ["area", 3], ["rectangle", 3], ["line", 1], ["text", 1], ["icon", 1], ["image", 1]]) {
    assert.ok(await page.locator(`[data-object-type="${type}"]`).count() >= minimum, `${type} must be rendered`);
  }
  await page.getByTestId("seat-designer-v2-focal-point").waitFor();

  await chooseTool(page, "seatSelect");
  await page.locator('[data-object-type="row"] circle').first().click({ force: true });
  await page.getByText(/1개 좌석 선택됨/).waitFor();
  const seatFields = page.getByTestId("seat-designer-v2-seat-fields");
  await seatFields.waitFor();
  await seatFields.getByText("휠체어 좌석", { exact: true }).click();
  const uploadedSeatViewHref = await page.locator('[data-object-type="image"] image').getAttribute("href");
  assert.ok(uploadedSeatViewHref);
  await seatFields.getByLabel("좌석 시점 이미지 URL").fill(uploadedSeatViewHref);
  await page.screenshot({ path: path.join(evidenceRoot, "seat-properties.png"), fullPage: true });
  await page.getByTitle("좌석 시점").click();
  const seatView = page.getByTestId("seat-designer-v2-seat-view-dialog");
  const seatViewImage = seatView.getByRole("img", { name: "1 좌석 시점" });
  await seatViewImage.waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('[data-testid="seat-designer-v2-seat-view-dialog"] img');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
  });
  await page.screenshot({ path: path.join(evidenceRoot, "seat-view.png"), fullPage: true });
  await seatView.getByTitle("좌석 시점 닫기").click();
  await chooseTool(page, "brush");
  const seat = await page.locator('[data-object-type="row"] circle').nth(1).boundingBox();
  assert.ok(seat);
  await page.mouse.move(seat.x + seat.width / 2, seat.y + seat.height / 2);
  await page.mouse.down();
  await page.mouse.move(seat.x + seat.width / 2 + 45, seat.y + seat.height / 2, { steps: 5 });
  await page.mouse.up();

  await chooseTool(page, "sameType");
  await page.locator('[data-object-type="row"] circle').first().click({ force: true });
  assert.ok(await page.getByTestId("seat-designer-v2-selection-handles").count() >= 6);
  await page.screenshot({ path: path.join(evidenceRoot, "multi-select.png"), fullPage: true });
  await page.getByTitle("가로 균등 배치").click();
  await page.getByTitle("세로 균등 배치").click();
  await page.getByTitle("좌우 반전").click();
  await page.getByTitle("상하 반전").click();

  await page.getByTitle("스냅").click();
  await page.getByTitle("스냅").click();
  await page.getByTitle("좌석 라벨").click();
  await page.getByTitle("좌석 라벨").click();
  await page.getByTitle("구역 내용").click();
  await page.getByTitle("구역 내용").click();
  await page.getByTitle("캔버스 테마").click();
  assert.equal(await canvas.locator("rect").first().getAttribute("fill"), "var(--editor-canvas-dark)");
  const darkColors = await page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="seat-designer-v2-canvas"]');
    const background = canvas?.querySelector(':scope > rect');
    const text = canvas?.querySelector('[data-object-type="text"] text');
    const icon = canvas?.querySelector('[data-object-type="icon"] svg');
    const seatLabel = canvas?.querySelector('[data-seat-id] text');
    if (!(background && text && icon && seatLabel)) throw new Error("dark canvas contrast subjects are missing");
    return {
      background: getComputedStyle(background).fill,
      text: getComputedStyle(text).fill,
      icon: getComputedStyle(icon).stroke,
      seatLabel: getComputedStyle(seatLabel).fill,
    };
  });
  for (const [label, foreground] of Object.entries(darkColors).filter(([label]) => label !== "background")) {
    assert.ok(contrast(rgb(foreground), rgb(darkColors.background)) >= 4.5, `${label} (${foreground}) must remain readable on the dark canvas (${darkColors.background})`);
  }
  await page.screenshot({ path: path.join(evidenceRoot, "dark-canvas.png"), fullPage: true });
  await page.getByTitle("캔버스 테마").click();

  await chooseTool(page, "select");
  await page.keyboard.press("Escape");
  const sourceRow = page.locator('[data-object-type="row"]').first();
  await sourceRow.locator("circle").first().click({ force: true });
  const rowCount = await page.locator('[data-object-type="row"]').count();
  await page.getByTitle("복제").click();
  assert.equal(await page.locator('[data-object-type="row"]').count(), rowCount + 1);
  await page.getByTitle("복사").click();
  await page.getByTitle("붙여넣기").click();
  assert.equal(await page.locator('[data-object-type="row"]').count(), rowCount + 2);
  await page.getByTitle("삭제").click();
  await page.getByTitle("실행 취소").click();
  assert.equal(await page.locator('[data-object-type="row"]').count(), rowCount + 2);
  await page.getByTitle("다시 실행").click();
  assert.equal(await page.locator('[data-object-type="row"]').count(), rowCount + 1);

  await chooseTool(page, "hand");
  const beforePan = await canvas.locator("g").first().getAttribute("transform");
  await page.mouse.move(point(500, 500).x, point(500, 500).y);
  await page.mouse.down();
  await page.mouse.move(point(540, 530).x, point(540, 530).y);
  await page.mouse.up();
  assert.notEqual(await canvas.locator("g").first().getAttribute("transform"), beforePan);

  await chooseTool(page, "select");
  await page.keyboard.press("Escape");
  const beforeSpacePan = await canvas.locator("g").first().getAttribute("transform");
  await page.keyboard.down("Space");
  await page.waitForTimeout(30);
  await page.mouse.move(point(420, 620).x, point(420, 620).y);
  await page.mouse.down();
  await page.mouse.move(point(455, 645).x, point(455, 645).y);
  await page.mouse.up();
  await page.keyboard.up("Space");
  assert.notEqual(await canvas.locator("g").first().getAttribute("transform"), beforeSpacePan);

  await page.getByTitle("미리보기").click();
  await page.getByTestId("seat-designer-v2-preview").waitFor();
  await page.screenshot({ path: path.join(evidenceRoot, "preview.png"), fullPage: true });
  await page.getByTestId("seat-designer-v2-preview").getByRole("button").click();

  await page.getByTitle("도움말").click();
  const help = page.getByTestId("seat-designer-v2-help-dialog");
  await help.getByText("도구와 단축키", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(evidenceRoot, "help-dialog.png"), fullPage: true });
  await help.getByTitle("도움말 닫기").click();
  await page.getByTitle("층 추가").click();
  await page.getByRole("button", { name: "2F", exact: true }).waitFor();
  await page.getByRole("button", { name: "1F", exact: true }).click();

  const publishResponse = page.waitForResponse((response) => response.request().method() === "POST" && /\/api\/seat-charts\/[^/]+\/publish$/.test(new URL(response.url()).pathname));
  await page.getByRole("button", { name: "게시", exact: true }).click();
  assert.equal((await publishResponse).status(), 200);
  await page.getByText("게시 완료", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(evidenceRoot, "venue-published.png"), fullPage: true });
  await page.getByTitle("API 연결").click();
  const credentials = page.getByTestId("seat-designer-v2-service-credentials");
  await credentials.waitFor();
  await credentials.getByRole("button", { name: "읽기 키 발급" }).click();
  await credentials.getByText("이 키는 지금 한 번만 표시됩니다.").waitFor();
  const credential = await credentials.locator("code").textContent();
  assert.ok(credential);
  const activeResponse = await fetch(`${server.baseUrl}/api/venues/${venueId}/seat-chart`, {
    headers: { Authorization: `Bearer ${credential}` },
  });
  const active = await activeResponse.json();
  assert.equal(activeResponse.status, 200);
  assert.equal(active.venueId, venueId);
  assert.ok(active.chartKey);
  await credentials.getByTitle("키 폐기").click();
  await credentials.getByText(/폐기됨/).waitFor();
  await credentials.locator("header button").click();
  await credentials.waitFor({ state: "hidden" });

  await page.screenshot({ path: path.join(evidenceRoot, "all-tools.png"), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(runtimeErrors, []);
  assert.ok(box.width > 700);
});
