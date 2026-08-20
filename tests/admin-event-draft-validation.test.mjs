import test from "node:test";
import assert from "node:assert/strict";
import {
  digitsOnly,
  emptyPriceRow,
  emptyScheduleRow,
  formatWon,
  priceRowsToPayload,
  scheduleRowsToPayload,
  validatePriceRows,
  validateScheduleRows,
  validateZoneValues,
} from "../src/components/admin/event-draft.ts";

function priceRow(overrides) {
  return { ...emptyPriceRow(), grade: "VIP", seat: "VIP석", price: "154000", seatCount: "12", ...overrides };
}

function scheduleRow(overrides) {
  return { ...emptyScheduleRow(), label: "1회차", date: "2026-12-24", times: ["19:30"], ...overrides };
}

function messages(issues) {
  return issues.map((issue) => issue.message).join("\n");
}

test("a price typed with thousands separators keeps its full value instead of shifting columns", () => {
  // The old textarea split "VIP,VIP석,154,000" on commas and read 154 as the
  // price and "000" as the seat count.
  assert.equal(digitsOnly("154,000"), "154000");
  assert.equal(formatWon("154000"), "154,000");
  const [payload] = priceRowsToPayload([priceRow({ price: digitsOnly("154,000") })]);
  assert.equal(payload.price, 154000);
  assert.equal(payload.seatCount, 12);
});

test("a price two orders of magnitude below its peers is flagged before submit", () => {
  const issues = validatePriceRows([
    priceRow({ grade: "VIP", price: "154" }),
    priceRow({ grade: "R", price: "121000" }),
    priceRow({ grade: "S", price: "99000" }),
  ]);
  const warnings = issues.filter((issue) => issue.level === "warning");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /비정상적으로 낮습니다/);
  assert.equal(issues.filter((issue) => issue.level === "error").length, 0, messages(issues));
});

test("a consistent price table produces no issues", () => {
  const issues = validatePriceRows([
    priceRow({ grade: "VIP", price: "154000" }),
    priceRow({ grade: "R", price: "121000" }),
    priceRow({ grade: "S", price: "99000" }),
  ]);
  assert.deepEqual(issues, [], messages(issues));
});

test("a Korean-only grade name is rejected up front, matching the server's slug rule", () => {
  const issues = validatePriceRows([priceRow({ grade: "브이아이피", seat: "브이아이피석" })]);
  assert.equal(issues.filter((issue) => issue.level === "error").length, 1);
  assert.match(issues[0].message, /영문 또는 숫자/);
});

test("blank and out-of-range price or seat count are errors, not silent defaults", () => {
  const blank = validatePriceRows([priceRow({ price: "" })]);
  assert.match(messages(blank), /가격을 입력해주세요/);

  const tooManySeats = validatePriceRows([priceRow({ seatCount: "5000" })]);
  assert.match(messages(tooManySeats), /1~2000 사이/);

  const zeroSeats = validatePriceRows([priceRow({ seatCount: "0" })]);
  assert.match(messages(zeroSeats), /1~2000 사이/);
});

test("a duplicate date and time across rows is reported instead of being dropped on save", () => {
  // normalizeSchedules() in backend/admin-event-content.js skips a repeated
  // date+time and can discard the whole row without any feedback.
  const issues = validateScheduleRows([
    scheduleRow({ label: "1회차", date: "2026-12-24", times: ["19:30"] }),
    scheduleRow({ label: "2회차", date: "2026-12-24", times: ["19:30"] }),
  ]);
  const errors = issues.filter((issue) => issue.level === "error");
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /중복/);
});

test("distinct times on the same date are accepted", () => {
  const issues = validateScheduleRows([
    scheduleRow({ label: "1회차", date: "2026-12-24", times: ["15:00", "19:30"] }),
    scheduleRow({ label: "2회차", date: "2026-12-25", times: ["19:30"] }),
  ]);
  assert.deepEqual(issues, [], messages(issues));
});

test("an impossible calendar date is rejected", () => {
  const issues = validateScheduleRows([scheduleRow({ date: "2026-02-30" })]);
  assert.match(messages(issues), /날짜를 확인해주세요/);
});

test("a schedule with no time is an error rather than an empty round", () => {
  const issues = validateScheduleRows([scheduleRow({ times: [""] })]);
  assert.match(messages(issues), /공연 시간을 하나 이상/);
});

test("schedule rows convert to the payload shape the API expects", () => {
  const payload = scheduleRowsToPayload([scheduleRow({ times: ["19:30", "", "15:00"] })]);
  assert.deepEqual(payload, [{ label: "1회차", date: "2026-12-24", times: ["19:30", "15:00"] }]);
});

test("zone validation skips grade-slug rules but still catches a dropped zero", () => {
  const zones = [
    { id: "zone_vip", name: "VIP석", price: "154", seatCount: "12" },
    { id: "zone_r", name: "R석", price: "121000", seatCount: "12" },
    { id: "zone_s", name: "S석", price: "99000", seatCount: "12" },
  ];
  const issues = validateZoneValues(zones);
  assert.equal(issues.filter((issue) => issue.level === "error").length, 0, messages(issues));
  assert.match(messages(issues), /VIP석 가격 154원/);
});

test("an existing Korean-named zone stays valid when its numbers are sound", () => {
  const issues = validateZoneValues([
    { id: "zone_a", name: "일반석", price: "99000", seatCount: "50" },
    { id: "zone_b", name: "지정석", price: "121000", seatCount: "30" },
  ]);
  assert.deepEqual(issues, [], messages(issues));
});

test("an empty zone price is an error so one blank field cannot fail the whole form silently", () => {
  const issues = validateZoneValues([{ id: "zone_a", name: "VIP석", price: "", seatCount: "12" }]);
  assert.match(messages(issues), /VIP석 가격을 입력해주세요/);
});
