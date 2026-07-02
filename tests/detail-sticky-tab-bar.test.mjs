import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const detailTabs = [
  { href: "#intro", label: "공연소개" },
  { href: "#cast", label: "출연진" },
  { href: "#schedule", label: "공연일정" },
  { href: "#place", label: "장소" },
  { href: "#notices", label: "유의사항" },
];

test("detail sticky tab bar pins to the viewport top and keeps anchors visible", async (t) => {
  const baseUrl = await getBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${baseUrl}/goods/les-miserables`, { waitUntil: "networkidle" });

    const detailNav = page.getByRole("navigation", { name: "상세 정보 바로가기" });
    await detailNav.waitFor({ timeout: 5000 });

    await scrollUntilSticky(page);
    const stickyState = await readStickyState(page);
    assert.ok(
      stickyState.detailTop >= 0 && stickyState.detailTop <= 2 && stickyState.isOpaqueWhite && stickyState.backdropFilter === "none",
      [
        "detail sticky tab bar should pin to viewport top with opaque white background and no blur",
        `detailTop=${stickyState.detailTop}`,
        `backgroundColor=${stickyState.backgroundColor}`,
        `backdropFilter=${stickyState.backdropFilter}`,
      ].join(" | "),
    );

    assert.ok(
      stickyState.scrollWidth <= stickyState.viewportWidth + 1,
      `page should not overflow horizontally: scrollWidth=${stickyState.scrollWidth} viewportWidth=${stickyState.viewportWidth}`,
    );
    assert.ok(
      Math.abs(stickyState.navCenter - stickyState.tabGroupCenter) <= 1,
      `tab group should be centered in sticky bar: navCenter=${stickyState.navCenter} tabGroupCenter=${stickyState.tabGroupCenter}`,
    );

    for (const tab of detailTabs) {
      await detailNav.getByRole("link", { name: tab.label, exact: true }).click();
      await page.waitForFunction((expectedHash) => window.location.hash === expectedHash, tab.href);
      await page.waitForFunction((href) => {
        const detail = document.querySelector('nav[aria-label="상세 정보 바로가기"]');
        const target = document.querySelector(href);
        if (!detail || !target) return false;
        const detailRect = detail.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        return targetRect.top >= detailRect.bottom - 1 && targetRect.top < window.innerHeight;
      }, tab.href);

      const anchorState = await page.evaluate((href) => {
        const detail = document.querySelector('nav[aria-label="상세 정보 바로가기"]');
        const target = document.querySelector(href);
        if (!detail || !target) return null;
        const detailRect = detail.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        return {
          hash: window.location.hash,
          stickyBottom: detailRect.bottom,
          targetTop: targetRect.top,
          targetBottom: targetRect.bottom,
          viewportHeight: window.innerHeight,
        };
      }, tab.href);

      assert.ok(anchorState, `${tab.href} target exists`);
      assert.equal(anchorState.hash, tab.href);
      assert.ok(
        anchorState.targetTop >= anchorState.stickyBottom - 1 && anchorState.targetTop < anchorState.viewportHeight,
        `${tab.href} target should remain visible below sticky nav: targetTop=${anchorState.targetTop} stickyBottom=${anchorState.stickyBottom} viewportHeight=${anchorState.viewportHeight}`,
      );
      assert.ok(
        anchorState.targetBottom > anchorState.stickyBottom,
        `${tab.href} target content should not be hidden behind sticky nav: targetBottom=${anchorState.targetBottom} stickyBottom=${anchorState.stickyBottom}`,
      );
    }
  } finally {
    await page.close();
  }
});

test("detail tab clicks smooth-scroll when motion is allowed and respect reduced motion", async (t) => {
  const baseUrl = await getBaseUrl(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 }, deviceScaleFactor: 1 });
  try {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(`${baseUrl}/goods/les-miserables`, { waitUntil: "networkidle" });

    const detailNav = page.getByRole("navigation", { name: "상세 정보 바로가기" });
    await detailNav.waitFor({ timeout: 5000 });
    await page.evaluate(() => window.scrollTo(0, 0));

    const allowedMotionBehavior = await page.evaluate(() => window.getComputedStyle(document.documentElement).scrollBehavior);
    assert.equal(allowedMotionBehavior, "smooth", "html should use smooth scrolling when motion is allowed");

    await detailNav.getByRole("link", { name: "유의사항", exact: true }).click();
    await page.waitForFunction(() => window.location.hash === "#notices");

    const smoothScrollState = await sampleScrollMotion(page);
    assert.ok(
      smoothScrollState.hadAnimatedMovement,
      `tab click should animate scroll instead of jumping instantly: ${JSON.stringify(smoothScrollState)}`,
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    const reducedMotionBehavior = await page.evaluate(() => window.getComputedStyle(document.documentElement).scrollBehavior);
    assert.equal(reducedMotionBehavior, "auto", "html should not force smooth scrolling for reduced motion users");
  } finally {
    await page.close();
  }
});

async function scrollUntilSticky(page) {
  await page.evaluate(async () => {
    const detail = document.querySelector('nav[aria-label="상세 정보 바로가기"]');
    if (!detail) throw new Error("detail nav missing");

    let previousTop = Number.POSITIVE_INFINITY;
    for (let scrollY = 0; scrollY <= 1600; scrollY += 40) {
      window.scrollTo({ top: scrollY, behavior: "instant" });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const top = detail.getBoundingClientRect().top;
      if (Math.abs(top - previousTop) < 0.5 && scrollY > 0) return;
      previousTop = top;
    }
  });
}

async function getBaseUrl(t) {
  if (process.env.TEST_BASE_URL) return process.env.TEST_BASE_URL.replace(/\/$/, "");
  const { baseUrl } = await startServer(t);
  return baseUrl;
}

async function readStickyState(page) {
  const state = await page.evaluate(() => {
    const detail = document.querySelector('nav[aria-label="상세 정보 바로가기"]');
    if (!detail) return null;

    const detailRect = detail.getBoundingClientRect();
    const style = window.getComputedStyle(detail);
    const backgroundColor = style.backgroundColor;
    const colorMatch = backgroundColor.match(/^rgba?\(([^)]+)\)$/);
    const colorParts = colorMatch ? colorMatch[1].split(",").map((part) => Number(part.trim())) : [];
    const alpha = colorParts.length === 4 ? colorParts[3] : 1;

    return {
      detailTop: detailRect.top,
      navCenter: detailRect.left + detailRect.width / 2,
      tabGroupCenter: readTabGroupCenter(detail),
      backgroundColor,
      isOpaqueWhite: colorParts[0] === 255 && colorParts[1] === 255 && colorParts[2] === 255 && alpha === 1,
      backdropFilter: style.backdropFilter,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };

    function readTabGroupCenter(detailNav) {
      const links = Array.from(detailNav.querySelectorAll("a"));
      const first = links.at(0)?.getBoundingClientRect();
      const last = links.at(-1)?.getBoundingClientRect();
      if (!first || !last) return Number.NaN;
      return (first.left + last.right) / 2;
    }
  });

  assert.ok(state, "sticky detail nav exists");
  return state;
}

async function sampleScrollMotion(page) {
  return await page.evaluate(async () => {
    const samples = [];
    for (let index = 0; index < 16; index += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      samples.push(window.scrollY);
    }

    const first = samples.at(0) ?? 0;
    const last = samples.at(-1) ?? first;
    const max = Math.max(...samples);
    const min = Math.min(...samples);
    return {
      samples,
      first,
      last,
      range: max - min,
      hadAnimatedMovement: last > first + 80 && max - min > 80,
    };
  });
}
