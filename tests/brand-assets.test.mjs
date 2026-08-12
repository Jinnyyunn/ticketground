import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "playwright";
import { startServer } from "./backend-test-utils.mjs";

const logoPath = new URL("../public/images/brand/ticketground-logo.png", import.meta.url);
const darkLogoPath = new URL("../public/images/brand/ticketground-logo-dark.png", import.meta.url);
const tigPath = new URL("../public/images/brand/tig-logo.png", import.meta.url);
const faviconPath = new URL("../src/app/favicon.ico", import.meta.url);

test("brand assets use the supplied Ticketground wordmark and TIG mark", async () => {
  const logo = await sharp(fileURLToPath(logoPath)).metadata();
  const darkLogo = await sharp(fileURLToPath(darkLogoPath)).metadata();
  const tig = await sharp(fileURLToPath(tigPath)).metadata();
  const favicon = await readFile(faviconPath);

  assert.deepEqual({ width: logo.width, height: logo.height, channels: logo.channels }, { width: 1015, height: 179, channels: 4 });
  assert.deepEqual({ width: darkLogo.width, height: darkLogo.height, channels: darkLogo.channels }, { width: 1015, height: 179, channels: 4 });
  assert.deepEqual({ width: tig.width, height: tig.height }, { width: 1254, height: 1254 });
  assert.equal(favicon.readUInt16LE(0), 0, "favicon ICO header must have a reserved zero field");
  assert.equal(favicon.readUInt16LE(2), 1, "favicon must be an icon resource");
  assert.equal(favicon.readUInt16LE(4), 3, "favicon must include 16, 32, and 96px entries");
});

test("homepage chrome and metadata expose the shared brand assets", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());

  await page.goto(baseUrl, { waitUntil: "networkidle" });

  const logoLinks = page.locator('a[aria-label="Ticketground"]');
  assert.equal(await logoLinks.count(), 2, "header and footer must share the same accessible logo link");
  const logoSources = await logoLinks.locator("img").evaluateAll((images) => images.map((image) => decodeURIComponent(image.getAttribute("src") || "")));
  assert.equal(logoSources.length, 4, "each shared logo renders light and dark theme sources");
  assert.equal(logoSources.filter((source) => source.includes("/images/brand/ticketground-logo.png")).length, 2);
  assert.equal(logoSources.filter((source) => source.includes("/images/brand/ticketground-logo-dark.png")).length, 2);
  assert.equal(await page.getByRole("img", { name: "Ticketground", exact: true }).count(), 2, "theme switching must keep one stable accessible brand name per logo");

  const iconHrefs = await page.locator('link[rel="icon"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  assert.ok(iconHrefs.some((href) => href?.includes("/seo/favicon-16x16.png")));
  assert.ok(iconHrefs.some((href) => href?.includes("/seo/favicon-32x32.png")));
  assert.ok(iconHrefs.some((href) => href?.includes("/seo/favicon-96x96.png")));
  assert.equal(await page.locator('link[rel="apple-touch-icon"]').getAttribute("href"), "/seo/tig-icon-180x180.png");
});

test("dark mode keeps the shared brand name and selects the bright wordmark", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  t.after(() => page.close());

  await page.addInitScript(() => localStorage.setItem("ticketground:theme", "dark"));
  await page.goto(baseUrl, { waitUntil: "networkidle" });

  assert.equal(await page.getByRole("img", { name: "Ticketground", exact: true }).count(), 2);
  const darkSources = await page.locator("img").evaluateAll((images) => images
    .filter((image) => decodeURIComponent(image.getAttribute("src") || "").includes("ticketground-logo-dark"))
    .map((image) => getComputedStyle(image).display));
  assert.equal(darkSources.filter((display) => display !== "none").length, 2);
});

test("gate manifest points only at TIG favicon sizes", async (t) => {
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  t.after(() => page.close());

  const response = await page.request.get(`${baseUrl}/gate-manifest.webmanifest`);
  assert.equal(response.status(), 200);
  const manifest = await response.json();
  assert.deepEqual(manifest.icons.map((icon) => icon.src), ["/seo/tig-icon-192x192.png", "/seo/tig-icon-512x512.png"]);
});
