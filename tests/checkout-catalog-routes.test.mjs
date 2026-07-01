import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const checkoutRoutes = [
  {
    slug: "king-lear",
    title: "국립극단 리어왕",
    query: "date=2026.07.18&time=19%3A30&seat=R%EC%84%9D%20A-12&base=70000&fee=1000&total=71000&count=1",
  },
  {
    slug: "berlin-phil",
    title: "베를린필 내한공연",
    query: "date=2026.10.21&time=20%3A00&seat=VIP%EC%84%9D%20A-12&base=280000&fee=1000&total=281000&count=1",
  },
  {
    slug: "breadbarbershop",
    title: "브레드이발소 여름방학 특별전",
    query: "date=2026.07.16&time=10%3A30&seat=%EC%84%B1%EC%9D%B8%20A-12&base=18000&fee=1000&total=19000&count=1",
  },
];

test("bookable catalog checkout direct URLs render payment confirmation", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const route of checkoutRoutes) {
    const page = await browser.newPage({ viewport: { width: 1293, height: 1043 } });
    try {
      const response = await page.goto(`${baseUrl}/checkout/${route.slug}?${route.query}`, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200, `${route.slug} checkout status`);
      await page.getByRole("heading", { name: "결제 정보 확인", level: 1 }).waitFor({ timeout: 5000 });
      await page.getByRole("heading", { name: route.title }).first().waitFor({ timeout: 5000 });
      assert.equal(await page.locator("text=404").count(), 0, `${route.slug} checkout does not render 404`);
    } finally {
      await page.close();
    }
  }
});
