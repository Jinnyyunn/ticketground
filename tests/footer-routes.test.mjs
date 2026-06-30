import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("footer terms link uses a distinct terms route while customer center remains help", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const termsLink = page.getByRole("link", { name: "이용약관", exact: true });
    await termsLink.waitFor({ timeout: 5000 });
    assert.equal(await termsLink.getAttribute("href"), "/terms");

    const customerCenterLink = page.getByRole("navigation", { name: "고객센터" }).getByRole("link", { name: "고객센터 홈", exact: true });
    assert.equal(await customerCenterLink.getAttribute("href"), "/help");

    await termsLink.click();
    await page.waitForURL(/\/terms$/);
    await assertVisibleHeading(page, "이용약관");
  } finally {
    await page.close();
  }
});

async function assertVisibleHeading(page, name) {
  const heading = page.getByRole("heading", { name, exact: true });
  await heading.waitFor({ timeout: 5000 });
  assert.ok(await heading.isVisible(), `${name} heading should be visible`);
}
