import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("desktop header utility mypage link renders MY", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const utilityBar = page.locator("header > div").first();
    const mypageLink = utilityBar.getByRole("link", { name: "MY", exact: true });
    await mypageLink.waitFor({ timeout: 5000 });

    assert.equal(await mypageLink.getAttribute("href"), "/mypage");
    assert.equal(await utilityBar.getByRole("link", { name: "마이", exact: true }).count(), 0);
  } finally {
    await page.close();
  }
});

async function resolveBaseUrl(t) {
  if (process.env.TICKETGROUND_TEST_BASE_URL) return process.env.TICKETGROUND_TEST_BASE_URL;
  return (await startServer(t)).baseUrl;
}
