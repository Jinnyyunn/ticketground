import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const mobileRoutes = ["/", "/contents/search", "/mypage"];
const footerSections = ["예매", "마이", "고객센터"];

test("mobile footer keeps booking, my, and help sections in one row", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const route of mobileRoutes) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
    t.after(() => page.close());
    await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    await page.locator("footer").scrollIntoViewIfNeeded();

    const overflow = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
    }));
    assert.ok(overflow.bodyScrollWidth <= overflow.viewportWidth + 1, `${route} body has no horizontal overflow`);
    assert.ok(overflow.documentScrollWidth <= overflow.viewportWidth + 1, `${route} document has no horizontal overflow`);

    const headingBoxes = await Promise.all(
      footerSections.map(async (section) => {
        const heading = page.locator("footer").getByRole("navigation", { name: section }).getByRole("heading", { name: section });
        const box = await heading.boundingBox();
        assert.ok(box, `${route} ${section} footer heading is visible`);
        assert.ok(box.x >= 0 && box.x + box.width <= 390, `${route} ${section} heading is inside viewport`);
        return box;
      }),
    );

    const rowTop = Math.min(...headingBoxes.map((box) => box.y));
    const rowBottom = Math.max(...headingBoxes.map((box) => box.y + box.height));
    assert.ok(rowBottom - rowTop <= 24, `${route} footer section headings stay on one row`);
    assert.ok(headingBoxes[0].x < headingBoxes[1].x && headingBoxes[1].x < headingBoxes[2].x, `${route} footer sections keep visual order`);
  }
});

test("mobile footer representative links keep their destinations", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const cases = [
    { section: "예매", link: "티켓오픈 캘린더", pathname: "/open", hash: "" },
    { section: "마이", link: "예매내역", pathname: "/mypage", hash: "#reservations" },
    { section: "고객센터", link: "고객센터 홈", pathname: "/help", hash: "" },
  ];

  for (const item of cases) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
    t.after(() => page.close());
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.locator("footer").getByRole("navigation", { name: item.section }).getByRole("link", { name: item.link }).click();
    await page.waitForURL((url) => url.pathname === item.pathname && url.hash === item.hash);
    const current = new URL(page.url());
    assert.equal(current.pathname, item.pathname);
    assert.equal(current.hash, item.hash);
  }
});
