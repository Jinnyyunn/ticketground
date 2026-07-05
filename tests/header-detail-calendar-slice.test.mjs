import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const mobileNavPath = new URL("../src/components/mobile-nav.tsx", import.meta.url);
const homeCardsPath = new URL("../src/components/home/home-cards.tsx", import.meta.url);
const primitivesPath = new URL("../src/components/ticketground/primitives.tsx", import.meta.url);
const buttonPath = new URL("../src/components/ui/button.tsx", import.meta.url);
const searchPanelsPath = new URL("../src/components/discovery/search-panels.tsx", import.meta.url);

test("mobile nav backdrop uses the fixed scrim token instead of theme ink", async () => {
  const mobileNav = await readFile(mobileNavPath, "utf8");

  assert.match(mobileNav, /Dialog\.Backdrop className="[^"]*bg-scrim\/45/);
  assert.doesNotMatch(mobileNav, /bg-ink\/45/);
});

test("bright badges use fixed accent foreground tokens instead of theme ink", async () => {
  const homeCards = await readFile(homeCardsPath, "utf8");
  const primitives = await readFile(primitivesPath, "utf8");
  const button = await readFile(buttonPath, "utf8");
  const searchPanels = await readFile(searchPanelsPath, "utf8");

  assert.doesNotMatch(homeCards, /bg-white\/90 text-ink/);
  assert.match(homeCards, /bg-white\/90 text-on-accent-2/);
  assert.doesNotMatch(primitives, /sale:\s*"bg-accent-2 text-ink"/);
  assert.match(primitives, /sale:\s*"bg-accent-2 text-on-accent-2"/);
  assert.doesNotMatch(button, /clean:\s*"bg-accent-2 text-ink/);
  assert.match(button, /clean:\s*"bg-accent-2 text-on-accent-2/);
  assert.doesNotMatch(searchPanels, /bg-accent-2[^"]*text-ink/);
  assert.match(searchPanels, /bg-accent-2[^"]*text-on-accent-2/);
});

test("detail booking panel presents price context and a brand final CTA", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${baseUrl}/goods/les-miserables`, { waitUntil: "networkidle" });

    const panel = page.getByTestId("detail-booking-panel");
    await panel.waitFor({ timeout: 5000 });
    await panel.getByText("최저 80,000원부터", { exact: true }).waitFor({ timeout: 5000 });
    await panel.getByText(/대기열 입장.+순서 확인/).waitFor({ timeout: 5000 });

    const queueLink = panel.getByTestId("detail-queue-link");
    const className = await queueLink.getAttribute("class");
    assert.match(className ?? "", /bg-ticketground/);
    assert.doesNotMatch(className ?? "", /(^|\s)bg-ink(\s|$)/);
  } finally {
    await page.close();
  }
});

test("open calendar exposes genre legend, realistic event distribution, and brand alert CTA", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 1, colorScheme: "dark" });
  try {
    await page.goto(`${baseUrl}/open`, { waitUntil: "networkidle" });

    const legend = page.locator("[data-open-genre-legend]");
    await legend.waitFor({ timeout: 5000 });
    const legendLabels = await legend.locator("[data-open-genre-chip]").evaluateAll((chips) => chips.map((chip) => chip.textContent?.trim() ?? ""));
    assert.deepEqual(legendLabels, ["뮤지컬", "콘서트", "연극", "클래식", "스포츠", "전시/행사", "아동/가족"]);

    const eventDays = await page.locator("[data-open-calendar-grid] a[data-allow-wrap='true']").evaluateAll((links) =>
      links.map((link) => Number(link.closest("[data-open-day]")?.getAttribute("data-open-day") ?? "0")),
    );
    assert.ok(eventDays.length >= 18, `expected richer event coverage, got ${eventDays.length}`);
    assert.ok(eventDays.some((day) => day % 2 === 0), `expected at least one even-day event, got ${eventDays.join(",")}`);

    const alertCta = page.getByRole("link", { name: "관심공연 알림", exact: true });
    const ctaClass = await alertCta.getAttribute("class");
    assert.match(ctaClass ?? "", /bg-ticketground/);

    const chipColors = await legend.locator("[data-open-genre-chip]").evaluateAll((chips) =>
      chips.map((chip) => {
        const style = window.getComputedStyle(chip);
        return {
          color: style.color,
          backgroundColor: style.backgroundColor,
        };
      }),
    );
    assert.ok(
      chipColors.every((colors) => colors.color !== colors.backgroundColor && colors.backgroundColor !== "rgba(0, 0, 0, 0)"),
      `legend chips should retain visible genre tone colors: ${JSON.stringify(chipColors)}`,
    );
  } finally {
    await page.close();
  }
});

async function resolveBaseUrl(t) {
  if (process.env.TICKETGROUND_TEST_BASE_URL) return process.env.TICKETGROUND_TEST_BASE_URL;
  return (await startServer(t)).baseUrl;
}
