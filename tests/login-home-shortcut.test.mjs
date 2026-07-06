import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("login and signup pages expose the home shortcut above the login card", async (t) => {
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
      const shortcutBox = await homeShortcut.boundingBox();
      const heroHeadingBox = await page.getByRole("heading", { name: /클린 티켓 예매와/ }).boundingBox();
      assert.ok(shortcutBox, "home shortcut has a rendered box");
      assert.ok(heroHeadingBox, "login hero heading has a rendered box");
      assert.ok(shortcutBox.y < heroHeadingBox.y, "home shortcut is placed above the login hero");
      await page.getByRole("tab", { name: pathName === "/login" ? "로그인" : "회원가입", exact: true }).waitFor({ timeout: 5000 });
    } finally {
      await page.close();
    }
  }
});
