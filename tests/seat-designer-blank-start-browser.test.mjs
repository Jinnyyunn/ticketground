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

test("the designer opens as an empty document instead of a template gallery", async (t) => {
  const evidenceRoot = await mkdtemp(path.join(os.tmpdir(), "ticketground-designer-blank-"));
  await mkdir(path.join(evidenceRoot, "charts"));
  t.after(() => rm(evidenceRoot, { recursive: true, force: true }));

  const server = await startServer(t, {
    env: {
      TIG_SEAT_CHART_DATA_DIR: path.join(evidenceRoot, "charts"),
      TIG_SEAT_CHART_CREDENTIAL_DIR: path.join(evidenceRoot, "credentials"),
    },
  });
  const cookie = await login(server.adminUrl);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([{ ...cookie, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await context.addInitScript(() => localStorage.setItem("ticketground.seat-designer.tutorial.v1", "done"));
  const page = await context.newPage();
  await page.goto(`${server.adminUrl}/admin/seat-designer`, { waitUntil: "networkidle" });
  await page.getByTestId("seat-designer-shell").waitFor();

  assert.equal(await page.locator("[data-object-type]").count(), 0, "a new chart must start blank");
  const startDialog = page.getByRole("dialog", { name: "새 좌석 차트 만들기" });
  await startDialog.locator("select").selectOption({ index: 1 });
  await startDialog.getByRole("button", { name: "빈 캔버스" }).click();
  await startDialog.waitFor({ state: "hidden" });
  assert.equal(await page.getByTestId("chart-focal-point").count(), 0, "blank means no implicit focal point");
  const toolbar = await page.locator(".seat-designer-toolbar").boundingBox();
  const rail = await page.locator(".seat-designer-tool-rail").boundingBox();
  const inspector = await page.getByTestId("seat-designer-inspector").boundingBox();
  assert.equal(Math.round(toolbar.height), 45);
  assert.equal(Math.round(rail.width), 41);
  assert.equal(Math.round(inspector.width), 336);

  await page.getByTestId("tool-row").click();
  await page.getByRole("menu", { name: "열 도구" }).waitFor();
  await page.getByRole("menuitem", { name: "여러 열" }).click();
  assert.equal(await page.getByTestId("tool-row").getAttribute("data-mode"), "rowsMultiple");

  await page.getByTestId("tool-rectangle").click();
  await page.getByRole("menuitem", { name: "타원" }).click();
  const canvas = page.getByTestId("designer-canvas");
  const box = await canvas.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + 420, box.y + 240);
  await page.mouse.down();
  await page.mouse.move(box.x + 580, box.y + 360);
  await page.mouse.up();
  await page.locator('[data-object-type="rectangle"] ellipse').waitFor();
  await page.getByTestId("tool-select").click();
  assert.equal(await page.getByTestId("resize-handle").count(), 4);
  await page.getByTestId("rotation-handle").waitFor();
});
