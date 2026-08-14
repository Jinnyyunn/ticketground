import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

// Regression for 사용자 페이지 UI 전면 개선 계획서.md §2-1: a stored session
// user id whose demo-session lookup route is gated off (TIG_DEMO_PROFILE_API
// disabled, as on a non-dev deployment) must never surface the raw backend
// "요청한 API가 없습니다." string on /login - it should fall back to the
// normal "please log in" prompt instead.
test("login page falls back to a normal prompt when the stored session's demo lookup route is disabled", async (t) => {
  const { baseUrl } = await startServer(t, { env: { TIG_DEMO_PROFILE_API: "0" } });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.setItem("ticketground:session-user-id", "user_fan_a");
    });

    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
    await page.getByText("간편 로그인으로 계정을 시작해 주세요").waitFor({ timeout: 5000 });
    await page.waitForTimeout(500);

    // LoginSessionPanel intentionally renders nothing (no [role="status"]) once
    // status has settled back to its default "please log in" value - so a
    // clean load here proves the demo-gate 404 never reached the screen.
    assert.equal(await page.locator('[role="status"]').count(), 0);
    assert.equal(await page.getByText("요청한 API가 없습니다").count(), 0);
    assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")), null);
  } finally {
    await page.close();
  }
});
