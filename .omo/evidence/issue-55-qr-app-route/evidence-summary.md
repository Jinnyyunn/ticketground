# Issue 55 QR app route evidence

Branch: fix/issue-55-qr-app-route
Worktree: /private/tmp/ticketground-issue-worktrees/issue-55-qr-app-route
Generated: 2026-07-01T14:21:02+09:00

## Success criteria
- RED direct URL currently 404: `curl http://127.0.0.1:45955/reservation/CTI-260629-DAYQR` before fix returned HTTP 404. Artifact: `red-404-direct-url.json`, `red-404-direct-url.html`.
- Regression red/green: `node --test --test-concurrency=1 tests/qr-app-route.test.mjs` failed before fix with `404 !== 200`, then passed after fix with 1/1 tests passing. Artifacts: `red-regression-test.log`, `green-regression-test.log`.
- Typecheck: `npm run typecheck` exited 0. Artifact: `typecheck.log`.
- Build: `npm run build` exited 0 and generated 68 static pages. Artifact: `build.log`.
- Playwright production route check: production `node server.js` + Chromium opened `/reservation/CTI-260629-DAYQR`; observable status 200, app-only heading true, safe web guidance true, deeplink guidance true, disabled app button true, no `[data-entry-qr]`, no canvas, no QR image, token material false. Artifacts: `playwright-app-only-guidance.json`, `playwright-app-only-guidance.png`, `playwright-prod-server.log`.
- Whitespace check: `git diff --check` exited 0. Artifact: `git-diff-check.log`.
- Environment note: untracked `node_modules` symlink was localized so Next/Turbopack could run in this isolated worktree. Artifacts: `node-modules-symlink-normalized.txt`, `node-modules-localized.txt`.
