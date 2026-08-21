# TIG Seat Designer Reference-Parity Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simplified seat designer with a TIG-owned editor whose blank/image-first flow, complete tool families, transforms, inspectors, shortcuts, history, and venue publish match the directly observed reference behavior.

**Architecture:** Keep versioned venue chart persistence, but replace the active editor shell and gesture layer with small typed tool controllers and renderer-independent commands. Render scene objects separately from draft and selection overlays; route every committed interaction through one immutable history transaction.

**Tech Stack:** Next.js 16 App Router, React 19 client components, strict TypeScript, Tailwind v4 semantic tokens, SVG pointer interaction, Zod asset boundaries, Node test runner, Playwright Chrome.

**Spec:** `docs/superpowers/specs/2026-08-21-seat-designer-reference-parity-rebuild-design.md`

## Global Constraints

- No Seats.io SDK, API, key, code, asset, screenshot, font, or runtime dependency.
- No protected simple-login file, test, route, environment value, or provider configuration changes.
- New charts start blank; image import is a first-class start action.
- Publishing activates the bound venue only; no show-specific chart binding.
- Every production behavior begins with a failing observable test.
- No touched TypeScript module may exceed 250 pure lines.

---

### Task 1: Editor document and blank start

**Files:**
- Modify: `src/types/seat-chart.ts`
- Create: `src/lib/seat-designer/editor-document.ts`
- Modify: `src/lib/seat-designer/use-editor.ts`
- Test: `tests/seat-designer-document.test.mjs`

**Interfaces:**
- Produces `createBlankChart({ name, venueId, venueName, venueType }): SeatChartDocumentV2`.
- Produces an initial editor state with zero objects, select mode, empty history, and no tutorial/template side effect.

- [ ] Write tests asserting zero objects, bound venue identity, select mode, empty history, and round-trip serialization.
- [ ] Run the focused test and confirm failure because the current initializer loads `large-theatre`.
- [ ] Implement the typed blank factory and reducer initialization.
- [ ] Run the focused test and existing V2 persistence tests.
- [ ] Commit the document boundary with its direct tests.

### Task 2: Tool controllers and draft lifecycle

**Files:**
- Create: `src/lib/seat-designer/tools/contracts.ts`
- Create: `src/lib/seat-designer/tools/tool-state.ts`
- Create: `src/lib/seat-designer/tools/row-tools.ts`
- Create: `src/lib/seat-designer/tools/area-tools.ts`
- Create: `src/lib/seat-designer/tools/decoration-tools.ts`
- Replace: `src/lib/seat-designer/tools/create-object.ts`
- Test: `tests/seat-designer-tool-controllers.test.mjs`

**Interfaces:**
- Produces a discriminated `ToolMode` covering all observed primary and flyout modes.
- Produces `beginTool`, `updateTool`, `completeTool`, and `cancelTool` returning typed draft/commit results.

- [ ] Add literal Given/When/Then tests for every mode's pointer sequence, defaults, Shift/Alt behavior, valid completion, and Escape cancellation.
- [ ] Run and retain the missing-controller RED.
- [ ] Implement row/segmented/multiple-row/section and table/booth controllers.
- [ ] Run GREEN for those modes.
- [ ] Add RED then implement rectangular/elliptic/polygonal area and shape, line, text, image, icon, and focal controllers.
- [ ] Run the whole controller suite and mutation-check wrong defaults and wrong completion branches.
- [ ] Commit controllers and tests.

### Task 3: Scene viewport, hit testing, and transforms

**Files:**
- Create: `src/lib/seat-designer/hit-test.ts`
- Create: `src/lib/seat-designer/transforms.ts`
- Create: `src/components/seat-designer/scene-canvas.tsx`
- Create: `src/components/seat-designer/draft-overlay.tsx`
- Create: `src/components/seat-designer/selection-overlay.tsx`
- Replace: `src/components/seat-designer/canvas.tsx`
- Test: `tests/seat-designer-scene-interactions.test.mjs`

**Interfaces:**
- Produces deterministic object/seat/node/edge hit results and immutable move/resize/rotate/node commands.
- Canvas exposes stable selectors for object, draft, corner handle, rotation handle, node, and edge handle.

- [ ] Write RED tests for hit precedence, lock/layer filtering, transform invariants, vertex insertion/removal, invalid polygon rejection, pan, wheel zoom, and fit.
- [ ] Implement pure hit/transform functions until unit GREEN.
- [ ] Add browser RED for visible handles and pointer transforms.
- [ ] Implement separate scene/draft/selection layers and verify browser GREEN.
- [ ] Commit viewport and interaction layers.

### Task 4: Complete selection and history actions

**Files:**
- Modify: `src/lib/seat-designer/selection.ts`
- Modify: `src/lib/seat-designer/history.ts`
- Create: `src/lib/seat-designer/editor-commands.ts`
- Test: `tests/seat-designer-selection-tools.test.mjs`
- Test: `tests/seat-designer-history.test.mjs`

**Interfaces:**
- Produces select, seat-select, brush, same-type, node, nudge, align, flip, duplicate, copy, paste, delete commands.

- [ ] Add RED scenarios for every selection mode, multi-object transform, one-gesture-one-undo, redo clearing, and clipboard identity rotation.
- [ ] Implement commands with exhaustive object-type matching.
- [ ] Run focused tests and a 10,000-place performance fixture.
- [ ] Commit selection/history behavior.

### Task 5: Reference shell and contextual inspectors

**Files:**
- Modify: `src/app/globals.css`
- Replace: `src/components/seat-designer/seat-designer.tsx`
- Replace: `src/components/seat-designer/tool-picker.tsx`
- Replace: `src/components/seat-designer/top-toolbar.tsx`
- Split: `src/components/seat-designer/inspector.tsx`
- Create: `src/components/seat-designer/inspectors/*.tsx`
- Test: `tests/seat-designer-shell-browser.test.mjs`

**Interfaces:**
- Produces the fixed 45/41/fluid/336 shell and type-specific inspector components consuming typed commands.

- [ ] Add browser RED asserting a blank canvas, no template rail, region dimensions, observed toolbar order, flyout modes, tool help/defaults, and empty inspector.
- [ ] Define semantic editor tokens and rebuild toolbar/tool rail/canvas/inspector hierarchy.
- [ ] Add RED per selected type for common and type-specific fields, mixed multi-selection, validation, and invalid input.
- [ ] Implement focused inspectors with no module over 250 pure lines.
- [ ] Run desktop 1440 and compact 1024 browser GREEN plus keyboard focus checks.
- [ ] Commit shell and inspectors.

### Task 6: Image-first import and editable image objects

**Files:**
- Modify: `src/components/seat-designer/new-chart-dialog.tsx`
- Create: `src/components/seat-designer/image-import-dialog.tsx`
- Modify: `src/lib/seat-designer/reference-assets.ts`
- Test: `tests/seat-designer-image-flow.test.mjs`

**Interfaces:**
- Produces blank-start `이미지 불러오기`, drag/drop and file input through the existing authenticated asset boundary.

- [ ] Add RED for valid PNG/JPEG/GIF/WEBP/SVG, 10 MB limit, spoofed/oversized failure, unchanged document on error, and editable image result.
- [ ] Implement import UI and object creation while preserving aspect ratio.
- [ ] Browser-test replace, resize, rotate, opacity, lock, layer, delete, undo, and redo.
- [ ] Commit image-first flow.

### Task 7: Venue draft/save/preview/publish integration

**Files:**
- Modify: `src/components/seat-designer/chart-library.tsx`
- Modify: `src/components/seat-designer/chart-settings-dialog.tsx`
- Modify: `src/lib/seat-designer/use-editor.ts`
- Modify only as required: `src/lib/seat-charts/client.ts`
- Test: `tests/seat-designer-venue-lifecycle.test.mjs`

**Interfaces:**
- Produces create/open/save/preview/publish for the selected venue using existing draft and immutable revision APIs.

- [ ] Add RED for venue-required creation, save error retention/retry, preview non-mutation, validation block, venue activation, and linked-show resolution.
- [ ] Wire the rebuilt editor document to existing APIs without service credentials in the browser.
- [ ] Run venue publish and published-seat selection regression tests.
- [ ] Commit venue lifecycle integration.

### Task 8: Exhaustive automated and manual parity gate

**Files:**
- Replace: `tests/seat-designer-browser-tools.test.mjs`
- Replace: `tests/seat-designer-reference-contract.test.mjs`
- Create: `docs/research/seats-io-designer/REFERENCE_ACTION_LEDGER.md`
- Create: `.omo/evidence/seat-designer-reference-parity/final-verification.md`

**Interfaces:**
- Produces one observable reference/TIG receipt for every primary tool, flyout mode, transform, inspector, shortcut, state, and venue lifecycle action.

- [ ] Replace source/label assertions with real browser pointer/keyboard scenarios and independent expected geometry.
- [ ] Run lint, typecheck, build, focused tool/browser/API suites, and relevant buyer seat-selection regressions serially.
- [ ] Replay every reference action against TIG at 1440x900 and 1024x768; capture default, active, drawing, selected, node, multi-selected, dark, preview, error, and published states.
- [ ] Inspect every original capture for clipping, overlap, CJK breaks, missing handles, stale composition, and wrong destination.
- [ ] Audit protected-auth diff, runtime dependencies, browser bundles, and evidence for reference secrets/identifiers.
- [ ] Commit final evidence.

### Task 9: Delivery and merged runtime

**Files:**
- No product file changes after the exact-SHA gate.

- [ ] Inspect full diff and split atomic commits by behavior.
- [ ] Push the branch, open an implementation PR, and attach test/visual evidence without secrets.
- [ ] Verify CI and all actionable review threads at the latest SHA.
- [ ] Merge the PR only after checks pass.
- [ ] Start the merged administrator runtime on `127.0.0.1`, log in through the existing local test boundary, open `/admin/seat-designer`, and leave the completed editor visible.
