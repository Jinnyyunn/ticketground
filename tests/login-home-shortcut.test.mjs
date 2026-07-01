import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("login and signup pages expose a home shortcut", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const pathName of ["/login", "/signup"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    try {
      await page.goto(`${baseUrl}${pathName}`, { waitUntil: "networkidle" });

      const homeShortcut = page.getByRole("link", { name: "메인 홈으로 이동", exact: true });
      await homeShortcut.waitFor({ timeout: 5000 });
      assert.equal(await homeShortcut.getAttribute("href"), "/");

      await homeShortcut.click();
      await page.waitForURL(`${baseUrl}/`);
      await page.getByRole("heading", { name: "IU 2026 WORLD TOUR", level: 1 }).waitFor({ timeout: 5000 });
    } finally {
      await page.close();
    }
  }
});
