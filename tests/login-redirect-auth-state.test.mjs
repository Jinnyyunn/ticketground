import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv } from "./google-auth-test-helpers.mjs";

test("authenticated users are redirected away from login and signup pages", async (t) => {
  configureGoogleEnv(t, false);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const pathName of ["/login", "/signup"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await context.addInitScript(() => {
      window.localStorage.setItem("ticketground:session-user-id", "user_fan_a");
      window.localStorage.removeItem("ticketground:demo-auth-state");
    });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}${pathName}`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(`${baseUrl}/`, { timeout: 5000 });
      assert.equal(new URL(page.url()).pathname, "/");
    } finally {
      await context.close();
    }
  }
});

test("stale stored user ids do not redirect away from login and signup pages", async (t) => {
  configureGoogleEnv(t, false);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const pathName of ["/login", "/signup"]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await context.addInitScript(() => {
      window.localStorage.setItem("ticketground:session-user-id", "not-a-real-user");
      window.localStorage.removeItem("ticketground:demo-auth-state");
    });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}${pathName}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.localStorage.getItem("ticketground:session-user-id") === null);
      assert.equal(new URL(page.url()).pathname, pathName);
      assert.equal(await page.evaluate(() => window.localStorage.getItem("ticketground:demo-auth-state")), "signed-out");
    } finally {
      await context.close();
    }
  }
});
