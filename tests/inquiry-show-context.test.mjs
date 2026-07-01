import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { api, startServer } from "./backend-test-utils.mjs";

const evidenceDir = ".omo/evidence/issue-63-inquiry-show-slug";

test("inquiry backend thread resolves Les Miserables show context", async (t) => {
  await mkdir(evidenceDir, { recursive: true });
  const server = await startServer(t);
  await api(server.baseUrl, "/api/support/threads", {
    userId: "user_fan_a",
    subject: "레미제라블 입장 문의",
    message: "공연 당일 입장 시간을 확인하고 싶습니다."
  });

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${server.baseUrl}/inquiry`, { waitUntil: "networkidle" });
    await page.getByText("1건의 문의 동기화").waitFor({ timeout: 8000 });

    const contextItems = (await page.locator('[data-testid="reservation-context"] span').allTextContents()).map((item) => item.trim());
    await writeFile(`${evidenceDir}/inquiry-context-observed.json`, `${JSON.stringify({ contextItems }, null, 2)}\n`);
    await page.screenshot({ path: `${evidenceDir}/inquiry-context-browser.png`, fullPage: true });

    assert.equal(contextItems[1], "공연 레미제라블");
    assert.notEqual(contextItems[1], "공연", "show context must not render as a fallback-only blank label");
  } finally {
    await page.close();
  }
});
