import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const detailTabs = [
  { href: "#intro", label: "공연소개" },
  { href: "#cast", label: "출연진" },
  { href: "#schedule", label: "공연일정" },
  { href: "#place", label: "장소" },
  { href: "#notices", label: "유의사항" },
];
const viewports = [
  { name: "desktop", width: 1293, height: 1043, deviceScaleFactor: 1, isMobile: false },
  { name: "tablet", width: 768, height: 1024, deviceScaleFactor: 1, isMobile: false },
  { name: "iphone-like", width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
  { name: "galaxy-like", width: 412, height: 915, deviceScaleFactor: 2, isMobile: true },
];

function optionValue(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args.at(index + 1);
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

const baseUrl = optionValue("--base-url", "http://127.0.0.1:4500").replace(/\/$/, "");
const evidenceDir = optionValue("--evidence-dir", ".omo/evidence/issue28-detail-tab-sticky-bar/manual-qa");
const reportPath = optionValue("--report", path.join(evidenceDir, "report.json"));

const report = {
  status: "fail",
  startedAt: new Date().toISOString(),
  baseUrl,
  route: "/goods/les-miserables",
  thresholds: {
    gapPx: "0..2",
    backgroundColor: "opaque white",
    backdropFilter: "none",
    maxHorizontalOverflowPx: 1,
  },
  viewports: [],
  screenshots: [],
};

await mkdir(evidenceDir, { recursive: true });

let browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });

  for (const viewport of viewports) {
    await runViewport(browser, viewport);
  }

  report.status = report.viewports.every((viewport) => viewport.status === "pass") ? "pass" : "fail";
} catch (error) {
  report.fatalError = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  if (browser) {
    await browser.close();
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

if (report.status !== "pass") {
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(report, null, 2));
}

async function runViewport(activeBrowser, viewport) {
  const page = await activeBrowser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor,
    isMobile: viewport.isMobile,
  });
  page.setDefaultTimeout(10000);

  const viewportReport = {
    name: viewport.name,
    viewport: { width: viewport.width, height: viewport.height },
    status: "fail",
    measurements: null,
    tabChecks: [],
    screenshot: null,
    errors: [],
  };
  report.viewports.push(viewportReport);

  try {
    await page.goto(`${baseUrl}/goods/les-miserables`, { waitUntil: "networkidle" });
    const categoryNav = page.getByRole("navigation", { name: "카테고리" });
    const detailNav = page.getByRole("navigation", { name: "상세 정보 바로가기" });
    await categoryNav.waitFor();
    await detailNav.waitFor();

    await scrollUntilSticky(page);
    const measurements = await readStickyState(page);
    viewportReport.measurements = measurements;

    assert.ok(
      measurements.gapPx >= 0 && measurements.gapPx <= 2,
      `gapPx must be 0..2: ${measurements.gapPx}`,
    );
    assert.equal(measurements.isOpaqueWhite, true, `detail nav background must be opaque white: ${measurements.backgroundColor}`);
    assert.equal(measurements.backdropFilter, "none", `detail nav backdropFilter must be none: ${measurements.backdropFilter}`);
    assert.ok(
      measurements.scrollWidth <= measurements.viewportWidth + 1,
      `document scrollWidth must not exceed viewportWidth + 1: scrollWidth=${measurements.scrollWidth} viewportWidth=${measurements.viewportWidth}`,
    );

    const screenshotPath = path.join(evidenceDir, `issue28-${viewport.name}-sticky.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    report.screenshots.push(screenshotPath);
    viewportReport.screenshot = screenshotPath;

    for (const tab of detailTabs) {
      const tabCheck = await clickAndMeasureTab(page, tab);
      viewportReport.tabChecks.push(tabCheck);
      assert.equal(tabCheck.hash, tab.href, `${tab.label} should set hash ${tab.href}`);
      assert.equal(tabCheck.targetVisibleBelowStickyNav, true, `${tab.label} target should be visible below sticky nav`);
    }

    viewportReport.status = "pass";
  } catch (error) {
    viewportReport.errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    await page.close();
  }
}

async function scrollUntilSticky(page) {
  await page.evaluate(async () => {
    const category = document.querySelector('nav[aria-label="카테고리"]')?.closest(".sticky");
    const detail = document.querySelector('nav[aria-label="상세 정보 바로가기"]');
    if (!category || !detail) throw new Error("sticky category header or detail nav missing");

    const targetTop = category.getBoundingClientRect().height;
    const maxScrollY = Math.max(1800, document.documentElement.scrollHeight - window.innerHeight);
    for (let scrollY = 0; scrollY <= maxScrollY; scrollY += 40) {
      window.scrollTo(0, scrollY);
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const top = detail.getBoundingClientRect().top;
      if (top <= targetTop + 2) return;
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
    const colorParts = parseRgb(backgroundColor);
    const alpha = colorParts.length === 4 ? colorParts[3] : 1;
    const categoryBottom = categoryRect.height;

    return {
      categoryBottom,
      detailTop: detailRect.top,
      gapPx: detailRect.top - categoryBottom,
      backgroundColor,
      isOpaqueWhite: colorParts[0] === 255 && colorParts[1] === 255 && colorParts[2] === 255 && alpha === 1,
      backdropFilter: style.backdropFilter,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };

    function parseRgb(value) {
      const match = value.match(/^rgba?\((.*)\)$/);
      if (!match) return [];
      const normalized = match[1].replace(/\//g, " ").replace(/,/g, " ");
      return normalized.split(/\s+/).filter(Boolean).map(Number);
    }
  });

  assert.ok(state, "sticky category header and detail nav exist");
  return state;
}

async function clickAndMeasureTab(page, tab) {
  const detailNav = page.getByRole("navigation", { name: "상세 정보 바로가기" });
  await detailNav.getByRole("link", { name: tab.label, exact: true }).click();
  await page.waitForFunction((expectedHash) => window.location.hash === expectedHash, tab.href);
  await page.waitForTimeout(100);

  const state = await page.evaluate((href) => {
    const detail = document.querySelector('nav[aria-label="상세 정보 바로가기"]');
    const target = document.querySelector(href);
    if (!detail || !target) return null;

    const detailRect = detail.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    return {
      href,
      hash: window.location.hash,
      stickyBottom: detailRect.bottom,
      targetTop: targetRect.top,
      targetBottom: targetRect.bottom,
      viewportHeight: window.innerHeight,
      targetVisibleBelowStickyNav:
        targetRect.top >= detailRect.bottom - 1 &&
        targetRect.top < window.innerHeight &&
        targetRect.bottom > detailRect.bottom,
    };
  }, tab.href);

  assert.ok(state, `${tab.href} target exists`);
  return { label: tab.label, ...state };
}
