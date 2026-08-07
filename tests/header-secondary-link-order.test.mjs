import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

test("desktop header places ticket open calendar to the right of resale", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${baseUrl}/watchlist`, { waitUntil: "networkidle" });

    const visibleQuickLinks = await page.locator("header a[href='/resale'], header a[href='/open']").evaluateAll((anchors) =>
      anchors
        .filter((anchor) => {
          const rect = anchor.getBoundingClientRect();
          const style = window.getComputedStyle(anchor);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        })
        .map((anchor) => ({
          href: anchor.getAttribute("href"),
          text: anchor.textContent?.trim() ?? "",
          x: anchor.getBoundingClientRect().x,
        })),
    );

    const resale = visibleQuickLinks.find((link) => link.href === "/resale");
    const openCalendar = visibleQuickLinks.find((link) => link.href === "/open");

    assert.ok(resale, `visible resale link missing: ${JSON.stringify(visibleQuickLinks)}`);
    assert.ok(openCalendar, `visible ticket open calendar link missing: ${JSON.stringify(visibleQuickLinks)}`);
    assert.equal(resale.text, "CLEAN TICKET 재판매");
    assert.equal(openCalendar.text, "티켓오픈 캘린더");
    assert.ok(resale.x < openCalendar.x, `expected resale before calendar: ${JSON.stringify(visibleQuickLinks)}`);

    const actionStyles = await page.locator("nav[aria-label='티켓오픈'] a[href='/resale'], nav[aria-label='티켓오픈'] a[href='/open']").evaluateAll((anchors) =>
      anchors.map((anchor) => {
        const style = window.getComputedStyle(anchor);
        return {
          href: anchor.getAttribute("href"),
          backgroundColor: style.backgroundColor,
          color: style.color,
          borderRadius: style.borderRadius,
          display: style.display,
        };
      }),
    );
    assert.equal(actionStyles.length, 2);
    for (const style of actionStyles) {
      assert.notEqual(style.backgroundColor, "rgba(0, 0, 0, 0)", `expected badge background: ${JSON.stringify(style)}`);
      assert.ok(Number.parseFloat(style.borderRadius) >= 8, `expected compact rounded badge: ${JSON.stringify(style)}`);
      assert.equal(style.display, "flex");
    }

    const resaleStyle = actionStyles.find((style) => style.href === "/resale");
    assert.ok(resaleStyle, `resale action style missing: ${JSON.stringify(actionStyles)}`);
    assert.equal(resaleStyle.backgroundColor, "rgb(255, 233, 46)");
    assert.equal(resaleStyle.color, "rgb(58, 41, 41)");
  } finally {
    await page.close();
  }
});

test("desktop utility bar keeps theme switch at the far end after auth links", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const utilityBar = page.locator("header > div").first();
    await utilityBar.getByRole("switch").waitFor({ timeout: 5000 });
    const itemOrder = await utilityBar.locator(".ticketground-container").evaluate((container) =>
      [...container.children]
        .filter((child) => child.tagName === "A" || ["switch", "combobox"].includes(child.getAttribute("role") ?? ""))
        .map((child) => {
          const role = child.getAttribute("role");
          if (role === "switch") return "ThemeToggle";
          if (role === "combobox") return "LanguageSwitcher";
          return child.textContent?.trim() ?? "";
        }),
    );

    // 언어 선택 메뉴 (나라별 언어 적용 계획서.md 4.4: "데스크톱: 헤더 유틸리티
    // 영역의 언어 메뉴") sits after the auth links and before the theme
    // switch, which stays the last control.
    assert.deepEqual(itemOrder, ["고객센터", "로그인", "회원가입", "LanguageSwitcher", "ThemeToggle"]);
  } finally {
    await page.close();
  }
});

test("desktop category and highlight badges do not clip sports at common widths", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  for (const width of [1280, 1366, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    try {
      await page.goto(baseUrl, { waitUntil: "networkidle" });

      const metrics = await page.getByRole("navigation", { name: "카테고리" }).evaluate((nav) => {
        const sports = [...nav.querySelectorAll("a")].find((link) => link.textContent?.trim() === "스포츠");
        if (!(sports instanceof HTMLElement)) throw new Error("sports nav link missing");
        const navRect = nav.getBoundingClientRect();
        const sportsRect = sports.getBoundingClientRect();
        return {
          navScrollWidth: nav.scrollWidth,
          navClientWidth: nav.clientWidth,
          sportsLeft: sportsRect.left,
          sportsRight: sportsRect.right,
          navLeft: navRect.left,
          navRight: navRect.right,
        };
      });

      assert.ok(metrics.navScrollWidth <= metrics.navClientWidth + 1, `${width}px category nav should not require hidden desktop scroll`);
      assert.ok(metrics.sportsLeft >= metrics.navLeft - 1, `${width}px sports link should not be clipped on the left`);
      assert.ok(metrics.sportsRight <= metrics.navRight - 1, `${width}px sports link should not be clipped on the right`);
    } finally {
      await page.close();
    }
  }
});

test("desktop resale action is visually stronger than ticket open calendar", async (t) => {
  const baseUrl = await resolveBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const actionState = await page.locator("nav[aria-label='티켓오픈']").evaluate((nav) => {
      const resale = nav.querySelector("a[href='/resale']");
      const openCalendar = nav.querySelector("a[href='/open']");
      if (!(resale instanceof HTMLElement) || !(openCalendar instanceof HTMLElement)) {
        throw new Error("desktop action links missing");
      }
      const resaleStyle = window.getComputedStyle(resale);
      const openStyle = window.getComputedStyle(openCalendar);
      return {
        resaleClass: resale.className,
        resaleText: resale.textContent?.trim() ?? "",
        openClass: openCalendar.className,
        resaleBackground: resaleStyle.backgroundColor,
        openBackground: openStyle.backgroundColor,
        resaleColor: resaleStyle.color,
        openColor: openStyle.color,
      };
    });

    assert.equal(actionState.resaleText, "CLEAN TICKET 재판매");
    assert.match(actionState.resaleClass, /bg-accent-2/);
    assert.match(actionState.resaleClass, /text-\[#3A2929\]/);
    assert.notEqual(actionState.resaleBackground, actionState.openBackground);
    assert.notEqual(actionState.resaleColor, actionState.openColor);
    assert.match(actionState.openClass, /bg-card/);
  } finally {
    await page.close();
  }
});

async function resolveBaseUrl(t) {
  if (process.env.TICKETGROUND_TEST_BASE_URL) return process.env.TICKETGROUND_TEST_BASE_URL;
  return (await startServer(t)).baseUrl;
}
