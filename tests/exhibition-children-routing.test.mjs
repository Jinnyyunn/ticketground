import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const routes = [
  { navLabel: "전시", heading: "전시/행사 예매", path: "/contents/genre/exhibition", slug: "banksy", title: "뱅크시" },
  { navLabel: "아동", heading: "아동/가족 예매", path: "/contents/genre/children", slug: "breadbarbershop", title: "브레드이발소" },
];

const viewports = [
  { id: "mobile-390", width: 390, height: 844, mobile: true },
  { id: "desktop-1293", width: 1293, height: 1043, mobile: false },
];

test("exhibition and children header links route to separate genre booking lists", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const viewport of viewports) {
    for (const route of routes) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.mobile ? 2 : 1,
        isMobile: viewport.mobile,
      });
      t.after(() => page.close());

      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await page.getByRole("link", { name: route.navLabel, exact: true }).first().click();
      await page.waitForURL(new RegExp(`${route.path}$`));

      assert.equal(new URL(page.url()).pathname, route.path, `${viewport.id} ${route.navLabel} URL`);
      await page.getByRole("heading", { name: route.heading, level: 1 }).waitFor({ timeout: 5000 });
      await page.getByRole("link", { name: new RegExp(route.title) }).first().waitFor({ timeout: 5000 });
      assert.equal(await page.locator(`a[href="/goods/${route.slug}"]`).count(), 1, `${viewport.id} ${route.navLabel} show link`);
    }
  }
});

test("children route has its own content and booking entry", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/contents/genre/children`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "아동/가족 예매", level: 1 }).waitFor({ timeout: 5000 });
  assert.equal(await page.locator('a[href="/goods/banksy"]').count(), 0, "children route does not show exhibition card");

  await page.locator('a[href="/goods/breadbarbershop"]').first().click();
  await page.waitForURL(/\/goods\/breadbarbershop$/);
  await page.getByRole("heading", { name: /브레드이발소/ }).first().waitFor({ timeout: 5000 });
  await page.getByRole("link", { name: "선택 회차 예매" }).waitFor({ timeout: 5000 });
});
