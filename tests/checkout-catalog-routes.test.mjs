import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const checkoutRoutes = [
  {
    slug: "iu-world-tour",
    title: "IU 2026 WORLD TOUR",
    query: "date=2026.09.12&time=18%3A00&seat=VIP%EC%84%9D%20A-12&base=198000&fee=1000&total=199000&count=1",
  },
  {
    slug: "seventeen-tour",
    title: "SEVENTEEN TOUR",
    query: "date=2026.08.08&time=18%3A00&seat=VIP%EC%84%9D%20A-12&base=198000&fee=1000&total=199000&count=1",
  },
  {
    slug: "hadestown",
    title: "하데스타운",
    query: "date=2026.07.04&time=19%3A30&seat=VIP%EC%84%9D%20A-12&base=170000&fee=1000&total=171000&count=1",
  },
  {
    slug: "nct-wish-fanmeeting",
    title: "NCT WISH FANMEETING",
    query: "date=2026.07.25&time=18%3A00&seat=R%EC%84%9D%20A-12&base=143000&fee=1000&total=144000&count=1",
  },
  {
    slug: "cho-seong-jin",
    title: "조성진 피아노 리사이틀",
    query: "date=2026.11.02&time=20%3A00&seat=VIP%EC%84%9D%20A-12&base=220000&fee=1000&total=221000&count=1",
  },
  {
    slug: "phantom-of-the-opera",
    title: "오페라의 유령",
    query: "date=2026.06.30&time=19%3A30&seat=VIP%EC%84%9D%20A-12&base=180000&fee=1000&total=181000&count=1",
  },
  {
    slug: "day6-special-live",
    title: "DAY6 Special Live",
    query: "date=2026.08.29&time=18%3A00&seat=R%EC%84%9D%20A-12&base=154000&fee=1000&total=155000&count=1",
  },
  {
    slug: "kun-woo-paik-ravel",
    title: "백건우와 라벨",
    query: "date=2026.09.04&time=19%3A30&seat=R%EC%84%9D%20A-12&base=120000&fee=1000&total=121000&count=1",
  },
  {
    slug: "cherry-orchard",
    title: "연극 벚꽃동산",
    query: "date=2026.08.06&time=19%3A30&seat=R%EC%84%9D%20A-12&base=66000&fee=1000&total=67000&count=1",
  },
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
