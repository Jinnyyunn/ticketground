# Issue 61 Open Alert Buttons Evidence

## Scope
- Worktree: `/tmp/ticketground-issue-worktrees/issue-61-open-alert-buttons`
- Branch: `fix/issue-61-open-alert-buttons`
- Scenario: `/open` row-level `알림` button.

## Red Proof
- Invocation: `NODE_ENV=production node --test --test-concurrency=1 tests/open-alert-feedback.test.mjs`
- Observable: before implementation, clicking the first row `알림` button produced `statusCount = 0`.
- Captured artifact: `.omo/evidence/issue-61-open-alert-buttons/red-browser-proof-ui.log`

## Implementation Verification
- Invocation: `npm run typecheck`
- Observable: `tsc --noEmit` exited 0.
- Captured artifact: `.omo/evidence/issue-61-open-alert-buttons/typecheck.log`

- Invocation: `npm run build`
- Observable: Next.js production build exited 0 and generated `/open`.
- Captured artifact: `.omo/evidence/issue-61-open-alert-buttons/build.log`

- Invocation: `NODE_ENV=production node --test --test-concurrency=1 tests/open-alert-feedback.test.mjs`
- Observable: targeted Playwright regression passed, asserting one row `role=status`, `aria-live="polite"`, and changed visible row text after click.
- Captured artifact: `.omo/evidence/issue-61-open-alert-buttons/targeted-playwright.log`

- Invocation: `NODE_ENV=production node .omo/evidence/issue-61-open-alert-buttons/open-alert-browser-proof.mjs`
- Observable: mobile 390, tablet 768, and desktop 1280 all reported `buttonAriaPressed="true"`, `rowTextChanged=true`, `statusAriaLive="polite"`, `statusCount=1`, `statusVisible=true`, and `statusText="알림 완료"`.
- Captured artifacts:
  - `.omo/evidence/issue-61-open-alert-buttons/browser-proof.log`
  - `.omo/evidence/issue-61-open-alert-buttons/browser-proof.json`
  - `.omo/evidence/issue-61-open-alert-buttons/mobile-390-before.png`
  - `.omo/evidence/issue-61-open-alert-buttons/mobile-390-after.png`
  - `.omo/evidence/issue-61-open-alert-buttons/tablet-768-before.png`
  - `.omo/evidence/issue-61-open-alert-buttons/tablet-768-after.png`
  - `.omo/evidence/issue-61-open-alert-buttons/desktop-1280-before.png`
  - `.omo/evidence/issue-61-open-alert-buttons/desktop-1280-after.png`

## Environment Note
- Initial dev/build attempts failed because this worktree had `node_modules` as an out-of-root symlink rejected by Next/Turbopack. The symlink was replaced with a local `npm ci` install inside the worktree. This is ignored by Git and not part of the commit.
- Captured artifacts:
  - `.omo/evidence/issue-61-open-alert-buttons/red-browser-proof.log`
  - `.omo/evidence/issue-61-open-alert-buttons/pre-red-build.log`
  - `.omo/evidence/issue-61-open-alert-buttons/pre-red-build-after-local-install.log`
