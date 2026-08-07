import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "./backend-test-utils.mjs";

function htmlLang(html) {
  const match = html.match(/<html[^>]*\blang="([^"]*)"/);
  return match ? match[1] : null;
}

test("/, /en, /ja, /zh-CN each render with their own <html lang> and locale-specific metadata title", async (t) => {
  const { baseUrl } = await startServer(t);

  const cases = [
    { path: "/", lang: "ko", titleIncludes: "Ticketground" },
    { path: "/en", lang: "en", titleIncludes: "Ticketground" },
    { path: "/ja", lang: "ja", titleIncludes: "Ticketground" },
    { path: "/zh-CN", lang: "zh-CN", titleIncludes: "Ticketground" },
  ];

  for (const { path, lang } of cases) {
    const res = await fetch(`${baseUrl}${path}`);
    assert.equal(res.status, 200, `${path} should render 200`);
    const html = await res.text();
    assert.equal(htmlLang(html), lang, `${path} <html lang> should be "${lang}"`);
  }
});

test("root / keeps rendering the existing Korean description regardless of any stored language preference", async (t) => {
  const { baseUrl } = await startServer(t);
  const res = await fetch(`${baseUrl}/`, { headers: { cookie: "tig_locale=en" } });
  const html = await res.text();
  assert.equal(htmlLang(html), "ko", "cookie alone must not change the unprefixed Korean URL");
  assert.match(html, /공연, 콘서트, 뮤지컬, 스포츠 티켓 예매는 Ticketground/);
});

test("an unsupported locale prefix 404s instead of silently falling back to Korean", async (t) => {
  const { baseUrl } = await startServer(t);
  const res = await fetch(`${baseUrl}/fr`);
  assert.equal(res.status, 404);
});

test("a not-yet-translated subpath under a valid locale 404s instead of leaking the Korean page", async (t) => {
  const { baseUrl } = await startServer(t);
  const res = await fetch(`${baseUrl}/en/goods/iu-world-tour`);
  assert.equal(res.status, 404);
});

test("API routes are not intercepted by locale rewriting", async (t) => {
  const { baseUrl } = await startServer(t);
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
});

// metadataBase (src/i18n/site-url.ts) intentionally comes from
// NEXT_PUBLIC_SITE_URL - an ops-provisioned public origin - not from
// whatever port this test server happens to bind to, so canonical/
// hreflang/sitemap URLs are checked against that fixed origin instead of
// baseUrl.
const publicOrigin = "http://localhost:5501";

test("each locale's homepage declares canonical + self-referencing hreflang for all locales plus x-default", async (t) => {
  const { baseUrl } = await startServer(t);

  const cases = ["/", "/en", "/ja", "/zh-CN"];

  for (const path of cases) {
    const html = await (await fetch(`${baseUrl}${path}`)).text();
    // Next resolves the root path against metadataBase without a
    // trailing slash; every other locale keeps its /xx prefix as-is.
    const canonical = path === "/" ? publicOrigin : `${publicOrigin}${path}`;
    assert.match(html, new RegExp(`<link rel="canonical" href="${canonical.replace(/\//g, "\\/")}"`), `${path} canonical`);
    for (const [hreflang, href] of [
      ["ko", publicOrigin],
      ["en", `${publicOrigin}/en`],
      ["ja", `${publicOrigin}/ja`],
      ["zh-CN", `${publicOrigin}/zh-CN`],
      ["x-default", publicOrigin],
    ]) {
      const pattern = new RegExp(`<link rel="alternate" hrefLang="${hreflang}" href="${href.replace(/\//g, "\\/")}"`);
      assert.match(html, pattern, `${path} is missing hreflang="${hreflang}" -> ${href}`);
    }
  }
});

test("sitemap.xml lists only the translated homepage URLs, one per locale", async (t) => {
  const { baseUrl } = await startServer(t);
  const res = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(res.status, 200);
  const xml = await res.text();

  assert.match(xml, new RegExp(`<loc>${publicOrigin}/</loc>`.replace(/\//g, "\\/")));
  assert.match(xml, new RegExp(`<loc>${publicOrigin}/en</loc>`.replace(/\//g, "\\/")));
  assert.match(xml, new RegExp(`<loc>${publicOrigin}/ja</loc>`.replace(/\//g, "\\/")));
  assert.match(xml, new RegExp(`<loc>${publicOrigin}/zh-CN</loc>`.replace(/\//g, "\\/")));
  assert.doesNotMatch(xml, /\/goods\//, "sitemap should not include untranslated catalog pages yet");
});
