import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries/ko";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  ko: () => import("./dictionaries/ko.ts").then((mod) => mod.dictionary),
  en: () => import("./dictionaries/en.ts").then((mod) => mod.dictionary),
  ja: () => import("./dictionaries/ja.ts").then((mod) => mod.dictionary),
  "zh-CN": () => import("./dictionaries/zh-CN.ts").then((mod) => mod.dictionary),
};

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}

export type { Dictionary };
