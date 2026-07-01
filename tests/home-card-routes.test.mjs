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
    expectedPath: "/queue/iu-world-tour",
    expectedText: "IU 2026 WORLD TOUR",
  },
  {
    id: "genre-les-miserables-card",
    selector: 'section[data-section="genre-recommendations"] a:has-text("레미제라블 40주년")',
    expectedPath: "/goods/les-miserables",
    expectedText: "레미제라블",
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
    await Promise.all([
      page.waitForURL(`**${href}`, { timeout: 10_000 }),
      card.click(),
    ]);
    await page.waitForLoadState("networkidle");

    const destinationUrl = new URL(page.url());
    const bodyText = await page.locator("body").innerText();
    await page.screenshot({ path: path.join(evidenceDir, `${scenario.id}-destination.png`), fullPage: true });

    const result = {
      id: scenario.id,
      visibleTitle,
      href,
      expectedPath: scenario.expectedPath,
      actualPath: destinationUrl.pathname,
      expectedText: scenario.expectedText,
      destinationContainsExpectedText: bodyText.includes(scenario.expectedText),
      destinationTextSample: bodyText.slice(0, 500),
    };
    await writeFile(path.join(evidenceDir, `${scenario.id}.json`), `${JSON.stringify(result, null, 2)}\n`);

    if (result.actualPath !== scenario.expectedPath || !result.destinationContainsExpectedText) {
      failures.push(result);
    }
  }

  assert.deepEqual(failures, []);
});
