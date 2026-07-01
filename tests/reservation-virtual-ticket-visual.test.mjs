import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("reservation page renders a non-entry virtual ticket visual without the old placeholder glyph", async (t) => {
  // Given: a completed reservation page that must not expose entry QR material on web.
  const server = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    // When: the reservation confirmation route is rendered.
    const response = await page.goto(`${server.baseUrl}/reservation/CTI-260513-A4F2K9`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200);

    // Then: the visual is explicitly a virtual ticket, not a web entry QR.
    const visual = page.getByLabel("소유 확인용 가상 티켓 이미지");
    await visual.waitFor({ timeout: 5000 });
    await assert.rejects(page.getByText("▦").waitFor({ state: "visible", timeout: 300 }));
    await page.getByText("VIRTUAL TICKET").waitFor({ timeout: 5000 });
    await page.getByText("APP ONLY").waitFor({ timeout: 5000 });
    await page.getByText("CTI-260513-A4F2K9").first().waitFor({ timeout: 5000 });

    const bodyText = await page.locator("body").innerText();
    assert.match(bodyText, /소유 확인용 가상 티켓이며 현장 입장 QR이 아닙니다\./);
    assert.doesNotMatch(bodyText, /▦/);
    assert.doesNotMatch(bodyText, /ADMISSION|credential|deviceToken|ttlSeconds|signature|nonce/i);
    assert.equal(await page.locator("[data-entry-qr]").count(), 0);
  } finally {
    await page.close();
  }
});
