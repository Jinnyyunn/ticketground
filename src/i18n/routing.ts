import { defaultLocale, locales, type Locale } from "./config";

// Routes that currently have a translated dictionary, expressed as their
// bare (locale-stripped) form. Only the public homepage ships in phase 1
// (나라별 언어 적용 계획서.md, 3장). Extend this allowlist as more routes
// gain dictionaries instead of rewriting every /en|/ja|/zh-CN/... path
// onto its (untranslated) Korean page.
const localizedPathnames = new Set<string>(["/"]);

// The browser's own pathname (from usePathname()) is the pre-rewrite URL
// - "/en", "/ja", "/zh-CN", or the bare Korean path - never the internal
// "/" every locale is actually rewritten to server-side. Strip a locale
// prefix first so callers reason about one canonical path regardless of
// which locale's URL the visitor is currently on.
export function stripLocalePrefix(pathname: string): string {
  for (const locale of locales) {
    if (locale === defaultLocale) continue;
    const prefix = `/${locale}`;
    if (pathname === prefix) return "/";
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  }
  return pathname;
}

export function isLocalizedPathname(pathname: string): boolean {
  return localizedPathnames.has(stripLocalePrefix(pathname));
}

export function localeHomeHref(locale: Locale): string {
  return locale === defaultLocale ? "/" : `/${locale}`;
}

// Builds the locale-prefixed equivalent of the current path, preserving
// query string and hash. Paths without a translated dictionary yet keep
// pointing at the existing Korean page rather than a rewritten one, per
// the plan's "번역되지 않은 페이지에... 한국어 본문을 노출하지 않는다" rule.
export function localizeHref(locale: Locale, pathname: string, search = "", hash = ""): string {
  const bare = stripLocalePrefix(pathname);
  const base = localizedPathnames.has(bare) ? localeHomeHref(locale) : bare;
  return `${base}${search}${hash}`;
}
