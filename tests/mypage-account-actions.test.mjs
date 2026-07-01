import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { api, startServer } from "./backend-test-utils.mjs";

test("mypage profile edit saves through demo backend and logout updates demo auth state", async (t) => {
  const server = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  await assertProfileEditAndLogout(browser, server.baseUrl);
});

async function assertProfileEditAndLogout(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${baseUrl}/mypage`, { waitUntil: "networkidle" });

    const accountName = page.locator("[data-account-name]");
    await accountName.waitFor({ timeout: 5000 });
    assert.match(String(await accountName.textContent()), /민서 회원/);

    await page.getByRole("button", { name: "회원정보 수정", exact: true }).click();
    const nameInput = page.locator("[data-account-edit-panel] input").first();
    await nameInput.fill("서연");
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("[data-account-name]")?.textContent?.includes("서연 회원"));
    assert.match(String(await page.locator("[data-account-status]").textContent()), /서연 회원 정보 저장 완료/);

    const session = await api(baseUrl, "/api/users/user_fan_a/session");
    assert.equal(session.data.name, "서연");

    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await page.waitForSelector('[data-account-panel][data-auth-state="signed-out"]');
    assert.ok(await page.getByRole("heading", { name: "로그인이 필요합니다", exact: true }).isVisible());
    assert.equal(new URL(page.url()).pathname, "/mypage");

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-account-panel][data-auth-state="signed-out"]');
    assert.ok(await page.getByRole("heading", { name: "로그인이 필요합니다", exact: true }).isVisible());

    await page.getByRole("button", { name: "데모 계정으로 다시 로그인", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("[data-account-name]")?.textContent?.includes("서연 회원"));
    assert.equal(await page.locator("[data-account-panel]").getAttribute("data-auth-state"), "signed-in");
  } finally {
    await page.close();
  }
}
