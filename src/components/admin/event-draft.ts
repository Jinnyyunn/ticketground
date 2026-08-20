// Prices and schedules used to be free-text blocks parsed by splitting on ","
// and "|". A price written the way Korean currency normally is — 154,000 —
// silently shifted into the seat-count column and registered a 154원 ticket.
// These row editors remove the delimiters from the admin's hands entirely.

export type PriceRow = { readonly id: string; readonly grade: string; readonly seat: string; readonly price: string; readonly seatCount: string };
export type ScheduleRow = { readonly id: string; readonly label: string; readonly date: string; readonly times: readonly string[] };
export type DraftIssue = { readonly level: "error" | "warning"; readonly message: string };

export const maxPriceRows = 20;
export const maxScheduleRows = 30;
export const maxTimesPerSchedule = 6;
export const maxPerformances = 60;
export const maxZoneSeatCount = 2000;
const maxFaceValue = 10000000;

let rowSequence = 0;
function nextRowId(prefix: string): string {
  rowSequence += 1;
  return `${prefix}-${rowSequence}`;
}

export function emptyPriceRow(): PriceRow {
  return { id: nextRowId("price"), grade: "", seat: "", price: "", seatCount: "12" };
}

export function emptyScheduleRow(): ScheduleRow {
  return { id: nextRowId("schedule"), label: "", date: "", times: [""] };
}

export function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

export function formatWon(value: string): string {
  const digits = digitsOnly(value);
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isTime(value: string): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  return Boolean(match) && Number(match![1]) <= 23 && Number(match![2]) <= 59;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function priceRowsToPayload(rows: readonly PriceRow[]): { grade: string; seat: string; price: number; seatCount: number }[] {
  return rows.map((row) => ({
    grade: row.grade.trim(),
    seat: row.seat.trim() || row.grade.trim(),
    price: Number(digitsOnly(row.price)),
    seatCount: Number(row.seatCount),
  }));
}

export function scheduleRowsToPayload(rows: readonly ScheduleRow[]): { label: string; date: string; times: string[] }[] {
  return rows.map((row) => ({
    label: row.label.trim(),
    date: row.date.trim(),
    times: row.times.map((time) => time.trim()).filter(Boolean),
  }));
}

export function validatePriceRows(rows: readonly PriceRow[]): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (!rows.length) {
    issues.push({ level: "error", message: "좌석 가격을 한 줄 이상 입력해주세요." });
    return issues;
  }
  if (rows.length > maxPriceRows) issues.push({ level: "error", message: `좌석 가격은 ${maxPriceRows}개 이하로 등록해주세요.` });

  const seenGrades = new Set<string>();
  const prices: number[] = [];
  rows.forEach((row, index) => {
    const position = `${index + 1}번째 좌석 등급`;
    const grade = row.grade.trim();
    if (!grade) {
      issues.push({ level: "error", message: `${position}의 등급명을 입력해주세요.` });
    } else {
      // The server turns the grade into a slug by stripping every character
      // outside [a-z0-9]; a Korean-only name slugs to "" and is rejected.
      if (!/[a-z0-9]/i.test(grade)) issues.push({ level: "error", message: `${position} "${grade}"에는 영문 또는 숫자가 포함되어야 합니다. 예: VIP` });
      const key = grade.toLowerCase();
      if (seenGrades.has(key)) issues.push({ level: "warning", message: `등급명 "${grade}"이 중복됩니다.` });
      seenGrades.add(key);
    }

    const price = Number(digitsOnly(row.price));
    if (!row.price.trim() || !price) {
      issues.push({ level: "error", message: `${position}의 가격을 입력해주세요.` });
    } else if (price > maxFaceValue) {
      issues.push({ level: "error", message: `${position}의 가격은 ${maxFaceValue.toLocaleString("ko-KR")}원 이하로 입력해주세요.` });
    } else {
      prices.push(price);
    }

    const seatCount = Number(row.seatCount);
    if (!row.seatCount.trim() || !Number.isInteger(seatCount) || seatCount < 1 || seatCount > maxZoneSeatCount) {
      issues.push({ level: "error", message: `${position}의 판매 좌석 수는 1~${maxZoneSeatCount} 사이로 입력해주세요.` });
    }
  });

  // A price two orders of magnitude below its peers is almost always a dropped
  // thousands group (154 typed where 154,000 was meant).
  if (prices.length > 1) {
    const middle = median(prices);
    rows.forEach((row, index) => {
      const price = Number(digitsOnly(row.price));
      if (!price || price > middle / 10) return;
      issues.push({
        level: "warning",
        message: `${index + 1}번째 등급 가격 ${price.toLocaleString("ko-KR")}원이 다른 등급 대비 비정상적으로 낮습니다. 0이 빠지지 않았는지 확인해주세요.`,
      });
    });
  }

  return issues;
}

export type ZoneValue = { readonly id: string; readonly name: string; readonly price: string; readonly seatCount: string };

// Sales editing works on zones that already exist, so this skips the grade-slug
// rules that only apply when a zone is first created.
export function validateZoneValues(zones: readonly ZoneValue[]): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const prices: number[] = [];
  for (const zone of zones) {
    const price = Number(digitsOnly(zone.price));
    if (!zone.price.trim() || !price) {
      issues.push({ level: "error", message: `${zone.name} 가격을 입력해주세요.` });
    } else if (price > maxFaceValue) {
      issues.push({ level: "error", message: `${zone.name} 가격은 ${maxFaceValue.toLocaleString("ko-KR")}원 이하로 입력해주세요.` });
    } else {
      prices.push(price);
    }

    const seatCount = Number(zone.seatCount);
    if (!zone.seatCount.trim() || !Number.isInteger(seatCount) || seatCount < 1 || seatCount > maxZoneSeatCount) {
      issues.push({ level: "error", message: `${zone.name} 판매 좌석 수는 1~${maxZoneSeatCount} 사이로 입력해주세요.` });
    }
  }

  if (prices.length > 1) {
    const middle = median(prices);
    for (const zone of zones) {
      const price = Number(digitsOnly(zone.price));
      if (!price || price > middle / 10) continue;
      issues.push({ level: "warning", message: `${zone.name} 가격 ${price.toLocaleString("ko-KR")}원이 다른 구역 대비 비정상적으로 낮습니다. 0이 빠지지 않았는지 확인해주세요.` });
    }
  }

  return issues;
}

export function validateScheduleRows(rows: readonly ScheduleRow[]): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (!rows.length) {
    issues.push({ level: "error", message: "공연 일정을 하나 이상 입력해주세요." });
    return issues;
  }
  if (rows.length > maxScheduleRows) issues.push({ level: "error", message: `공연 일정은 ${maxScheduleRows}개 이하로 등록해주세요.` });

  const seenDateTimes = new Map<string, number>();
  let performanceCount = 0;
  rows.forEach((row, index) => {
    const position = `${index + 1}번째 회차`;
    if (!row.label.trim()) issues.push({ level: "error", message: `${position}의 회차명을 입력해주세요.` });
    if (!row.date.trim()) {
      issues.push({ level: "error", message: `${position}의 날짜를 선택해주세요.` });
    } else if (!isCalendarDate(row.date.trim())) {
      issues.push({ level: "error", message: `${position}의 날짜를 확인해주세요.` });
    }

    const times = row.times.map((time) => time.trim()).filter(Boolean);
    if (!times.length) {
      issues.push({ level: "error", message: `${position}의 공연 시간을 하나 이상 입력해주세요.` });
    }
    if (times.length > maxTimesPerSchedule) {
      issues.push({ level: "error", message: `${position}의 공연 시간은 ${maxTimesPerSchedule}개 이하로 등록해주세요.` });
    }
    performanceCount += times.length;

    for (const time of times) {
      if (!isTime(time)) {
        issues.push({ level: "error", message: `${position}의 공연 시간 "${time}"을 확인해주세요.` });
        continue;
      }
      // The server drops a duplicate date+time without telling anyone, so the
      // whole row can vanish from the saved event. Catch it before submit.
      const key = `${row.date.trim()}T${time}`;
      const firstIndex = seenDateTimes.get(key);
      if (firstIndex === undefined) {
        seenDateTimes.set(key, index);
      } else {
        issues.push({
          level: "error",
          message: `${position}의 ${row.date.trim()} ${time}이 ${firstIndex + 1}번째 회차와 중복됩니다. 중복된 시간은 저장되지 않습니다.`,
        });
      }
    }
  });

  if (performanceCount > maxPerformances) {
    issues.push({ level: "error", message: `공연 회차는 ${maxPerformances}개 이하로 등록해주세요.` });
  }

  return issues;
}
