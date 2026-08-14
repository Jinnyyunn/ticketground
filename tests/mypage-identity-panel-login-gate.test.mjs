import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

// Regression for 사용자 페이지 UI 전면 개선 계획서.md §2-3: the mypage identity
// panel used to always show "NICE 본인인증 시작" (start verification) even
// while signed out, right next to a message saying login is required first -
// a contradictory pair of signals on one screen. The button label should
// match the actual signed-in state.
test("mypage identity panel button reflects signed-in state instead of always inviting verification", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const signedOutPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    // A cold visitor with no session at all still gets auto-signed into the
    // demo account by AccountSummaryPanel's currentSessionUserId() fallback,
    // so simulate an explicit sign-out the same way logout() does - this is
    // the only way to reach a genuinely signed-out /mypage in this demo build.
    await signedOutPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await signedOutPage.evaluate(() => {
      window.localStorage.setItem("ticketground:demo-auth-state", "signed-out");
    });
    await signedOutPage.goto(`${baseUrl}/mypage`, { waitUntil: "networkidle" });
    const panel = signedOutPage.locator('[data-testid="mypage-identity-panel"]');
    await panel.waitFor({ timeout: 5000 });
    await panel.getByText("로그인 후 본인인증을 진행할 수 있습니다.").waitFor({ timeout: 5000 });
    assert.equal(await panel.getByRole("button", { name: "로그인하고 본인인증하기" }).count(), 1);
    assert.equal(await panel.getByRole("button", { name: "NICE 본인인증 시작" }).count(), 0);
  } finally {
    await signedOutPage.close();
  }

  const signedInPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await signedInPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await signedInPage.evaluate(() => {
      window.localStorage.setItem("ticketground:session-user-id", "user_fan_a");
    });
    await signedInPage.goto(`${baseUrl}/mypage`, { waitUntil: "networkidle" });
    const panel = signedInPage.locator('[data-testid="mypage-identity-panel"]');
    await panel.waitFor({ timeout: 5000 });
    await panel.getByRole("button", { name: "NICE 본인인증 시작" }).waitFor({ timeout: 5000 });
    assert.equal(await panel.getByRole("button", { name: "로그인하고 본인인증하기" }).count(), 0);
  } finally {
    await signedInPage.close();
  }
});
