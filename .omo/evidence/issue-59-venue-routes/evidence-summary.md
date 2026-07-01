# Issue 59 Venue Routes Evidence

## Red Proof
- Scenario: `/goods/dracula` and `/goods/berlin-phil` venue CTA before fix.
- Invocation: Playwright Chromium against free-port `server.js` dev server.
- Observable: both CTAs rendered `BLUE SQUARE 공연장 상세 보기` with `href="/place"`.
- Artifacts: `red-venue-route-observations.json`, `red-dracula-goods-place.png`, `red-berlin-phil-goods-place.png`.

- Scenario: legacy `/place` route before fix.
- Invocation: Playwright Chromium direct navigation to `/place`.
- Observable: heading rendered `블루스퀘어 신한카드홀`.
- Artifact: `red-place-route.png`.

## Automated Verification
- Scenario: TypeScript check.
- Invocation: `npm run typecheck`.
- Observable: `tsc --noEmit` exited 0.
- Artifact: `typecheck.log`.

- Scenario: Production build.
- Invocation: `npm run build`.
- Observable: Next build exited 0 and generated `/place/[slug]` routes for `blue-square`, `lg-arts-center`, and `sac-concert-hall`.
- Artifact: `build.log`.

- Scenario: Regression test for detail venue routing.
- Invocation: `node --test --test-concurrency=1 tests/detail-venue-routes.test.mjs`.
- Observable: 1 test passed; Dracula, Berlin Philharmonic, and Les Mis venue CTA labels, hrefs, and destination headings matched.
- Artifact: `detail-venue-routes-test.log`.

## Browser QA
- Scenario: Built production app venue route click-through.
- Invocation: Playwright Chromium with `NODE_ENV=production` against free-port `server.js`.
- Observable: Dracula clicked to `/place/lg-arts-center`, Berlin Philharmonic clicked to `/place/sac-concert-hall`, Les Mis clicked to `/place/blue-square`; destination headings matched each venue.
- Artifacts: `green-venue-route-observations.json`, `green-dracula-goods-place.png`, `green-dracula-venue-destination.png`, `green-berlin-phil-goods-place.png`, `green-berlin-phil-venue-destination.png`, `green-les-miserables-goods-place.png`, `green-les-miserables-venue-destination.png`.

## Static Review
- Scenario: Changed file size and escape hatch scan.
- Invocation: pure LOC count plus `rg` escape-hatch pattern scan.
- Observable: changed source/test files under 250 pure LOC each; no banned TypeScript escape hatch patterns matched.
- Artifacts: `changed-file-loc.txt`, `no-escape-hatches-rg.log`.
