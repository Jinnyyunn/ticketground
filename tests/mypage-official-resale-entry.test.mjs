import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("mypage routes reservation and account resale entry points through official resale", async (t) => {
  const server = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  try {
    await page.goto(`${server.baseUrl}/mypage`, { waitUntil: "networkidle" });

    const main = page.locator("main#content");
    const accountPanel = main.locator("[data-account-panel]");
    const accountResaleLink = accountPanel.getByRole("link", { name: /공식 재판매/ });
    await accountResaleLink.waitFor({ timeout: 5000 });
    assert.equal(new URL(await accountResaleLink.getAttribute("href"), server.baseUrl).pathname, "/resale");

    const reservationResaleLink = main.locator('a[href^="/resale?reservation="]').first();
    await reservationResaleLink.waitFor({ timeout: 5000 });
    assert.equal((await reservationResaleLink.textContent())?.trim(), "공식 재판매");
    const reservationArticle = reservationResaleLink.locator("xpath=ancestor::article[1]");
    const reservationText = await reservationArticle.innerText();
    const reservationMatch = reservationText.match(/예매번호\s+([A-Z0-9-]+)/);
    assert.ok(reservationMatch, `reservation card exposes a reservation id: ${reservationText}`);
    const reservationHref = new URL(await reservationResaleLink.getAttribute("href"), server.baseUrl);
    assert.equal(reservationHref.pathname, "/resale");
    assert.equal(reservationHref.searchParams.get("reservation"), reservationMatch[1]);
    assert.equal(await main.getByRole("link", { name: "양도", exact: true }).count(), 0);
    assert.equal(await main.locator('a[href^="/transfer"]').count(), 0);

    await reservationResaleLink.click();
    await page.waitForFunction(
      (reservationId) => {
        const url = new URL(window.location.href);
        return url.pathname === "/resale" && url.searchParams.get("reservation") === reservationId;
      },
      reservationMatch[1],
      { timeout: 5000 },
    );
    await page.getByRole("heading", { name: "공식 재판매", exact: true }).waitFor({ timeout: 5000 });
  } finally {
    await page.close();
  }
});
