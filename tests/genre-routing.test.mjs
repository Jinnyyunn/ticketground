import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const routes = [
  { label: "연극", path: "/contents/genre/theater", slug: "king-lear", title: "국립극단 리어왕" },
  { label: "클래식", path: "/contents/genre/classic", slug: "berlin-phil", title: "베를린필 내한공연" },
];

const viewports = [
  { id: "mobile-390", width: 390, height: 844, mobile: true },
  { id: "desktop-1293", width: 1293, height: 1043, mobile: false },
];

test("theater and classic header links route to their own genre booking lists", async (t) => {
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
      await page.getByRole("link", { name: route.label, exact: true }).first().click();
      await page.waitForURL(new RegExp(`${route.path}$`));

      assert.equal(new URL(page.url()).pathname, route.path, `${viewport.id} ${route.label} URL`);
      await page.getByRole("heading", { name: `${route.label} 예매`, level: 1 }).waitFor({ timeout: 5000 });
      await page.getByRole("link", { name: new RegExp(route.title) }).first().waitFor({ timeout: 5000 });
      assert.equal(await page.locator(`a[href="/goods/${route.slug}"]`).count(), 1, `${viewport.id} ${route.label} show link`);
      assert.equal(await page.locator("text=뮤지컬 예매").count(), 0, `${viewport.id} ${route.label} does not render musical heading`);

      await page.locator(`a[href="/goods/${route.slug}"]`).first().click();
      await page.waitForURL(new RegExp(`/goods/${route.slug}$`));
      await page.getByRole("heading", { name: new RegExp(route.title) }).first().waitFor({ timeout: 5000 });
      await page.getByRole("link", { name: "선택 회차 예매" }).waitFor({ timeout: 5000 });
    }
  }
});

test("existing musical and exhibition genre routes stay available", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 } });
  t.after(() => page.close());

  await page.goto(`${baseUrl}/contents/genre/musical`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "뮤지컬 예매", level: 1 }).waitFor({ timeout: 5000 });
  assert.ok(await page.locator('a[href="/goods/les-miserables"]').count() >= 1);

  await page.goto(`${baseUrl}/contents/genre/exhibition`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "전시/행사 예매", level: 1 }).waitFor({ timeout: 5000 });
  assert.ok(await page.locator('a[href="/goods/banksy"]').count() >= 1);
});
