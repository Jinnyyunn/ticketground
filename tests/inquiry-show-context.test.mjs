import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("inquiry page exposes only the KakaoTalk channel action", async (t) => {
  const server = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${server.baseUrl}/inquiry`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "카카오톡 1:1 문의" }).waitFor();
    assert.equal(await page.getByText("문의 스레드").count(), 0);
    assert.equal(await page.locator("textarea").count(), 0);
    assert.equal(await page.getByRole("button", { name: "문의 답변 등록" }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "카카오톡 1:1 상담" }).count(), 1);
    assert.equal(await page.locator('script[src*="kakao_js_sdk"]').count(), 1);
  } finally {
    await page.close();
  }
});

test("KakaoTalk consultation opens the configured channel chat", async (t) => {
  const server = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
  await page.route("https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js", async (route) => {
    await route.fulfill({ contentType: "application/javascript", body: `window.__kakaoChatCalls = []; window.Kakao = { initialized: false, init: function () { this.initialized = true; }, isInitialized: function () { return this.initialized; }, Channel: { chat: function (options) { window.__kakaoChatCalls.push(options); } } };` });
  });
  try {
    await page.goto(`${server.baseUrl}/inquiry`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "카카오톡 1:1 상담" }).click();
    assert.deepEqual(await page.evaluate(() => window.__kakaoChatCalls), [{ channelPublicId: "_xmTniX" }]);
  } finally {
    await page.close();
  }
});

test("KakaoTalk consultation falls back to the channel chat URL", async (t) => {
  const server = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
  await page.route("https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js", async (route) => route.abort());
  try {
    await page.goto(`${server.baseUrl}/inquiry`, { waitUntil: "networkidle" });
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "카카오톡 1:1 상담" }).click();
    const popup = await popupPromise;
    await popup.waitForURL("https://pf.kakao.com/_xmTniX/chat");
    assert.equal(popup.url(), "https://pf.kakao.com/_xmTniX/chat");
    await popup.close();
  } finally {
    await page.close();
  }
});
