# Issue 58 Evidence

- Scenario: RED proof that `/contents/search?q=IU` returned zero results before the fix.
  Invocation: Playwright Chromium against `http://127.0.0.1:45158/contents/search?q=IU`.
  Observable: `countText` was `총 0개 전체 결과`.
  Artifacts: `.omo/evidence/issue-58-home-search-index/red-home-search-iu.json`, `.omo/evidence/issue-58-home-search-index/red-home-search-iu.png`.

- Scenario: RED regression test for home-visible search titles before catalog additions.
  Invocation: `node --test tests/search-home-visible-shows.test.mjs`.
  Observable: exit code `1`; assertion showed `IU` actual count `총 0개 전체 결과`.
  Artifact: `.omo/evidence/issue-58-home-search-index/red-search-home-visible-test.log`.

- Scenario: GREEN regression test for home-visible shows and detail links.
  Invocation: `node --test tests/search-home-visible-shows.test.mjs`.
  Observable: exit code `0`; 1 test passed, 0 failed.
  Artifact: `.omo/evidence/issue-58-home-search-index/green-search-home-visible-test.log`.

- Scenario: Required TypeScript verification.
  Invocation: `npm run typecheck`.
  Observable: exit code `0`.
  Artifact: `.omo/evidence/issue-58-home-search-index/typecheck.log`.

- Scenario: Required production build verification.
  Invocation: `npm run build`.
  Observable: exit code `0`; Next.js generated `/goods/[slug]` with `+14 more paths`.
  Artifact: `.omo/evidence/issue-58-home-search-index/build.log`.

- Scenario: Final Playwright production check for `IU` plus two Korean titles.
  Invocation: Playwright Chromium against production server `NODE_ENV=production ... node server.js`.
  Observable: `IU`, `하데스타운`, and `조성진` each returned `총 1개 전체 결과` with a matching `/goods/<slug>` link.
  Artifacts: `.omo/evidence/issue-58-home-search-index/playwright-home-search-check.json`, `.omo/evidence/issue-58-home-search-index/playwright-home-search-check.log`, `.omo/evidence/issue-58-home-search-index/playwright-search-iu-world-tour.png`, `.omo/evidence/issue-58-home-search-index/playwright-search-hadestown.png`, `.omo/evidence/issue-58-home-search-index/playwright-search-cho-seong-jin.png`.

- Scenario: Changed-file size and whitespace checks.
  Invocation: pure LOC measurement for changed files; `git diff --check`.
  Observable: `home-ticketing-catalog.ts` 219 pure LOC, `ticketing.ts` 234 pure LOC, regression test 27 pure LOC; `git diff --check` exit code `0`.
  Artifacts: `.omo/evidence/issue-58-home-search-index/changed-file-loc.log`, `.omo/evidence/issue-58-home-search-index/git-diff-check.log`.
