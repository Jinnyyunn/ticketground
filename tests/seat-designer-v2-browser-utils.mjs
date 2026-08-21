import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { bootstrapAdminPassword, startServer } from "./backend-test-utils.mjs";

async function login(adminUrl) {
  const response = await fetch(`${adminUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: bootstrapAdminPassword }),
  });
  assert.equal(response.status, 200);
  const pair = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(pair, "admin login must return a session cookie");
  const separator = pair.indexOf("=");
  return { name: pair.slice(0, separator), value: pair.slice(separator + 1) };
}

export async function openV2Editor(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ticketground-v2-browser-"));
  const chartRoot = path.join(root, "charts");
  const credentialRoot = path.join(root, "credentials");
  await mkdir(chartRoot, { recursive: true });
  t.after(() => rm(root, { recursive: true, force: true }));
  const server = await startServer(t, {
    env: {
      TIG_SEAT_CHART_DATA_DIR: chartRoot,
      TIG_SEAT_CHART_CREDENTIAL_DIR: credentialRoot,
      ...options.env,
    },
  });
  const cookie = await login(server.adminUrl);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: options.viewport ?? { width: 1440, height: 900 } });
  await context.addCookies([{ ...cookie, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.goto(`${server.adminUrl}/admin/seat-designer`, { waitUntil: "networkidle" });
  await page.getByTestId("seat-designer-v2-shell").waitFor();
  await page.getByTestId("seat-designer-v2-reference-start").waitFor();
  return { page, server, root, runtimeErrors };
}

export async function selectVenue(page) {
  const venue = page.getByTestId("seat-designer-v2-venue");
  await venue.selectOption({ index: 1 });
  assert.notEqual(await venue.inputValue(), "");
}

export async function beginBlank(page) {
  await selectVenue(page);
  await page.getByRole("button", { name: "빈 캔버스로 시작" }).click();
  await page.getByTestId("seat-designer-v2-reference-start").waitFor({ state: "hidden" });
}

export async function beginWithReference(page, file) {
  await selectVenue(page);
  await page.getByTestId("seat-designer-v2-reference-start").locator('input[type="file"]').setInputFiles(file);
  await page.getByTestId("seat-designer-v2-reference-start").waitFor({ state: "hidden" });
  await page.getByTestId("seat-designer-v2-reference-plan").waitFor();
}

export async function canvasGeometry(page) {
  const canvas = page.getByTestId("seat-designer-v2-canvas");
  const box = await canvas.boundingBox();
  assert.ok(box, "designer canvas must have geometry");
  const point = (x, y) => ({ x: box.x + x, y: box.y + y });
  const click = async (x, y, options) => page.mouse.click(point(x, y).x, point(x, y).y, options);
  const drag = async (x1, y1, x2, y2, options = {}) => {
    await page.mouse.move(point(x1, y1).x, point(x1, y1).y);
    await page.mouse.down(options);
    await page.mouse.move(point(x2, y2).x, point(x2, y2).y, { steps: 3 });
    await page.mouse.up(options);
  };
  return { canvas, box, point, click, drag };
}

const TOOL_GROUPS = {
  row: ["row", "segmentedRow", "multipleRows", "section"],
  table: ["roundTable", "rectangularTable"],
  area: ["rectangularArea", "ellipticArea", "polygonalArea"],
  shape: ["rectangle", "ellipse", "polygon"],
};

export async function chooseTool(page, tool) {
  const entry = Object.entries(TOOL_GROUPS).find(([, tools]) => tools.includes(tool));
  if (!entry) {
    const direct = page.locator(`nav[aria-label="좌석 배치 도구"] > div > button[data-testid="seat-designer-v2-tool-${tool}"]`);
    assert.equal(await direct.count(), 1, `tool ${tool} must be directly available`);
    await direct.click();
    assert.equal(await direct.getAttribute("aria-pressed"), "true");
    return;
  }
  const [group, tools] = entry;
  let groupButton = null;
  for (const candidate of tools) {
    const button = page.locator(`nav[aria-label="좌석 배치 도구"] > div > button[data-testid="seat-designer-v2-tool-${candidate}"]`);
    if (await button.count()) {
      groupButton = button;
      break;
    }
  }
  assert.ok(groupButton, `group ${group} must expose a toolbar button`);
  await groupButton.click();
  await page.getByTestId(`seat-designer-v2-flyout-${group}`).waitFor();
  await page.getByTestId(`seat-designer-v2-flyout-${group}`).getByTestId(`seat-designer-v2-tool-${tool}`).click();
  assert.equal(await page.locator(`nav[aria-label="좌석 배치 도구"] > div > button[data-testid="seat-designer-v2-tool-${tool}"]`).getAttribute("aria-pressed"), "true");
}
