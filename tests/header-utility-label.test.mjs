import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("desktop header hides private mypage entry points when signed out", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const utilityBar = page.locator("header > div").first();
    const fastNav = page.getByRole("navigation", { name: "빠른 메뉴" });
    const header = page.locator("header");

    await utilityBar.getByRole("link", { name: "고객센터", exact: true }).waitFor({ timeout: 5000 });
    await utilityBar.getByRole("link", { name: "로그인", exact: true }).waitFor({ timeout: 5000 });
    await utilityBar.getByRole("link", { name: "회원가입", exact: true }).waitFor({ timeout: 5000 });
    const signedOutUtilityOrder = await getUtilityControlOrder(utilityBar);
    assert.deepEqual(signedOutUtilityOrder, ["고객센터", "로그인", "회원가입", "다크 모드 켜기"]);
    assert.equal(await utilityBar.getByRole("link", { name: "MY", exact: true }).count(), 0);
    assert.equal(await utilityBar.getByRole("link", { name: "마이", exact: true }).count(), 0);
    assert.equal(await fastNav.getByRole("link", { name: "MY", exact: true }).count(), 0);
    assert.equal(await fastNav.getByRole("link", { name: "예매내역", exact: true }).count(), 0);
    assert.equal(await header.locator('a[href="/mypage"]').count(), 0);
    assert.equal(await header.locator('a[href="/mypage#reservations"]').count(), 0);
  } finally {
    await page.close();
  }
});

test("desktop header utility auth control logs out and preserves MY label", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.localStorage.setItem("ticketground:session-user-id", "user_fan_a");
    window.localStorage.removeItem("ticketground:demo-auth-state");
  });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const utilityBar = page.locator("header > div").first();
    const fastNav = page.getByRole("navigation", { name: "빠른 메뉴" });
    const utilityMypageLink = utilityBar.getByRole("link", { name: "MY", exact: true });
    await utilityMypageLink.waitFor({ timeout: 5000 });
    assert.equal(await utilityMypageLink.getAttribute("href"), "/mypage");
    assert.equal(await fastNav.getByRole("link", { name: "MY", exact: true }).getAttribute("href"), "/mypage");
    assert.equal(await fastNav.getByRole("link", { name: "예매내역", exact: true }).getAttribute("href"), "/mypage#reservations");
    const logoutButton = utilityBar.getByRole("button", { name: "로그아웃", exact: true });
    await logoutButton.waitFor({ timeout: 5000 });
    const signedInUtilityOrder = await getUtilityControlOrder(utilityBar);
    assert.deepEqual(signedInUtilityOrder, ["고객센터", "MY", "로그아웃", "다크 모드 켜기"]);
    assert.equal(await utilityBar.getByRole("link", { name: "로그인", exact: true }).count(), 0);
    assert.equal(await utilityBar.getByRole("link", { name: "회원가입", exact: true }).count(), 0);

    await logoutButton.click();
    await utilityBar.getByRole("link", { name: "로그인", exact: true }).waitFor({ timeout: 5000 });
    await utilityBar.getByRole("link", { name: "회원가입", exact: true }).waitFor({ timeout: 5000 });
    assert.equal(await utilityBar.getByRole("link", { name: "MY", exact: true }).count(), 0);
    assert.equal(await fastNav.getByRole("link", { name: "MY", exact: true }).count(), 0);
    assert.equal(await fastNav.getByRole("link", { name: "예매내역", exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")), null);
    assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:demo-auth-state")), "signed-out");
  } finally {
    await context.close();
  }
});

test("mobile drawer hides private mypage entry points when signed out", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true });
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "전체 메뉴 열기", exact: true }).click();

    const mobileUtilityNav = page.getByRole("navigation", { name: "모바일 유틸리티" });
    await mobileUtilityNav.getByRole("link", { name: "고객센터", exact: true }).waitFor({ timeout: 5000 });
    await mobileUtilityNav.getByRole("link", { name: "로그인", exact: true }).waitFor({ timeout: 5000 });
    await mobileUtilityNav.getByRole("link", { name: "회원가입", exact: true }).waitFor({ timeout: 5000 });
    assert.equal(await mobileUtilityNav.getByRole("link", { name: "MY", exact: true }).count(), 0);
    assert.equal(await mobileUtilityNav.locator('a[href="/mypage"]').count(), 0);
    assert.equal(await mobileUtilityNav.locator('a[href="/mypage#reservations"]').count(), 0);
  } finally {
    await page.close();
  }
});

test("mobile drawer shows signed-in account controls", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true });
  await context.addInitScript(() => {
    window.localStorage.setItem("ticketground:session-user-id", "user_fan_a");
    window.localStorage.removeItem("ticketground:demo-auth-state");
  });
  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "전체 메뉴 열기", exact: true }).click();

    const mobileUtilityNav = page.getByRole("navigation", { name: "모바일 유틸리티" });
    const mypageLink = mobileUtilityNav.getByRole("link", { name: "MY", exact: true });
    await mypageLink.waitFor({ timeout: 5000 });
    assert.equal(await mypageLink.getAttribute("href"), "/mypage");
    await mobileUtilityNav.getByRole("button", { name: "로그아웃", exact: true }).waitFor({ timeout: 5000 });
    assert.equal(await mobileUtilityNav.getByRole("link", { name: "로그인", exact: true }).count(), 0);
    assert.equal(await mobileUtilityNav.getByRole("link", { name: "회원가입", exact: true }).count(), 0);
  } finally {
    await context.close();
  }
});

test("desktop header ignores a late session response after same-tab sign out", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.localStorage.setItem("ticketground:session-user-id", "user_fan_a");
    window.localStorage.removeItem("ticketground:demo-auth-state");
  });

  let releaseSessionResponse;
  const sessionRequestHeld = new Promise((resolve) => {
    releaseSessionResponse = resolve;
  });
  const sessionRequestSeen = new Promise((resolve) => {
    context.route("**/api/users/user_fan_a/session", async (route) => {
      resolve();
      await sessionRequestHeld;
      await route.continue();
    });
  });

  const page = await context.newPage();
  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await sessionRequestSeen;

    await page.evaluate(() => {
      window.localStorage.removeItem("ticketground:session-user-id");
      window.localStorage.setItem("ticketground:demo-auth-state", "signed-out");
      window.dispatchEvent(new Event("ticketground:session-user-changed"));
    });

    const utilityBar = page.locator("header > div").first();
    await utilityBar.getByRole("link", { name: "로그인", exact: true }).waitFor({ timeout: 5000 });
    const sessionResponseFinished = page.waitForResponse((response) => response.url().includes("/api/users/user_fan_a/session"));
    releaseSessionResponse();
    await sessionResponseFinished;

    assert.equal(await utilityBar.getByRole("button", { name: "로그아웃", exact: true }).count(), 0);
    assert.equal(await utilityBar.getByRole("link", { name: "로그인", exact: true }).count(), 1);
    assert.equal(await utilityBar.getByRole("link", { name: "회원가입", exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:session-user-id")), null);
    assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:demo-auth-state")), "signed-out");
  } finally {
    await context.close();
  }
});

async function resolveBaseUrl(t) {
  if (process.env.TICKETGROUND_TEST_BASE_URL) return process.env.TICKETGROUND_TEST_BASE_URL;
  return (await startServer(t)).baseUrl;
}

async function getUtilityControlOrder(utilityBar) {
  return utilityBar.locator("a,button").evaluateAll((controls) =>
    controls.map((control) => control.textContent?.trim() || control.getAttribute("aria-label") || ""),
  );
}
