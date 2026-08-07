import type { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n/config";
import { localeHomeHref } from "@/i18n/routing";
import { siteUrl } from "@/i18n/site-url";

// Only routes with a translated dictionary belong here (나라별 언어 적용
// 계획서.md 5장: "사이트맵에는 실제 번역이 완료되어 공개된 URL만 넣는다").
// Phase 1 ships exactly one such route - the homepage, in all 4 locales -
// so this intentionally does not attempt to enumerate the rest of the
// (still Korean-only) site.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const languages = Object.fromEntries(locales.map((locale) => [locale, new URL(localeHomeHref(locale), base).toString()]));

  return locales.map((locale) => ({
    url: new URL(localeHomeHref(locale), base).toString(),
    alternates: { languages },
    priority: locale === defaultLocale ? 1 : 0.8,
  }));
}
