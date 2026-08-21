import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { beginBlank, openV2Editor } from "./seat-designer-v2-browser-utils.mjs";

const evidenceRoot = path.resolve(".omo/evidence/seat-designer-v2/browser");

async function assertDangerStatus(page, text) {
  const status = page.getByText(text, { exact: true }).first();
  await status.waitFor();
  assert.match(await status.getAttribute("class"), /editor-danger/);
}

async function captureCurrentViewport(page, target) {
  const session = await page.context().newCDPSession(page);
  const result = await session.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(target, Buffer.from(result.data, "base64"));
}

test("save failures retain the draft and render a danger status", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t);
  await mkdir(evidenceRoot, { recursive: true });
  await beginBlank(page);
  await page.route("**/api/seat-charts", async (route) => {
    if (route.request().method() === "POST") await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "fixture save failure" }) });
    else await route.continue();
  });
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await assertDangerStatus(page, "저장 실패");
  await captureCurrentViewport(page, path.join(evidenceRoot, "save-failure.png"));
  assert.deepEqual(runtimeErrors, []);
});

test("publish validation failures render a danger status without a success claim", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t);
  await mkdir(evidenceRoot, { recursive: true });
  await beginBlank(page);
  await page.route("**/api/seat-charts/*/publish", async (route) => route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: "fixture validation failure" }) }));
  await page.getByRole("button", { name: "게시", exact: true }).click();
  await assertDangerStatus(page, "게시 실패");
  assert.equal(await page.getByText("게시 완료", { exact: true }).count(), 0);
  await captureCurrentViewport(page, path.join(evidenceRoot, "validation-failure.png"));
  assert.deepEqual(runtimeErrors, []);
});
