import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, locales, LOCALE_HEADER } from "@/i18n/config";

const prefixedLocales = locales.filter((locale) => locale !== defaultLocale);

// Rewrites the exact locale-root paths (/en, /ja, /zh-CN) onto the
// existing "/" route and hands the validated locale to server components
// via a request header. Every other path - including untranslated
// /en/... subpaths, _next, API, and admin routes - falls through
// unchanged and keeps rendering the existing Korean experience, per
// 나라별 언어 적용 계획서.md 4.3.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);

  for (const locale of prefixedLocales) {
    if (pathname !== `/${locale}`) continue;

    requestHeaders.set(LOCALE_HEADER, locale);
    const url = request.nextUrl.clone();
    url.pathname = "/";
    // This project's custom server (server.js) runs a single Next app
    // instance configured with the admin port as its canonical origin,
    // shared by both the public and admin HTTP servers. A bare
    // request.nextUrl.clone() therefore carries that canonical
    // (admin-port) origin instead of the port the request actually
    // arrived on, turning this rewrite into a cross-port redirect. Force
    // the host back to the real incoming Host header so the rewrite
    // stays same-origin regardless of which of the two servers is
    // handling this request.
    const incomingHost = request.headers.get("host");
    if (incomingHost) url.host = incomingHost;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  // Under this custom server, the rewrite above triggers a real second
  // pass through this function for the rewritten "/" request (proxy
  // matches its own rewrite target). Keep the locale that pass already
  // attached instead of clobbering it back to defaultLocale. A request
  // that reaches "/" directly and forges this header only ever changes
  // which already-public translation of the same static home content it
  // gets back - it is a content-selection signal, never an authorization
  // one - so trusting it here is an accepted, low-stakes tradeoff.
  if (!requestHeaders.has(LOCALE_HEADER)) requestHeaders.set(LOCALE_HEADER, defaultLocale);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next|api|seo|images|videos|favicon.ico).*)"],
};
