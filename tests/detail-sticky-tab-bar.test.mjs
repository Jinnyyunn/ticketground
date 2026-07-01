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

test("detail sticky tab bar attaches to the category header and keeps anchors visible", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1293, height: 1043 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${baseUrl}/goods/les-miserables`, { waitUntil: "networkidle" });

    const categoryNav = page.getByRole("navigation", { name: "카테고리" });
    const detailNav = page.getByRole("navigation", { name: "상세 정보 바로가기" });
    await categoryNav.waitFor({ timeout: 5000 });
    await detailNav.waitFor({ timeout: 5000 });

    await scrollUntilSticky(page);
    const stickyState = await readStickyState(page);
    assert.ok(
      stickyState.gapPx >= 0 && stickyState.gapPx <= 2 && stickyState.isOpaqueWhite && stickyState.backdropFilter === "none",
      [
        "detail sticky tab bar should sit directly below category header with opaque white background and no blur",
        `categoryBottom=${stickyState.categoryBottom}`,
        `detailTop=${stickyState.detailTop}`,
        `gapPx=${stickyState.gapPx}`,
        `backgroundColor=${stickyState.backgroundColor}`,
        `backdropFilter=${stickyState.backdropFilter}`,
      ].join(" | "),
    );

    assert.ok(
      stickyState.scrollWidth <= stickyState.viewportWidth + 1,
      `page should not overflow horizontally: scrollWidth=${stickyState.scrollWidth} viewportWidth=${stickyState.viewportWidth}`,
    );

    for (const tab of detailTabs) {
      await detailNav.getByRole("link", { name: tab.label, exact: true }).click();
      await page.waitForFunction((expectedHash) => window.location.hash === expectedHash, tab.href);

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

async function scrollUntilSticky(page) {
  await page.evaluate(async () => {
    const detail = document.querySelector('nav[aria-label="상세 정보 바로가기"]');
    if (!detail) throw new Error("detail nav missing");

    let previousTop = Number.POSITIVE_INFINITY;
    for (let scrollY = 0; scrollY <= 1600; scrollY += 40) {
      window.scrollTo(0, scrollY);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const top = detail.getBoundingClientRect().top;
      if (Math.abs(top - previousTop) < 0.5 && scrollY > 0) return;
      previousTop = top;
    }
  });
}

async function readStickyState(page) {
  const state = await page.evaluate(() => {
    const category = document.querySelector('nav[aria-label="카테고리"]')?.closest(".sticky");
    const detail = document.querySelector('nav[aria-label="상세 정보 바로가기"]');
    if (!category || !detail) return null;

    const categoryRect = category.getBoundingClientRect();
    const detailRect = detail.getBoundingClientRect();
    const style = window.getComputedStyle(detail);
    const backgroundColor = style.backgroundColor;
    const colorMatch = backgroundColor.match(/^rgba?\(([^)]+)\)$/);
    const colorParts = colorMatch ? colorMatch[1].split(",").map((part) => Number(part.trim())) : [];
    const alpha = colorParts.length === 4 ? colorParts[3] : 1;

    return {
      categoryBottom: categoryRect.height,
      detailTop: detailRect.top,
      gapPx: detailRect.top - categoryRect.height,
      backgroundColor,
      isOpaqueWhite: colorParts[0] === 255 && colorParts[1] === 255 && colorParts[2] === 255 && alpha === 1,
      backdropFilter: style.backdropFilter,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  assert.ok(state, "sticky category header and detail nav exist");
  return state;
}
