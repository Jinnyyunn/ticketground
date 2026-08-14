import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

test("goods detail page lets a signed-in user toggle 찜하기 on and off", async (t) => {
  configureGoogleEnv(t, true);
  const { baseUrl } = await startServer(t);

  const login = await api(baseUrl, "/api/auth/google/native", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  const credential = login.data.session.credential;
  const userId = login.data.user.id;

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(([storedUserId, storedCredential]) => {
    window.localStorage.setItem("ticketground:session-user-id", storedUserId);
    window.localStorage.setItem("ticketground:session-credential", storedCredential);
  }, [userId, credential]);
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/goods/les-miserables`, { waitUntil: "networkidle" });

    const button = page.getByRole("button", { name: /관심공연으로 등록/ });
    await button.waitFor({ timeout: 5000 });
    await button.click();

    const activeButton = page.getByRole("button", { name: /관심공연에서 제거/ });
    await activeButton.waitFor({ timeout: 5000 });
    assert.equal(await activeButton.innerText(), "찜 완료");

    const afterAdd = await fetch(`${baseUrl}/api/me/watchlist`, {
      headers: { Authorization: `Bearer ${credential}` },
    }).then((response) => response.json());
    assert.equal(afterAdd.data.length, 1);

    await activeButton.click();
    const inactiveButton = page.getByRole("button", { name: /관심공연으로 등록/ });
    await inactiveButton.waitFor({ timeout: 5000 });
    assert.equal(await inactiveButton.innerText(), "찜하기");

    const afterRemove = await fetch(`${baseUrl}/api/me/watchlist`, {
      headers: { Authorization: `Bearer ${credential}` },
    }).then((response) => response.json());
    assert.deepEqual(afterRemove.data, []);
  } finally {
    await context.close();
  }
});

test("goods detail page sends signed-out visitors to login when they try to 찜하기", async (t) => {
  configureGoogleEnv(t, true);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(`${baseUrl}/goods/les-miserables`, { waitUntil: "networkidle" });
    const button = page.getByRole("button", { name: /관심공연으로 등록/ });
    await button.waitFor({ timeout: 5000 });
    await button.click();
    await page.waitForURL(`${baseUrl}/login`, { timeout: 5000 });
  } finally {
    await page.close();
  }
});
