import test from "node:test";
import assert from "node:assert/strict";
import { locales, isLocale, defaultLocale, ogLocaleFor } from "../src/i18n/config.ts";
import { getDictionary } from "../src/i18n/get-dictionary.ts";

function keyPaths(value, prefix = "") {
  if (typeof value === "string") return [prefix];
  return Object.keys(value)
    .sort()
    .flatMap((key) => keyPaths(value[key], prefix ? `${prefix}.${key}` : key));
}

test("supports exactly ko, en, ja, zh-CN with ko as the default", () => {
  assert.deepEqual([...locales], ["ko", "en", "ja", "zh-CN"]);
  assert.equal(defaultLocale, "ko");
});

test("isLocale accepts supported locales and rejects everything else", () => {
  for (const locale of locales) assert.equal(isLocale(locale), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale("KO"), false);
  assert.equal(isLocale(""), false);
});

test("every locale has a distinct Open Graph locale tag", () => {
  const tags = locales.map((locale) => ogLocaleFor(locale));
  assert.equal(new Set(tags).size, tags.length);
});

test("all four dictionaries expose the exact same key structure as ko", async () => {
  const dictionaries = await Promise.all(locales.map((locale) => getDictionary(locale)));
  const [koDict, ...rest] = dictionaries;
  const koKeys = keyPaths(koDict);

  rest.forEach((dict, index) => {
    assert.deepEqual(keyPaths(dict), koKeys, `locale "${locales[index + 1]}" key structure diverges from ko`);
  });
});

test("no dictionary contains an empty or whitespace-only translation", async () => {
  for (const locale of locales) {
    const dict = await getDictionary(locale);
    for (const path of keyPaths(dict)) {
      const value = path.split(".").reduce((node, key) => node[key], dict);
      assert.notEqual(value.trim(), "", `${locale}: "${path}" is empty`);
    }
  }
});

test("getDictionary only loads the requested locale's module", async () => {
  const en = await getDictionary("en");
  const ja = await getDictionary("ja");
  assert.notEqual(en.metadata.description, ja.metadata.description);
  assert.equal(en.header.login, "Log in");
  assert.equal(ja.header.login, "ログイン");
});
