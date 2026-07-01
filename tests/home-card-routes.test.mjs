import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const evidencePhase = process.env.ISSUE51_EVIDENCE_PHASE ?? "regression";
const evidenceDir = path.join(".omo", "evidence", "issue-51-home-card-routes", evidencePhase);

const scenarios = [
  {
    id: "featured-iu-card",
    selector: 'section[data-section="spec-hero"] a:has-text("IU 2026 WORLD TOUR")',
    expectedPath: "/goods/iu-world-tour",
    expectedText: "IU 2026 WORLD TOUR",
  },
  {
    id: "mini-les-miserables-card",
    selector: 'section[data-section="spec-hero"] a:has-text("레미제라블 40주년")',
    expectedPath: "/goods/les-miserables",
    expectedText: "레미제라블",
  },
  {
    id: "mini-berlin-phil-card",
    selector: 'section[data-section="spec-hero"] a:has-text("베를린필 내한공연")',
    expectedPath: "/goods/berlin-phil",
    expectedText: "베를린필",
  },
  {
    id: "ranking-seventeen-card",
    selector: 'section[data-section="realtime-top10"] a:has-text("SEVENTEEN TOUR")',
    expectedPath: "/goods/seventeen-tour",
    expectedText: "SEVENTEEN TOUR",
  },
  {
    id: "ranking-hadestown-card",
    selector: 'section[data-section="realtime-top10"] a:has-text("하데스타운")',
    expectedPath: "/goods/hadestown",
    expectedText: "하데스타운",
  },
  {
    id: "ranking-nct-wish-card",
    selector: 'section[data-section="realtime-top10"] a:has-text("NCT WISH FANMEETING")',
    expectedPath: "/goods/nct-wish-fanmeeting",
    expectedText: "NCT WISH FANMEETING",
  },
  {
    id: "ranking-cho-seong-jin-card",
    selector: 'section[data-section="realtime-top10"] a:has-text("조성진 피아노 리사이틀")',
    expectedPath: "/goods/cho-seong-jin",
    expectedText: "조성진 피아노 리사이틀",
  },
  {
    id: "ranking-phantom-card",
    selector: 'section[data-section="realtime-top10"] a:has-text("오페라의 유령")',
    expectedPath: "/goods/phantom-of-the-opera",
    expectedText: "오페라의 유령",
  },
  {
    id: "ranking-day6-card",
    selector: 'section[data-section="realtime-top10"] a:has-text("DAY6 Special Live")',
    expectedPath: "/goods/day6-special-live",
    expectedText: "DAY6 Special Live",
  },
  {
    id: "genre-seventeen-card",
    selector: 'section[data-section="genre-recommendations"] a[data-card="genre-recommendation"]:has-text("SEVENTEEN TOUR")',
    expectedPath: "/goods/seventeen-tour",
    expectedText: "SEVENTEEN TOUR",
  },
  {
    id: "genre-day6-card",
    selector: 'section[data-section="genre-recommendations"] a[data-card="genre-recommendation"]:has-text("DAY6 Special Live")',
    expectedPath: "/goods/day6-special-live",
    expectedText: "DAY6 Special Live",
  },
  {
    id: "genre-nct-wish-card",
    selector: 'section[data-section="genre-recommendations"] a[data-card="genre-recommendation"]:has-text("NCT WISH FANMEETING")',
    expectedPath: "/goods/nct-wish-fanmeeting",
    expectedText: "NCT WISH FANMEETING",
  },
  {
    id: "genre-les-miserables-card",
    selector: 'section[data-section="genre-recommendations"] a:has-text("레미제라블 40주년")',
    expectedPath: "/goods/les-miserables",
    expectedText: "레미제라블",
  },
  {
    id: "genre-hadestown-card",
    selector: 'section[data-section="genre-recommendations"] a[data-card="genre-recommendation"]:has-text("하데스타운")',
    expectedPath: "/goods/hadestown",
    expectedText: "하데스타운",
  },
  {
    id: "genre-phantom-card",
    selector: 'section[data-section="genre-recommendations"] a[data-card="genre-recommendation"]:has-text("오페라의 유령")',
    expectedPath: "/goods/phantom-of-the-opera",
    expectedText: "오페라의 유령",
  },
  {
    id: "genre-cho-seong-jin-card",
    selector: 'section[data-section="genre-recommendations"] a[data-card="genre-recommendation"]:has-text("조성진 피아노 리사이틀")',
    expectedPath: "/goods/cho-seong-jin",
    expectedText: "조성진 피아노 리사이틀",
  },
  {
    id: "genre-kun-woo-paik-card",
    selector: 'section[data-section="genre-recommendations"] a[data-card="genre-recommendation"]:has-text("백건우와 라벨")',
    expectedPath: "/goods/kun-woo-paik-ravel",
    expectedText: "백건우와 라벨",
  },
  {
    id: "genre-cherry-orchard-card",
    selector: 'section[data-section="genre-recommendations"] a[data-card="genre-recommendation"]:has-text("연극 벚꽃동산")',
    expectedPath: "/goods/cherry-orchard",
    expectedText: "연극 벚꽃동산",
  },
];

test("home show cards route to destinations that match their visible titles", async (t) => {
  await mkdir(evidenceDir, { recursive: true });
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const failures = [];

  for (const scenario of scenarios) {
    const page = await browser.newPage({ viewport: { width: 1293, height: 1043 }, deviceScaleFactor: 1 });
    t.after(() => page.close());

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    const card = page.locator(scenario.selector).first();
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: path.join(evidenceDir, `${scenario.id}-source.png`) });

    const visibleTitle = (await card.locator("h1,h3,h4").first().textContent())?.trim() ?? "";
    const href = await card.getAttribute("href");
    assert.ok(href, `${scenario.id} exposes an href`);
    const hrefPath = new URL(href, baseUrl).pathname;

    let destinationPath = "";
    let destinationContainsExpectedText = false;
    let queueHref = "";
    let destinationTextSample = "";

    if (hrefPath === scenario.expectedPath) {
      await Promise.all([
        page.waitForURL(`**${scenario.expectedPath}`, { timeout: 10_000 }),
        card.click(),
      ]);
      await page.waitForLoadState("networkidle");

      const destinationUrl = new URL(page.url());
      const bodyText = await page.locator("body").innerText();
      const queueLink = page.locator('[data-testid="detail-queue-link"]').first();
      destinationPath = destinationUrl.pathname;
      destinationContainsExpectedText = bodyText.includes(scenario.expectedText);
      queueHref = (await queueLink.getAttribute("href")) ?? "";
      destinationTextSample = bodyText.slice(0, 500);
      await page.screenshot({ path: path.join(evidenceDir, `${scenario.id}-destination.png`), fullPage: true });
    }

    const result = {
      id: scenario.id,
      visibleTitle,
      href,
      hrefPath,
      expectedPath: scenario.expectedPath,
      actualPath: destinationPath,
      expectedText: scenario.expectedText,
      destinationContainsExpectedText,
      queueHref,
      detailQueueLinkStartsWithShowQueue: queueHref.startsWith(`/queue/${scenario.expectedPath.replace("/goods/", "")}?`),
      destinationTextSample,
    };
    await writeFile(path.join(evidenceDir, `${scenario.id}.json`), `${JSON.stringify(result, null, 2)}\n`);

    if (
      result.hrefPath !== scenario.expectedPath ||
      result.actualPath !== scenario.expectedPath ||
      !result.destinationContainsExpectedText ||
      !result.detailQueueLinkStartsWithShowQueue
    ) {
      failures.push(result);
    }
  }

  assert.deepEqual(failures, []);
});
