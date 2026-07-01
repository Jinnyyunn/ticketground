# Issue 53 Queue Param Guard Evidence

## Red
- Scenario: `/queue/dracula?date=bad-date&time=bad-time` should not display raw invalid query values.
- Invocation: `NODE_ENV=development node --test --test-concurrency=1 tests/queue-booking-transition.test.mjs`
- Binary observable: exit `1`; assertion saw `bad-date` count `1` instead of `0`.
- Artifact: `.omo/evidence/issue-53-queue-param-guard/red-dracula-invalid-params-test.log`

## Implementation Verification
- Scenario: invalid Dracula queue params normalize to the show's first scheduled slot.
- Invocation: `NODE_ENV=development node --test --test-concurrency=1 tests/queue-booking-transition.test.mjs`
- Binary observable: exit `0`; `1` test passed, `0` failed.
- Artifact: `.omo/evidence/issue-53-queue-param-guard/green-queue-booking-transition.log`

- Scenario: TypeScript compiler gate.
- Invocation: `npm run typecheck`
- Binary observable: exit `0`; `tsc --noEmit`.
- Artifact: `.omo/evidence/issue-53-queue-param-guard/typecheck.log`

- Scenario: production Next.js build gate.
- Invocation: `npm run build`
- Binary observable: exit `0`; Next.js compiled and generated `67/67` static pages.
- Artifact: `.omo/evidence/issue-53-queue-param-guard/build.log`

- Scenario: whitespace/diff hygiene.
- Invocation: `git diff --check`
- Binary observable: exit `0`.
- Artifact: `.omo/evidence/issue-53-queue-param-guard/git-diff-check.log`

## Browser Verification
- Scenario: invalid URL no longer displays raw values.
- Invocation: Playwright Chromium against `http://127.0.0.1:4513/queue/dracula?date=bad-date&time=bad-time`.
- Binary observable: `rawBadDateCount: 0`, `rawBadTimeCount: 0`, `fallbackDateVisible: true`, `fallbackTimeVisible: true`, `waitingRoomVisible: true`.
- Artifacts: `.omo/evidence/issue-53-queue-param-guard/playwright-queue-url-check.json`, `.omo/evidence/issue-53-queue-param-guard/invalid-dracula-queue.png`

- Scenario: valid URL still shows waiting room.
- Invocation: Playwright Chromium against `http://127.0.0.1:4513/queue/dracula?date=2026.07.10&time=19%3A30`.
- Binary observable: `dateVisible: true`, `timeVisible: true`, `waitingRoomVisible: true`, `queueAheadText` non-empty.
- Artifacts: `.omo/evidence/issue-53-queue-param-guard/playwright-queue-url-check.json`, `.omo/evidence/issue-53-queue-param-guard/valid-dracula-queue.png`

## Worktree Setup Note
- The inherited untracked `node_modules` symlink pointed outside the worktree and caused Turbopack to panic. It was replaced with a local `npm ci --prefer-offline` install inside this worktree only.
- Artifact: `.omo/evidence/issue-53-queue-param-guard/npm-ci-local-node-modules.log`
