import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const requiredHomeSections = [
  "실시간 예매 랭킹 TOP10",
  "티켓오픈 예정",
  "CLEAN 티켓 공식 양도",
  "장르별 추천",
  "기획전",
  "바로가기",
];

function assertOrder(source, tokens, label) {
  let previous = -1;
  for (const token of tokens) {
    const index = source.indexOf(token);
    assert.ok(index > previous, `${token} must follow the previous ${label} section`);
    previous = index;
  }
}

test("web and both native homes preserve the required customer section order", async () => {
  const [webPage, webCopy, iosHome, iosSections, iosParity, androidScreens, androidParity] = await Promise.all([
    read("src/app/page.tsx"),
    read("src/i18n/dictionaries/ko.ts"),
    read("ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryHomeView.swift"),
    read("ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoverySectionViews.swift"),
    read("ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryParitySectionViews.swift").catch(() => ""),
    read("android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerScreens.kt"),
    read("android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerHomeParitySections.kt").catch(() => ""),
  ]);
  const webComponents = [
    "RealtimeTop10Section",
    "TicketOpenSection",
    "OfficialResaleSection",
    "GenreRecommendationsSection",
    "EditorialEventsSection",
    "ShortcutsSection",
  ];
  assertOrder(webPage, webComponents.map((component) => `<${component}`), "web");
  requiredHomeSections.forEach((heading) => assert.match(webCopy, new RegExp(heading)));
  assertOrder(iosHome, [
    "DiscoveryRankingSection", "DiscoveryOpeningSection", "DiscoveryResaleSection",
    "DiscoveryGenreRecommendationsSection", "DiscoveryEditorialSection", "DiscoveryShortcutsSection",
  ], "iOS");
  assertOrder(androidScreens, [
    "RankingSection", "HomeOpeningSection", "HomeResaleSection",
    "HomeGenreSection", "HomeEditorialSection", "ShortcutSection",
  ], "Android");
  requiredHomeSections.forEach((heading) => {
    assert.match(`${iosHome}\n${iosSections}\n${iosParity}`, new RegExp(heading));
    assert.match(`${androidScreens}\n${androidParity}`, new RegExp(heading));
  });
});

test("native parity does not substitute a WebView", async () => {
  const nativeSources = await Promise.all([
    read("ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryHomeView.swift"),
    read("ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryParitySectionViews.swift").catch(() => ""),
    read("android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerScreens.kt"),
    read("android/TicketGroundApp/app/src/main/java/kr/ticketground/app/ui/CustomerHomeParitySections.kt").catch(() => ""),
  ]);
  nativeSources.forEach((source) => {
    assert.doesNotMatch(source, /WKWebView|AndroidView\s*\(.*WebView|android\.webkit\.WebView/s);
  });
});

test("the parity matrix locks region venue and artist discovery contracts", async () => {
  const matrix = await read("docs/research/MOBILE_CUSTOMER_PARITY_MATRIX.md");
  const rows = matrix
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
  const expectedRows = [
    ["Region discovery", "Region control / `/contents/region`", "`discovery-region-*` / `.region`", "`home-region-*` / `CustomerRoute.Collection`", "public catalog and region APIs", "ready,empty,error", "route, filter, and state tests", "phone/tablet region selection"],
    ["Venue discovery", "Venue control / `/place/:slug`", "`discovery-venue-*` / `.place`", "`home-venue-*` / `CustomerRoute.Venue`", "public catalog and venue APIs", "ready,empty,error", "route, detail, and state tests", "phone/tablet venue selection"],
    ["Artist discovery", "Artist control / `/artist/:slug`", "`discovery-artist-*` / `.artist`", "`home-artist-*` / `CustomerRoute.Artist`", "public catalog and artist APIs", "ready,empty,error", "route, detail, and state tests", "phone/tablet artist selection"],
  ];
  expectedRows.forEach((expected) => {
    assert.deepEqual(rows.find(([surface]) => surface === expected[0]), expected);
  });
});
