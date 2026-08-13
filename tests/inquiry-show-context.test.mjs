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
    assert.equal(await page.getByRole("button", { name: "카카오톡 채널 추가 후 문의하기" }).count(), 1);
    const kakaoSdkScripts = await page.locator('script[src*="kakao_js_sdk"]').count();
    assert.ok(kakaoSdkScripts === 0 || kakaoSdkScripts === 1, "Kakao SDK is optional and must load at most once");
  } finally {
    await page.close();
  }
});

test("KakaoTalk inquiry action uses the connected public ID", async (t) => {
  const server = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${server.baseUrl}/inquiry`, { waitUntil: "networkidle" });
    const inquiryButton = page.getByRole("button", { name: "카카오톡 채널 추가 후 문의하기" });
    assert.equal(await inquiryButton.getAttribute("data-channel-public-id"), "_xmTniX");
  } finally {
    await page.close();
  }
});
