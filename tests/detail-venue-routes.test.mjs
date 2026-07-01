import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const venueCases = [
  {
    slug: "les-miserables",
    ctaText: "BLUE SQUARE 공연장 상세 보기",
    href: "/place/blue-square",
    heading: "블루스퀘어 신한카드홀",
  },
  {
    slug: "iu-world-tour",
    ctaText: "JAMSIL OLYMPIC MAIN STADIUM 공연장 상세 보기",
    href: "/place/jamsil-olympic-main-stadium",
    heading: "잠실종합운동장 주경기장",
  },
  {
    slug: "dracula",
    ctaText: "LG ARTS CENTER 공연장 상세 보기",
    href: "/place/lg-arts-center",
    heading: "LG아트센터 서울 LG SIGNATURE 홀",
  },
  {
    slug: "berlin-phil",
    ctaText: "SEOUL ARTS CENTER 공연장 상세 보기",
    href: "/place/sac-concert-hall",
    heading: "예술의전당 콘서트홀",
  },
];

test("goods venue links route to each show's venue page", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const item of venueCases) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    t.after(() => page.close());

    await page.goto(`${baseUrl}/goods/${item.slug}`, { waitUntil: "domcontentloaded" });
    const venueCta = page.locator("#place a").last();
    await venueCta.waitFor({ timeout: 5000 });

    assert.equal((await venueCta.innerText()).replace(/\s+/g, " ").trim(), item.ctaText, `${item.slug} venue CTA label`);
    assert.equal(await venueCta.getAttribute("href"), item.href, `${item.slug} venue CTA href`);

    const seatPreview = page.getByRole("link", { name: "공연장 좌석 미리보기" }).first();
    assert.equal(await seatPreview.getAttribute("href"), item.href, `${item.slug} seat preview href`);

    await page.goto(`${baseUrl}${item.href}`, { waitUntil: "domcontentloaded" });
    const heading = page.locator("h1").first();
    await heading.waitFor({ timeout: 5000 });
    assert.equal((await heading.innerText()).replace(/\s+/g, " ").trim(), item.heading, `${item.slug} venue page heading`);
  }
});
