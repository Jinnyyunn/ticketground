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

test("every clean-room designer tool family is operable in the real admin browser", async (t) => {
  const { page, server, runtimeErrors } = await openV2Editor(t);
  await selectVenue(page);
  const venueId = await page.getByTestId("seat-designer-v2-venue").inputValue();
  await page.getByRole("button", { name: "빈 캔버스로 시작" }).click();
  await page.getByTestId("seat-designer-v2-reference-start").waitFor({ state: "hidden" });
  const { canvas, box, click, drag, point } = await canvasGeometry(page);

  await chooseTool(page, "row");
  await drag(150, 110, 360, 110);
  await chooseTool(page, "segmentedRow");
  await click(150, 170);
  await click(260, 200);
  await click(370, 170);
  await page.keyboard.press("Enter");
  await chooseTool(page, "multipleRows");
  await drag(450, 100, 650, 100);
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

  await page.getByTitle("미리보기").click();
  await page.getByTestId("seat-designer-v2-preview").waitFor();
  await page.getByTestId("seat-designer-v2-preview").getByRole("button").click();

  const publishResponse = page.waitForResponse((response) => response.request().method() === "POST" && /\/api\/seat-charts\/[^/]+\/publish$/.test(new URL(response.url()).pathname));
  await page.getByRole("button", { name: "게시", exact: true }).click();
  assert.equal((await publishResponse).status(), 200);
  await page.getByText("게시 완료", { exact: true }).waitFor();
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

  const evidenceRoot = path.resolve(".omo/evidence/seat-designer-v2/browser");
  await mkdir(evidenceRoot, { recursive: true });
  await page.screenshot({ path: path.join(evidenceRoot, "all-tools.png"), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(runtimeErrors, []);
  assert.ok(box.width > 700);
});
