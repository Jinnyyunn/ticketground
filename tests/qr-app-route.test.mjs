import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("reservation app-only QR route shows safe web guidance without entry QR material", async (t) => {
  const server = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    const response = await page.goto(`${server.baseUrl}/reservation/CTI-260629-DAYQR`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200);

    const bodyText = await page.locator("body").innerText();
    assert.match(bodyText, /앱 전용 입장 QR/);
    assert.match(bodyText, /웹에서는 실제 입장 QR을 표시하지 않습니다/);
    assert.match(bodyText, /딥링크/);
    assert.ok(await page.getByRole("button", { name: "앱에서 열기(웹 비활성)", exact: true }).isDisabled());
    assert.doesNotMatch(bodyText, /ADMISSION|credential|deviceToken|ttlSeconds|token/i);
    assert.equal(await page.locator("[data-entry-qr]").count(), 0);
  } finally {
    await page.close();
  }
});
