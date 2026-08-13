import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("inquiry page exposes direct chat first and channel add as an optional action", async (t) => {
  const server = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${server.baseUrl}/inquiry`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "카카오톡 1:1 문의" }).waitFor();
    assert.equal(await page.getByText("카카오톡 채널에서만 접수합니다.", { exact: true }).count(), 0);
    assert.equal(await page.getByText("문의 스레드").count(), 0);
    assert.equal(await page.locator("textarea").count(), 0);
    assert.equal(await page.getByRole("button", { name: "문의 답변 등록" }).count(), 0);
    const chatLink = page.getByRole("link", { name: "카카오톡으로 1:1 문의하기" });
    assert.equal(await chatLink.count(), 1);
    assert.equal(await chatLink.getAttribute("href"), "https://pf.kakao.com/_xmTniX/chat");
    assert.equal(await chatLink.getAttribute("target"), "_blank");
    assert.equal(await page.getByRole("button", { name: "채널 추가하기" }).count(), 1);
    const kakaoSdkScripts = await page.locator('script[src*="kakao_js_sdk"]').count();
    assert.ok(kakaoSdkScripts === 0 || kakaoSdkScripts === 1, "Kakao SDK is optional and must load at most once");
  } finally {
    await page.close();
  }
});

test("optional channel add action uses the connected public ID", async (t) => {
  const server = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${server.baseUrl}/inquiry`, { waitUntil: "networkidle" });
    const inquiryButton = page.getByRole("button", { name: "채널 추가하기" });
    assert.equal(await inquiryButton.getAttribute("data-channel-public-id"), "_xmTniX");
  } finally {
    await page.close();
  }
});
