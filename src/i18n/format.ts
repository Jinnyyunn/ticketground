import type { Locale } from "./config";

// BCP-47 tags for Intl formatters. English intentionally has no region
// (나라별 언어 적용 계획서.md 2장: "특정 국가에 한정하지 않는 영어") so it
// doesn't imply US-only date/number conventions.
const intlTag: Record<Locale, string> = {
  ko: "ko",
  en: "en",
  ja: "ja",
  "zh-CN": "zh-CN",
};

// Formats a zero-padded month/day pair (as already stored in ticketOpens
// data) into the target locale's date wording, e.g. "7월 1일" (ko),
// "July 1" (en), "7月1日" (ja/zh-CN). Uses a fixed leap year and UTC so
// the real year and local timezone never leak into the formatted output.
export function formatMonthDay(locale: Locale, month: string, day: string): string {
  const date = new Date(Date.UTC(2000, Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat(intlTag[locale], { month: "long", day: "numeric", timeZone: "UTC" }).format(date);
}
