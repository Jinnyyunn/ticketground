import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("open row alert button exposes visible accessible feedback", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/open`, { waitUntil: "networkidle" });
  const firstCard = page.locator("[data-open-imminent-card]").first();
  const beforeText = await firstCard.textContent();

  await firstCard.getByRole("button", { name: "알림" }).click();

  const status = firstCard.getByRole("status");
  assert.equal(await status.count(), 1, "clicked open alert row should render one live status region");
  assert.equal(await status.getAttribute("aria-live"), "polite", "row alert feedback should be announced politely");

  const statusText = await status.textContent();
  assert.match(statusText ?? "", /알림/, "row alert feedback should explain the alert state");
  assert.notEqual(await firstCard.textContent(), beforeText, "clicking row alert should change visible row text");
});
