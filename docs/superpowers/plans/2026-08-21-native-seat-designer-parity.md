# TIG Native Seat Designer Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace active TIG seat charts with a venue-bound native designer that reproduces every externally observable Seats.io Demo authoring workflow, including image/PDF reference import and seat scanning, without any Seats.io runtime dependency.

**Architecture:** A versioned renderer-independent `SeatChartDocumentV2` owns geometry, assets, floors, zones, categories, drafts, and immutable published revisions. Focused editor modules render and manipulate that document, while venue and performance APIs expose stable `chartKey`/`revisionId` identifiers and keep live price/availability separate. Existing chart records are archived and deactivated; TIG venue IDs and booking contracts remain stable.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 design tokens, native SVG/Canvas browser primitives, Web Worker image scanning, Zod boundary validation, Node test runner, Playwright browser tests, Aside browser reference capture.

**Spec:** `docs/superpowers/specs/2026-08-21-native-seat-designer-parity-design.md`

## Global Constraints

- Preserve every TIG venue record and stable venue ID.
- Remove old charts from the active store only after a timestamped rollback export succeeds.
- Do not use Seats.io SDKs, APIs, keys, runtime storage, source, assets, icons, or private payloads.
- Publish exactly one active immutable chart revision per venue; never bind a chart directly to a show.
- Shows without an active venue chart display `공연장 좌석 배치도 준비 중` and cannot enter seat selection.
- A toolbar button is not completion; every reference workflow needs a direct browser receipt and a matching TIG receipt.
- Do not modify protected Kakao, Naver, or Google simple-login files, tests, settings, or environment values.
- Serialize builds, browsers, heavy tests, and visual reviewers.
- Use `apply_patch` for file edits and preserve unrelated dirty work.
- Treat every `git add` block below as an allowed-path list, not permission to stage all current changes under a directory. Before each commit, stage new files by exact path and use `git add -p -- <path>` for any path that was already dirty at plan start; inspect the complete staged diff before committing.

---

### Task 1: Freeze the Reference Behavior and Visual Contract

**Files:**
- Create: `docs/research/seats-io-designer/BEHAVIORS.md`
- Create: `docs/research/seats-io-designer/DESIGN_TOKENS.md`
- Create: `docs/research/seats-io-designer/TOOL_PARITY_MATRIX.md`
- Create: `docs/research/seats-io-designer/tool-parity.json`
- Create: `docs/research/components/seat-designer-shell.spec.md`
- Create: `docs/research/components/seat-designer-tools.spec.md`
- Create: `docs/research/components/seat-designer-inspector.spec.md`
- Create: `docs/research/components/seat-designer-import-scanner.spec.md`
- Create: `docs/research/components/seat-designer-publish.spec.md`
- Create: `tests/seat-designer-reference-contract.test.mjs`

**Interfaces:**
- Produces: a matrix row with `id`, `referenceState`, `actions`, `expected`, `tigTest`, `evidence`, and `status` for every tool/state.
- Produces: exact control geometry and computed style tokens consumed by Tasks 5–7.

- [ ] **Step 1: Write the matrix-shape test**

```js
test("reference matrix enumerates every required tool and state", async () => {
  const matrix = JSON.parse(await readFile("docs/research/seats-io-designer/tool-parity.json", "utf8"));
  const ids = new Set(matrix.rows.map((row) => row.id));
  for (const id of requiredRows) assert.equal(ids.has(id), true, `missing ${id}`);
  for (const row of matrix.rows) {
    assert.ok(row.referenceState);
    assert.ok(row.actions.length > 0);
    assert.ok(row.expected.length > 0);
  }
});
```

- [ ] **Step 2: Run the contract test and record the intended RED**

Run: `node --test tests/seat-designer-reference-contract.test.mjs`

Expected: FAIL because `tool-parity.json` and required reference receipts do not exist.

- [ ] **Step 3: Operate the reference one feature at a time**

Use the logged-in Aside tab and the public large-theatre Demo. For every global action, selection mode, creation tool, inspector family, layer, floor, import flow, validation state, preview, shortcut, and context action:

1. record fixed viewport and chart state;
2. capture interactive snapshot and screenshot;
3. click the control and capture the diff;
4. repeat with its shortcut;
5. create or mutate an object;
6. exercise undo, redo, duplicate, delete, and cancel when applicable;
7. extract computed styles for default, hover, active, disabled, and selected states;
8. write a single auditable matrix row.

- [ ] **Step 4: Complete the research artifacts and make the contract GREEN**

Run: `node --test tests/seat-designer-reference-contract.test.mjs`

Expected: PASS with zero missing or assumed matrix rows.

- [ ] **Step 5: Commit the reference contract**

```bash
git add docs/research/seats-io-designer docs/research/components tests/seat-designer-reference-contract.test.mjs
git commit -m "docs: capture seat designer reference contract"
```

### Task 2: Introduce the V2 Document, Stable Keys, and Recoverable Reset

**Files:**
- Modify: `src/types/seat-chart.ts`
- Replace: `src/lib/seat-charts/types.ts`
- Create: `src/lib/seat-charts/keys.ts`
- Create: `src/lib/seat-charts/revisions.ts`
- Create: `src/lib/seat-charts/reset.ts`
- Modify: `src/lib/seat-charts/store.ts`
- Test: `tests/seat-chart-v2-document.test.mjs`
- Test: `tests/seat-chart-reset.test.mjs`

**Interfaces:**
- Produces: `SeatChartDocumentV2`, `SeatChartDraftRecord`, `SeatChartPublishedRevision`, `ChartKey`, and `RevisionId`.
- Produces: `archiveAndResetLegacyCharts({ dataDir, now }): Promise<{ archivePath: string; archivedCount: number }>`.
- Produces: `publishVenueRevision({ chartKey, venueId, expectedDraftRevision, actorId }): Promise<SeatChartPublishedRevision>`.

- [ ] **Step 1: Write failing schema and reset tests**

```ts
const document: SeatChartDocumentV2 = {
  version: 2,
  chartKey: "chart_01JTEST",
  venueId: "venue_jamsil_sports_complex_main_stadium",
  name: "주경기장",
  venueType: "sectionsAndFloors",
  floors: [], zones: [], categories: [], objects: [], assets: [],
  draftRevision: 1,
};
```

Assert that old active files are copied to a timestamped archive before the active index becomes empty, while venue files remain byte-identical.

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test tests/seat-chart-v2-document.test.mjs tests/seat-chart-reset.test.mjs`

Expected: FAIL with missing V2 types and reset functions.

- [ ] **Step 3: Implement opaque keys and immutable revisions**

```ts
export type ChartKey = `chart_${string}`;
export type RevisionId = `rev_${string}`;

export type SeatChartPublishedRevision = {
  readonly revisionId: RevisionId;
  readonly chartKey: ChartKey;
  readonly venueId: string;
  readonly document: SeatChartDocumentV2;
  readonly contentHash: string;
  readonly publishedAt: string;
  readonly publishedBy: string;
};
```

Use atomic temporary-file replacement for indexes and revisions. Reject stale saves by comparing `expectedDraftRevision` before write.

- [ ] **Step 4: Implement reset as export-then-deactivate**

The reset must abort without changing the active store when archive creation, fsync, or verification fails.

- [ ] **Step 5: Run focused tests and commit**

Run: `node --test tests/seat-chart-v2-document.test.mjs tests/seat-chart-reset.test.mjs`

```bash
git add src/types/seat-chart.ts src/lib/seat-charts tests/seat-chart-v2-document.test.mjs tests/seat-chart-reset.test.mjs
git commit -m "feat(admin): add versioned venue seat charts"
```

### Task 3: Build Safe Reference Asset Import and the Scanner Worker

**Files:**
- Create: `src/lib/seat-designer/reference-assets.ts`
- Create: `src/lib/seat-designer/scanner.ts`
- Create: `src/lib/seat-designer/scanner-worker.ts`
- Create: `src/app/api/seat-charts/assets/route.ts`
- Create: `src/app/api/seat-charts/assets/[assetId]/route.ts`
- Create: `src/components/seat-designer/new-chart-dialog.tsx`
- Create: `src/components/seat-designer/reference-chart-panel.tsx`
- Create: `src/components/seat-designer/scanner-review.tsx`
- Test: `tests/seat-chart-reference-import.test.mjs`
- Test: `tests/seat-chart-scanner.test.mjs`

**Interfaces:**
- Produces: `sanitizeReferenceAsset(file): Promise<SeatChartAsset>`.
- Produces: `detectSeatCandidates(image, options): ScannerResult`.
- Produces: `groupCandidatesIntoRows(candidates, tolerance): readonly ScannerRow[]`.
- Produces: `acceptScannerRows(result): readonly RowObject[]`.

- [ ] **Step 1: Write failing JPG/PNG/PDF and detection tests**

Cover valid raster inputs, selectable PDF page, MIME spoof, oversized dimensions, decompression bomb, metadata stripping, zero detections, rotated circle grids, rectangular marks, exclusions, and deterministic row labels.

- [ ] **Step 2: Run tests to verify RED**

Run: `node --test tests/seat-chart-reference-import.test.mjs tests/seat-chart-scanner.test.mjs`

Expected: FAIL with missing importer/scanner modules.

- [ ] **Step 3: Implement the safe asset boundary**

Only authenticated seat-chart administrators may upload. Store sanitized binaries outside Git and return opaque asset IDs. Never return server filesystem paths.

- [ ] **Step 4: Implement deterministic worker scanning**

```ts
export type ScannerOptions = {
  readonly threshold: number;
  readonly minDiameter: number;
  readonly maxDiameter: number;
  readonly rowAngleTolerance: number;
};
```

Detect closed circular/rectangular components, normalize scale/rotation, group candidates, and return confidence plus rejection reason. Conversion remains an explicit user action.

- [ ] **Step 5: Run focused tests, browser import smoke, and commit**

Run: `node --test tests/seat-chart-reference-import.test.mjs tests/seat-chart-scanner.test.mjs`

```bash
git add src/lib/seat-designer src/app/api/seat-charts/assets src/components/seat-designer tests/seat-chart-reference-import.test.mjs tests/seat-chart-scanner.test.mjs
git commit -m "feat(admin): add seat chart image scanning"
```

### Task 4: Split the Editor State Machine and Selection Foundation

**Files:**
- Create: `src/lib/seat-designer/editor-state.ts`
- Create: `src/lib/seat-designer/history.ts`
- Create: `src/lib/seat-designer/hit-test.ts`
- Create: `src/lib/seat-designer/selection.ts`
- Modify: `src/lib/seat-designer/use-editor.ts`
- Create: `src/components/seat-designer/scene-viewport.tsx`
- Create: `src/components/seat-designer/selection-overlay.tsx`
- Modify: `src/components/seat-designer/canvas.tsx`
- Test: `tests/seat-designer-selection-tools.test.mjs`
- Test: `tests/seat-designer-history.test.mjs`

**Interfaces:**
- Produces: `EditorCommand`, `EditorTransaction`, `SelectionState`, and `ToolController`.
- Produces controllers for `select`, `selectSeats`, `brush`, `selectSame`, `node`, and temporary `hand`.

- [ ] **Step 1: Write RED tests for every selection mode**

Assert click, shift-toggle, marquee direction, brush add/remove, seat-only selection, same-type expansion, node add/move/remove, locked object exclusion, layer filtering, overlap precedence, escape, nudge, and spacebar pan.

- [ ] **Step 2: Run focused RED**

Run: `node --test tests/seat-designer-selection-tools.test.mjs tests/seat-designer-history.test.mjs`

- [ ] **Step 3: Implement transactional state and bounded history**

Inspector drags and pointer gestures commit once on pointer-up. Preview updates never enter history. Undo and redo restore document plus selection deterministically.

- [ ] **Step 4: Implement spatial hit testing and selection overlay**

Keep object rendering independent from selection handles. Test 5,000-object hit testing without scanning every object on each pointer move.

- [ ] **Step 5: Run tests, browser scenarios, and commit**

```bash
git add src/lib/seat-designer src/components/seat-designer tests/seat-designer-selection-tools.test.mjs tests/seat-designer-history.test.mjs
git commit -m "feat(admin): match seat designer selection tools"
```

### Task 5: Implement Every Creation Tool and Geometry Inspector

**Files:**
- Create: `src/lib/seat-designer/tools/types.ts`
- Create: `src/lib/seat-designer/tools/row-tool.ts`
- Create: `src/lib/seat-designer/tools/section-tool.ts`
- Create: `src/lib/seat-designer/tools/table-tool.ts`
- Create: `src/lib/seat-designer/tools/area-tool.ts`
- Create: `src/lib/seat-designer/tools/decoration-tools.ts`
- Modify: `src/lib/seat-designer/geometry.ts`
- Modify: `src/lib/seat-designer/chart-ops.ts`
- Modify: `src/components/seat-designer/inspector.tsx`
- Test: `tests/seat-designer-creation-tools.test.mjs`
- Test: `tests/seat-designer-inspector.test.mjs`

**Interfaces:**
- Produces a `ToolController` for focal point, row, section, table, booth, area, rectangle, line, text, image, and icon.
- Inspector consumes `SelectionState` and produces typed `EditorCommand` values only.

- [ ] **Step 1: Write one failing interaction contract per tool**

Each contract covers pointer sequence, live preview, escape cancellation, minimum valid geometry, created type, default layer/category, inspector fields, and undo/redo.

- [ ] **Step 2: Run the RED suite**

Run: `node --test tests/seat-designer-creation-tools.test.mjs tests/seat-designer-inspector.test.mjs`

- [ ] **Step 3: Implement row, section, table, booth, and area tools**

Cover curves, smoothing, seat count/spacing/direction, polygon nodes, nested section contents, whole-table booking, variable occupancy, and capacity.

- [ ] **Step 4: Implement rectangle, line, text, image, icon, and focal point tools**

Use TIG-owned icons and uploaded assets only. Preserve layer, rotation, opacity, stroke/fill, and sizing semantics.

- [ ] **Step 5: Implement typed inspector transactions**

Multi-selection shows shared values and a mixed state. Invalid numeric or label input does not mutate the document.

- [ ] **Step 6: Run all tool tests and commit**

```bash
git add src/lib/seat-designer src/components/seat-designer/inspector.tsx tests/seat-designer-creation-tools.test.mjs tests/seat-designer-inspector.test.mjs
git commit -m "feat(admin): complete seat designer drawing tools"
```

### Task 6: Complete Context Actions, Floors, Zones, Layers, Labels, and Categories

**Files:**
- Create: `src/lib/seat-designer/context-actions.ts`
- Create: `src/lib/seat-designer/labels.ts`
- Create: `src/lib/seat-designer/chart-structure.ts`
- Create: `src/components/seat-designer/floor-manager.tsx`
- Create: `src/components/seat-designer/category-manager.tsx`
- Modify: `src/components/seat-designer/layer-picker.tsx`
- Modify: `src/components/seat-designer/top-toolbar.tsx`
- Modify: `src/components/seat-designer/chart-settings-dialog.tsx`
- Test: `tests/seat-designer-context-actions.test.mjs`
- Test: `tests/seat-designer-chart-structure.test.mjs`

**Interfaces:**
- Produces copy/cut/paste/duplicate/delete/alignment/flip commands with nested geometry preservation.
- Produces floor, zone, category, technical-label, displayed-label, and seat-property commands.

- [ ] **Step 1: Write RED tests for every matrix row in these families**

Include macOS and Windows/Linux shortcuts, multi-object relative geometry, section-content flip, floor/zone reassignment, category ordering, duplicate labels, accessible/companion/restricted-view properties, and view-from-seat metadata.

- [ ] **Step 2: Implement pure commands and managers**

All commands validate first, return a new document, and become one undoable transaction.

- [ ] **Step 3: Run tests and commit**

```bash
git add src/lib/seat-designer src/components/seat-designer tests/seat-designer-context-actions.test.mjs tests/seat-designer-chart-structure.test.mjs
git commit -m "feat(admin): complete seat designer structure tools"
```

### Task 7: Match the Reference Shell and Interaction Quality

**Files:**
- Modify: `src/components/seat-designer/seat-designer.tsx`
- Modify: `src/components/seat-designer/tool-picker.tsx`
- Modify: `src/components/seat-designer/top-toolbar.tsx`
- Modify: `src/components/seat-designer/inspector.tsx`
- Modify: `src/components/seat-designer/chart-library.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/seat-designer-shell-visual.test.mjs`

**Interfaces:**
- Consumes exact tokens and states captured in Task 1.
- Produces stable `data-testid`/accessible names for every matrix row without exposing implementation-only text.

- [ ] **Step 1: Write screenshot and DOM-state RED tests**

Cover default, hover, pressed, selected, disabled, drawing, multi-selected, loading, empty, error, preview, validation, autosave, and publish states at 1440×900 and 1024×768.

- [ ] **Step 2: Replace one-off values with semantic editor tokens**

Define editor background, panel, control, border, active, disabled, guide, selection, handle, and elevation tokens in `globals.css`; components consume tokens rather than raw hex/rgba values.

- [ ] **Step 3: Match layout, cursors, transitions, and focus behavior**

Use TIG-owned iconography while preserving reference control geometry and state hierarchy. Maintain keyboard focus and accessible tool names.

- [ ] **Step 4: Run browser visual tests and commit**

```bash
git add src/components/seat-designer src/app/globals.css tests/seat-designer-shell-visual.test.mjs
git commit -m "feat(admin): match seat designer interaction quality"
```

### Task 8: Implement Draft Validation, Venue Publish, and Keyed Retrieval APIs

**Files:**
- Modify: `src/lib/seat-designer/validation.ts`
- Modify: `src/app/api/seat-charts/route.ts`
- Modify: `src/app/api/seat-charts/[id]/route.ts`
- Modify: `src/app/api/seat-charts/[id]/publish/route.ts`
- Create: `src/app/api/venues/[venueId]/seat-chart/route.ts`
- Create: `src/app/api/seat-charts/[chartKey]/versions/[revisionId]/route.ts`
- Create: `src/app/api/performances/[performanceId]/seat-map/route.ts`
- Create: `src/lib/seat-charts/service-credentials.ts`
- Test: `tests/seat-chart-publish-v2.test.mjs`
- Test: `tests/seat-chart-key-api.test.mjs`
- Test: `tests/seat-chart-service-credentials.test.mjs`

**Interfaces:**
- Produces first-party immutable chart retrieval and live performance seat-map responses.
- Produces optional hashed `tig_sc_` service credentials with scope, expiry, rotation, revocation, rate limiting, and audit metadata.

- [ ] **Step 1: Write RED API tests**

Assert stale draft rejection, object-specific validation errors, immutable revisions, atomic venue activation, old-revision readability, ETag/304, no-chart not-ready response, sanitized public documents, and static/live separation.

- [ ] **Step 2: Implement validation and publish transaction**

Publish validates the expected draft revision, writes the immutable content-addressed revision, then swaps the venue pointer. A failure before pointer swap leaves the previous revision active.

- [ ] **Step 3: Implement the three retrieval routes**

Return no secret or admin metadata. Performance responses combine `chartKey`/`revisionId` with current TIG pricing and availability.

- [ ] **Step 4: Implement optional server credential issuance and verification**

Never accept credentials in a URL or query string. Persist only a password-hash-quality digest and non-secret prefix/suffix metadata.

- [ ] **Step 5: Run API tests and commit**

```bash
git add src/lib/seat-designer/validation.ts src/lib/seat-charts src/app/api tests/seat-chart-publish-v2.test.mjs tests/seat-chart-key-api.test.mjs tests/seat-chart-service-credentials.test.mjs
git commit -m "feat(admin): publish versioned venue seat charts"
```

### Task 9: Switch Buyer Rendering and Preserve Booking Contracts

**Files:**
- Modify: `src/app/booking/[slug]/page.tsx`
- Modify: `src/components/ticketing/chart-seat-map.tsx`
- Modify: `src/lib/seat-charts/bind-backend-seats.ts`
- Modify: `src/lib/seat-charts/inventory.ts`
- Delete after replacement: `src/app/api/seat-charts/for-show/[slug]/route.ts`
- Test: `tests/seat-chart-not-ready.test.mjs`
- Test: `tests/seat-chart-venue-publishing.test.mjs`
- Test: `tests/booking-single-checkout-flow.test.mjs`
- Test: `tests/multi-seat-booking-ui-flow.test.mjs`

**Interfaces:**
- Consumes `GET /api/performances/{performanceId}/seat-map`.
- Preserves backend ticket IDs, revision checking, queue, hold, checkout, reservation, cancellation, and official resale contracts.

- [ ] **Step 1: Write RED tests for unpublished and published venues**

Unpublished shows render `공연장 좌석 배치도 준비 중`, expose no selectable seats, and disable the seat-selection CTA. Publishing once enables every show linked to the venue; publishing a new revision changes only new sessions.

- [ ] **Step 2: Implement V2 buyer layout binding**

Bind published technical seat labels to backend inventory without trusting client price or availability. Reject missing or duplicate bindings.

- [ ] **Step 3: Run focused and full booking regressions**

Run:

```bash
node --test tests/seat-chart-not-ready.test.mjs tests/seat-chart-venue-publishing.test.mjs tests/booking-single-checkout-flow.test.mjs tests/multi-seat-booking-ui-flow.test.mjs tests/booking-session-contract.test.mjs
```

- [ ] **Step 4: Commit**

```bash
git add src/app/booking src/components/ticketing src/lib/seat-charts src/app/api/seat-charts tests
git commit -m "feat(web): render published venue seat charts"
```

### Task 10: Exhaustive Parity, Performance, Security, and Admin-dev Qualification

**Files:**
- Update: `docs/research/seats-io-designer/TOOL_PARITY_MATRIX.md`
- Create: `.omo/evidence/seat-designer-parity/final-verification.md`
- Test: `tests/seat-designer-large-chart-performance.test.mjs`

**Interfaces:**
- Consumes every test ID and reference receipt from prior tasks.
- Produces a zero-gap final matrix bound to one exact commit SHA.

- [ ] **Step 1: Run static and automated gates serially**

```bash
npm run lint
npm run typecheck
npm run build
node --test tests/seat-designer-*.test.mjs tests/seat-chart-*.test.mjs
```

Run the relevant queue, booking, payment compensation, reservation, cancellation, and official resale suites after the focused seat-chart suite.

- [ ] **Step 2: Run 5,000 and 10,000-object performance scenarios**

Measure load, zoom, pan, hit test, marquee, history, autosave payload, publish, and buyer render. Record timings and browser long tasks; treat lost input or multi-second freezes as failures.

- [ ] **Step 3: Replay every reference matrix row in TIG**

Operate the reference and TIG serially at matching viewport/state. Capture current screenshots and action receipts. No row may remain `not-run`, `assumed`, `source-only`, or `visual-only`.

- [ ] **Step 4: Run independent serial visual and functional reviews**

Reviewers inspect every accepted original capture, computed-style receipt, CJK rendering, interaction result, and matrix row. Fix and recapture the full affected set after any product change.

- [ ] **Step 5: Audit protected and security boundaries**

Verify zero protected simple-login files, no secret/service credential in client output, authenticated asset/publish mutations, immutable revisions, and no PII in evidence.

- [ ] **Step 6: Commit implementation evidence and open the PR**

```bash
git add docs/research/seats-io-designer tests/seat-designer-large-chart-performance.test.mjs
git commit -m "test(admin): verify seat designer parity"
```

Open one implementation PR for the branch, verify CI and review threads, then merge only after all required checks pass.

- [ ] **Step 7: Deploy and qualify admin-dev**

Rebuild the merged deployment checkout, restart the managed dev services, and use the real `admin-dev.ticketground.co.kr/admin/seat-designer` browser session to import an image, scan seats, exercise every tool family, publish to a venue, and verify linked-show buyer rendering. Record the exact merged SHA and browser evidence.
