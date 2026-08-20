import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { api, startServer } from "./backend-test-utils.mjs";
import { configureGoogleEnv, GOOGLE_AUTH_TEST_CREDENTIAL } from "./google-auth-test-helpers.mjs";

test("watchlist board renders the signed-in user's saved events with matching posters", async (t) => {
  configureGoogleEnv(t, true);
  const { baseUrl } = await startServer(t);

  const login = await api(baseUrl, "/api/auth/google/native", { credential: GOOGLE_AUTH_TEST_CREDENTIAL });
  const credential = login.data.session.credential;
  const userId = login.data.user.id;
  const authorization = `Bearer ${credential}`;

  const state = await api(baseUrl, "/api/state");
  const events = state.data.events.slice(0, 3);
  assert.ok(events.length >= 2, "fixtures must expose at least two events for this test");

  for (const event of events) {
    const response = await fetch(`${baseUrl}/api/me/watchlist/${encodeURIComponent(event.id)}`, {
      method: "PUT",
      headers: { Authorization: authorization, "Content-Type": "application/json", "Idempotency-Key": `watchlist-posters-${event.id}` },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 200);
  }

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(([storedUserId, storedCredential]) => {
    window.localStorage.setItem("ticketground:session-user-id", storedUserId);
    window.localStorage.setItem("ticketground:session-credential", storedCredential);
  }, [userId, credential]);
  const page = await context.newPage();
  try {
    // Given the watchlist page renders the signed-in user's saved events.
    await page.goto(`${baseUrl}/watchlist`, { waitUntil: "networkidle" });

    for (const event of events) {
      const card = page.locator("article").filter({ hasText: event.title }).first();
      await card.waitFor({ timeout: 5000 });

      // When each poster thumbnail is rendered inside the 관심공연 card.
      const image = card.locator(`img[alt="${event.title} 포스터"]`);
      await image.waitFor({ timeout: 5000 });
      const imagePath = new URL((await image.getAttribute("src")) ?? "", baseUrl).pathname;
      assert.equal(imagePath, new URL(event.image, baseUrl).pathname);

      // Then the thumbnail fills the card without side gutters.
      const renderedImage = await image.evaluate((element) => {
        const style = window.getComputedStyle(element);
        return {
          className: element.className,
          objectFit: style.objectFit,
        };
      });
      assert.equal(renderedImage.objectFit, "cover", `${event.title} watchlist poster should use object-fit: cover`);
      assert.equal(renderedImage.className.includes("object-contain"), false, `${event.title} watchlist poster should not use object-contain`);

      const imageLink = card.getByRole("link", { name: `${event.title} 상세보기`, exact: true }).first();
      assert.equal(await imageLink.getAttribute("href"), `/goods/${event.slug}`);
    }
  } finally {
    await context.close();
  }
});

test("watchlist board prompts signed-out visitors to log in instead of showing saved events", async (t) => {
  configureGoogleEnv(t, true);
  const { baseUrl } = await startServer(t);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  t.after(() => browser.close());

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(`${baseUrl}/watchlist`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "로그인이 필요합니다" }).waitFor({ timeout: 5000 });
    const loginLink = page.getByRole("link", { name: "로그인하러 가기" });
    assert.equal(await loginLink.getAttribute("href"), "/login");
  } finally {
    await page.close();
  }
});
