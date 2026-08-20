import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

// Regression for a real production bug: a web visitor whose native-session
// Bearer credential has gone stale (expired/revoked - the stored
// ticketground:session-credential no longer matches any live db.nativeSessions
// row, e.g. after the session simply expires) hit GET /api/users/:id/identity
// and saw the backend's raw, native-app-flavored NATIVE_SESSION_INVALID text
// ("앱 로그인 세션을 확인할 수 없습니다.") verbatim, with the "NICE 본인인증 시작"
// button left in place silently re-failing the same way on click. Both the
// checkout identity gate and the mypage identity panel share this bug via
// getIdentityStatus()/startNiceIdentityVerification() - see
// src/lib/session-auth-error.ts for the shared fix.
const STALE_CREDENTIAL = "stale-credential-not-in-any-live-session";
const RAW_NATIVE_SESSION_TEXT = "앱 로그인 세션을 확인할 수 없습니다";

test("checkout identity gate recovers from a stale session instead of showing the raw backend error", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate((credential) => {
    window.localStorage.setItem("ticketground:session-user-id", "user_fan_a");
    window.localStorage.setItem("ticketground:session-credential", credential);
  }, STALE_CREDENTIAL);

  await page.goto(`${baseUrl}/checkout/les-miserables`, { waitUntil: "networkidle" });
  const gate = page.locator('[data-testid="identity-gate"]');
  await gate.getByText("로그인 정보를 확인할 수 없습니다").waitFor({ timeout: 5000 });

  // Then: the raw backend string never reaches the screen...
  assert.equal(await gate.getByText(RAW_NATIVE_SESSION_TEXT).count(), 0);
  // ...the dead-end "NICE 본인인증 시작" button is replaced with a working
  // login link instead of staying present and silently re-failing...
  assert.equal(await gate.getByRole("button", { name: "NICE 본인인증 시작" }).count(), 0);
  assert.equal(await gate.getByRole("link", { name: "간편 로그인으로 이동" }).count(), 1);
  // ...and the stale local session is actually cleared, not just hidden.
  assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")), null);
  assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:session-credential")), null);
});

test("mypage identity panel recovers from a stale session but leaves a credential-less legacy session alone", async (t) => {
  const { baseUrl } = await startServer(t, { env: { TIG_DEMO_PROFILE_API: "1" } });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const stalePage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await stalePage.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await stalePage.evaluate((credential) => {
      window.localStorage.setItem("ticketground:session-user-id", "user_fan_a");
      window.localStorage.setItem("ticketground:session-credential", credential);
    }, STALE_CREDENTIAL);

    await stalePage.goto(`${baseUrl}/mypage`, { waitUntil: "networkidle" });
    const panel = stalePage.locator('[data-testid="mypage-identity-panel"]');
    await panel.getByText("로그인 정보를 확인할 수 없습니다").waitFor({ timeout: 5000 });

    assert.equal(await panel.getByText(RAW_NATIVE_SESSION_TEXT).count(), 0);
    assert.equal(await panel.getByRole("button", { name: "NICE 본인인증 시작" }).count(), 0);
    assert.equal(await panel.getByRole("button", { name: "로그인하고 본인인증하기" }).count(), 1);
    assert.equal(await stalePage.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")), null);
    assert.equal(await stalePage.evaluate(() => window.localStorage.getItem("ticketground:session-credential")), null);
  } finally {
    await stalePage.close();
  }

  // A credential-less "legacy demo" session (storedSessionUserId() set, no
  // Bearer credential - e.g. the QA mock-login buttons) is a normal, supported
  // signed-in state elsewhere on /mypage (AccountSummaryPanel restores it via
  // the legacy /api/users/:id/session route). This must NOT be swept up by
  // the same recovery path above - see mypage-identity-panel-login-gate.test.mjs
  // for the button-state contract this protects.
  const legacyPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await legacyPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await legacyPage.evaluate(() => {
      window.localStorage.setItem("ticketground:session-user-id", "user_fan_a");
    });

    await legacyPage.goto(`${baseUrl}/mypage`, { waitUntil: "networkidle" });
    const panel = legacyPage.locator('[data-testid="mypage-identity-panel"]');
    await panel.getByRole("button", { name: "NICE 본인인증 시작" }).waitFor({ timeout: 5000 });

    assert.equal(await panel.getByText(RAW_NATIVE_SESSION_TEXT).count(), 0);
    assert.equal(
      await legacyPage.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")),
      "user_fan_a",
    );
  } finally {
    await legacyPage.close();
  }
});
