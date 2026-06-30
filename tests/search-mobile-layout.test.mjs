import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("mobile search keeps the submit button and long query result inside the viewport", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  try {
    const longQuery = "아주긴검색어레미제라블좌석오픈공지확인";
    await page.goto(`${baseUrl}/contents/search?q=${encodeURIComponent(longQuery)}`, { waitUntil: "networkidle" });

    const metrics = await page.evaluate(() => {
      const button = document.querySelector("form[action='/contents/search'] button");
      const range = document.createRange();
      if (button?.firstChild) range.selectNodeContents(button);
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        buttonText: button?.textContent?.trim(),
        buttonWhiteSpace: button ? getComputedStyle(button).whiteSpace : "",
        buttonTextLineCount: button?.firstChild ? range.getClientRects().length : 0,
      };
    });

    assert.equal(metrics.buttonText, "검색");
    assert.equal(metrics.buttonWhiteSpace, "nowrap");
    assert.equal(metrics.buttonTextLineCount, 1);
    assert.ok(metrics.scrollWidth <= metrics.clientWidth, `search page should not horizontally overflow: ${JSON.stringify(metrics)}`);

    await page.getByRole("textbox").fill("IU");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await page.waitForURL(/q=IU/);
    await page.getByRole("heading", { name: "IU 검색 결과", exact: true }).waitFor({ timeout: 5000 });
  } finally {
    await page.close();
  }
});
