import assert from "node:assert/strict";
import test from "node:test";
import { beginBlank, openV2Editor } from "./seat-designer-v2-browser-utils.mjs";

test("close returns the administrator to the console", async (t) => {
  const { page, runtimeErrors } = await openV2Editor(t);
  await beginBlank(page);

  await page.getByTitle("닫기").click();
  await page.waitForURL((url) => url.pathname === "/console");
  await page.getByRole("heading", { name: "운영 현황" }).waitFor();

  assert.deepEqual(runtimeErrors, []);
});
