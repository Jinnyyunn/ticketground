import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Next dev warning sources are configured for smooth scroll, dev indicator, and above-fold images", async () => {
  const nextConfigSource = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
  const layoutSource = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  const homeCardsSource = await readFile(new URL("../src/components/home/home-cards.tsx", import.meta.url), "utf8");
  const watchlistCardSource = await readFile(new URL("../src/components/watchlist/watchlist-show-card.tsx", import.meta.url), "utf8");
  const watchlistPageSource = await readFile(new URL("../src/app/watchlist/page.tsx", import.meta.url), "utf8");

  assert.match(nextConfigSource, /devIndicators:\s*false/);
  assert.match(layoutSource, /data-scroll-behavior="smooth"/);
  assert.match(homeCardsSource, /priority=\{size === "large"\}/);
  assert.doesNotMatch(homeCardsSource, /loading=\{size === "large" \? "eager" : "lazy"\}/);
  assert.doesNotMatch(homeCardsSource, /fetchPriority=\{size === "large" \? "high" : "auto"\}/);
  assert.match(watchlistCardSource, /priority\?: boolean/);
  assert.match(watchlistCardSource, /preload=\{priority\}/);
  assert.match(watchlistCardSource, /loading=\{priority \? "eager" : "lazy"\}/);
  assert.match(watchlistCardSource, /fetchPriority=\{priority \? "high" : "auto"\}/);
  assert.match(watchlistCardSource, /placeholder=\{priority \? "blur" : "empty"\}/);
  assert.match(watchlistCardSource, /blurDataURL=/);
  assert.match(watchlistPageSource, /priority: index < 3/);
});
