import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { bootstrapAdminPassword, startServer } from "./backend-test-utils.mjs";

async function adminCookie(adminUrl) {
  const response = await fetch(`${adminUrl}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: bootstrapAdminPassword }),
  });
  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie);
  const [pair] = setCookie.split(";");
  const separator = pair.indexOf("=");
  const payload = await response.json();
  return { cookie: { name: pair.slice(0, separator), value: pair.slice(separator + 1) }, cookieHeader: pair, csrf: payload.data.csrf };
}

test("publishing a chart applies it to the selected venue", async (t) => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "ticketground-venue-publish-"));
  t.after(() => rm(dataRoot, { recursive: true, force: true }));
  const server = await startServer(t, { env: { TIG_SEAT_CHART_DATA_DIR: path.join(dataRoot, "charts"), TIG_SEAT_CHART_CREDENTIAL_DIR: path.join(dataRoot, "credentials") } });
  const auth = await adminCookie(server.adminUrl);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([{ ...auth.cookie, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  page.setDefaultTimeout(8_000);

  await page.goto(`${server.adminUrl}/admin/seat-designer`, { waitUntil: "networkidle" });
  const catalog = await page.evaluate(async () => fetch("/api/catalog").then((response) => response.json()));
  const venues = await page.evaluate(async () => fetch("/api/admin/venues").then((response) => response.json()));
  const event = catalog.data.events.find((item) =>
    item.slug && venues.data.venues.some((venue) => venue.id === item.venueId));
  assert.ok(event);
  const venue = venues.data.venues.find((item) => item.id === event.venueId);
  assert.ok(venue);
  const initialDialog = page.getByRole("dialog", { name: "새 좌석 차트 만들기" });
  await initialDialog.locator("select").selectOption(venue.id);
  await initialDialog.getByRole("button", { name: "빈 캔버스" }).click();
  await initialDialog.waitFor({ state: "hidden" });
  const canvas = page.getByTestId("designer-canvas");
  const canvasBox = await canvas.boundingBox();
  assert.ok(canvasBox);
  await page.getByTestId("tool-focal").click();
  await page.mouse.click(canvasBox.x + 500, canvasBox.y + 120);
  await page.getByTestId("tool-row").click();
  await page.locator('[role="menuitem"][data-mode="row"]').click();
  await page.mouse.move(canvasBox.x + 380, canvasBox.y + 260);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 620, canvasBox.y + 260);
  await page.mouse.up();
  await page.locator('[data-object-type="row"]').waitFor();
  await page.getByTestId("tool-image").click();
  const imageChooser = page.waitForEvent("filechooser");
  await page.mouse.click(canvasBox.x + 700, canvasBox.y + 380);
  await (await imageChooser).setFiles({ name: "Jinny-private-plan.png", mimeType: "image/png", buffer: await readFile(path.resolve("public/images/header/partner-nol.png")) });
  await page.locator('[data-object-type="image"]').waitFor();

  const beforePublish = await fetch(`${server.baseUrl}/api/seat-charts/for-show/${encodeURIComponent(event.slug)}`);
  assert.equal(beforePublish.status, 200);
  assert.deepEqual(await beforePublish.json(), { ok: true, source: "not_ready", message: "공연장 좌석 배치도 준비 중", record: null, inventory: null });

  const buyerPage = await context.newPage();
  await buyerPage.goto(`${server.baseUrl}/booking/${encodeURIComponent(event.slug)}`, { waitUntil: "networkidle" });
  const seatEntry = buyerPage.getByRole("button", { name: "좌석 선택으로 이동", exact: true });
  await seatEntry.waitFor();
  assert.equal(await seatEntry.isDisabled(), true, "unpublished venue chart must fail closed in booking");
  await buyerPage.close();

  await page.getByRole("button", { name: "설정", exact: true }).click();
  const modal = page.locator("div.fixed.inset-0.z-50");
  await modal.getByText("공연장", { exact: true }).waitFor();
  assert.doesNotMatch(await modal.innerText(), /예매 적용 공연|연결된 공연/);
  const venueButton = modal.getByRole("button", { name: venue.name, exact: true });
  if (await venueButton.getAttribute("aria-pressed") !== "true") await venueButton.click();
  await modal.locator("button").first().click();

  const publishButton = page.getByRole("button", { name: "게시", exact: true });
  assert.equal(await publishButton.isEnabled(), true);
  const publishResponsePromise = page.waitForResponse((response) => response.request().method() === "POST" && /\/api\/seat-charts\/[^/]+\/publish$/.test(new URL(response.url()).pathname));
  await publishButton.click();
  const publishResponse = await publishResponsePromise;
  assert.equal(publishResponse.status(), 200, `${publishResponse.url()} ${await publishResponse.text()}`);
  await page.getByRole("button", { name: "게시됨", exact: true }).waitFor();

  const response = await fetch(`${server.baseUrl}/api/seat-charts/for-show/${encodeURIComponent(event.slug)}`);
  assert.equal(response.status, 200);
  const published = await response.json();
  assert.equal(published.source, "published");
  assert.deepEqual(published.record.boundVenue, { id: venue.id, name: venue.name });
  assert.ok(published.chart.assets.length > 0);
  assert.equal(published.chart.assets.some((asset) => "originalName" in asset), false, "buyer chart must not expose admin file names");
  assert.equal(published.chart.objects.some((object) => object.label.includes("Jinny-private-plan")), false, "buyer objects must not expose local file names");

  const credentialResponse = await fetch(`${server.adminUrl}/api/seat-charts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: auth.cookieHeader, "x-tig-csrf": auth.csrf },
    body: JSON.stringify({ operation: "issue-service-credential", label: "venue sync", scopes: ["seat-chart:read"], expiresAt: "2026-12-31T00:00:00.000Z" }),
  });
  const credentialBody = await credentialResponse.text();
  assert.equal(credentialResponse.status, 201, credentialBody);
  const { credential } = JSON.parse(credentialBody);
  const venueChart = await fetch(`${server.baseUrl}/api/venues/${encodeURIComponent(venue.id)}/seat-chart`, { headers: { Authorization: `Bearer ${credential}` } });
  const venueChartBody = await venueChart.text();
  assert.equal(venueChart.status, 200, venueChartBody);
  const etag = venueChart.headers.get("etag");
  assert.ok(etag);
  const publicRevision = JSON.parse(venueChartBody);
  assert.equal(publicRevision.venueId, venue.id);
  assert.equal("publishedBy" in publicRevision, false);
  const unchanged = await fetch(`${server.baseUrl}/api/venues/${encodeURIComponent(venue.id)}/seat-chart`, { headers: { Authorization: `Bearer ${credential}`, "If-None-Match": etag } });
  assert.equal(unchanged.status, 304);
});
