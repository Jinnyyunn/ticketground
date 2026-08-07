import test from "node:test";
import assert from "node:assert/strict";
import { formatMonthDay } from "../src/i18n/format.ts";

test("formats a month/day pair using each locale's own wording, not a fixed template", () => {
  assert.equal(formatMonthDay("ko", "07", "01"), "7월 1일");
  assert.equal(formatMonthDay("en", "07", "01"), "July 1");
  assert.equal(formatMonthDay("ja", "07", "01"), "7月1日");
  assert.equal(formatMonthDay("zh-CN", "07", "01"), "7月1日");
});

test("does not leak the fixed reference year used internally", () => {
  for (const locale of ["ko", "en", "ja", "zh-CN"]) {
    assert.doesNotMatch(formatMonthDay(locale, "12", "25"), /2000/);
  }
});

test("is stable for single- and double-digit days", () => {
  assert.equal(formatMonthDay("en", "01", "05"), "January 5");
  assert.equal(formatMonthDay("en", "01", "25"), "January 25");
});
