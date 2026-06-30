import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("home exposes an official resale section and keeps mobile text compact", () => {
  const homeSections = read("src/components/home/home-sections.tsx");

  assert.match(homeSections, /data-section="official-resale"/);
  assert.match(homeSections, /href="\/resale"/);
  assert.match(homeSections, /콘서트·뮤지컬·연극·클래식을 비교하세요\./);
  assert.doesNotMatch(homeSections, /콘서트, 뮤지컬, 연극·클래식을 같은 밀도로 비교하세요\./);
});

test("ticket-open cards use compact mobile spacing", () => {
  const homeSections = read("src/components/home/home-sections.tsx");
  const openCalendar = read("src/components/discovery/open-calendar.tsx");

  assert.match(homeSections, /data-card="ticket-open"[\s\S]+p-\[10px\][\s\S]+sm:p-5/);
  assert.match(homeSections, /text-\[32px\][\s\S]+sm:text-\[50px\]/);
  assert.match(openCalendar, /grid-cols-\[48px_minmax\(0,1fr\)_auto\]/);
  assert.match(openCalendar, /p-2[\s\S]+sm:p-3/);
});

test("mypage exposes only the unified transfer action on ticket cards", () => {
  const mypage = read("src/app/mypage/page.tsx");

  assert.doesNotMatch(mypage, /\["공식 재판매", "\/resale"\]/);
  assert.doesNotMatch(mypage, /href=\{`\/resale\?reservation=\$\{reservation\.id\}`\}/);
  assert.doesNotMatch(mypage, />\s*재판매\s*</);
  assert.match(mypage, /href=\{`\/transfer\?reservation=\$\{reservation\.id\}`\}[\s\S]+>\s*양도\s*</);
});

test("queue waiting room progresses with item-level state and gives a ready action", () => {
  const queue = read("src/components/ticketing/queue-waiting-room.tsx");

  assert.doesNotMatch(queue, /window\.location|location\.reload|router\.refresh/);
  assert.doesNotMatch(queue, /\[isReady, latestDecrease\]/);
  assert.match(queue, /data-queue-continue/);
});
