import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("goods detail artist links map by show and do not reuse Dracula cast for other shows", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  await assertDraculaArtistLinkStillOpensDraculaCast(browser, baseUrl);
  await assertLesMiserablesArtistLinkDoesNotOpenDraculaCast(browser, baseUrl);
});

async function assertDraculaArtistLinkStillOpensDraculaCast(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 } });
  try {
    await page.goto(`${baseUrl}/goods/dracula`, { waitUntil: "networkidle" });
    const artistLink = page.getByRole("link", { name: "아티스트 보기" });
    assert.equal(await artistLink.getAttribute("href"), "/artist/dracula-cast");

    await artistLink.click();
    await page.waitForURL(/\/artist\/dracula-cast$/);
    await page.getByRole("heading", { name: "뮤지컬 드라큘라 캐스팅" }).waitFor({ timeout: 5000 });
  } finally {
    await page.close();
  }
}

async function assertLesMiserablesArtistLinkDoesNotOpenDraculaCast(browser, baseUrl) {
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 } });
  try {
    await page.goto(`${baseUrl}/goods/les-miserables`, { waitUntil: "networkidle" });
    const artistLink = page.getByRole("link", { name: "아티스트 보기" });
    const href = await artistLink.getAttribute("href");
    assert.ok(href, "les-miserables artist link has an href");

    await page.goto(`${baseUrl}${href}`, { waitUntil: "networkidle" });
    const openedPath = new URL(page.url()).pathname;

    assert.notEqual(openedPath, "/artist/dracula-cast", `les-miserables artist link opened Dracula cast from href ${href}`);
    assert.equal(await page.getByRole("heading", { name: "뮤지컬 드라큘라 캐스팅" }).count(), 0);
  } finally {
    await page.close();
  }
}
