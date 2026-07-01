import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startServer } from "../../../tests/backend-test-utils.mjs";

const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const viewports = [
  { id: "mobile-390", width: 390, height: 844, isMobile: true },
  { id: "tablet-768", width: 768, height: 1024, isMobile: false },
  { id: "desktop-1280", width: 1280, height: 900, isMobile: false },
];

const cleanup = [];
const testContext = {
  after(callback) {
    cleanup.push(callback);
  },
};

await mkdir(evidenceDir, { recursive: true });
const { baseUrl } = await startServer(testContext);
const browser = await chromium.launch({ channel: "chrome", headless: true });
cleanup.push(() => browser.close());

const results = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.isMobile ? 2 : 1,
      isMobile: viewport.isMobile,
    });

    try {
      await page.goto(`${baseUrl}/open`, { waitUntil: "networkidle" });
      const firstCard = page.locator("[data-open-imminent-card]").first();
      await firstCard.scrollIntoViewIfNeeded();
      const beforeText = await firstCard.textContent();
      await page.screenshot({ path: path.join(evidenceDir, `${viewport.id}-before.png`), fullPage: true });

      const button = firstCard.getByRole("button", { name: "알림" });
      await button.click();

      const status = firstCard.getByRole("status");
      const statusText = await status.textContent();
      const afterText = await firstCard.textContent();
      const statusBox = await status.boundingBox();
      const result = {
        viewport: viewport.id,
        buttonAriaPressed: await firstCard.getByRole("button", { name: "설정됨" }).getAttribute("aria-pressed"),
        rowTextChanged: beforeText !== afterText,
        statusAriaLive: await status.getAttribute("aria-live"),
        statusCount: await status.count(),
        statusText,
        statusVisible: Boolean(statusBox && statusBox.width > 0 && statusBox.height > 0),
      };

      assert.equal(result.statusCount, 1, `${viewport.id} has one status region`);
      assert.equal(result.statusAriaLive, "polite", `${viewport.id} status is aria-live polite`);
      assert.equal(result.buttonAriaPressed, "true", `${viewport.id} button exposes pressed state`);
      assert.equal(result.rowTextChanged, true, `${viewport.id} row text changes after click`);
      assert.equal(result.statusVisible, true, `${viewport.id} status is visibly rendered`);
      assert.match(result.statusText ?? "", /알림 완료/, `${viewport.id} status explains alert state`);

      await page.screenshot({ path: path.join(evidenceDir, `${viewport.id}-after.png`), fullPage: true });
      results.push(result);
    } finally {
      await page.close();
    }
  }

  const proof = { baseUrl, results };
  await writeFile(path.join(evidenceDir, "browser-proof.json"), `${JSON.stringify(proof, null, 2)}\n`);
  console.log(JSON.stringify(proof, null, 2));
} finally {
  for (const callback of cleanup.reverse()) {
    await callback();
  }
}
