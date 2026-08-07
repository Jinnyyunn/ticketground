export const locales = ["ko", "en", "ja", "zh-CN"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ko";

// Locales that are served under a URL prefix (/en, /ja, /zh-CN). The
// default locale keeps the existing unprefixed Korean URLs.
export const prefixedLocales = locales.filter((locale) => locale !== defaultLocale) as readonly Exclude<Locale, "ko">[];

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

// Request header proxy.ts uses to hand the resolved locale to server
// components. Shared by src/proxy.ts (Edge/Node proxy runtime, no
// next/headers access) and src/i18n/request-locale.ts (RSC runtime).
export const LOCALE_HEADER = "x-tig-locale";

const localeOgTag: Record<Locale, string> = {
  ko: "ko_KR",
  en: "en_US",
  ja: "ja_JP",
  "zh-CN": "zh_CN",
};

export function ogLocaleFor(locale: Locale): string {
  return localeOgTag[locale];
}
