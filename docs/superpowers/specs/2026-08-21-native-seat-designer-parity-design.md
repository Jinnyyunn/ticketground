# TIG Native Seat Designer Parity Design

Date: 2026-08-21
Status: Proposed for user review
Target: `/admin/seat-designer`
Reference: `https://www.seats.io/demos/designer/demoChartLargeTheatre2D`

## 1. Objective

Replace the active TIG seat-chart authoring surface with a native TIG implementation that matches the externally observable quality and behavior of the reference Designer. The implementation must not load, call, embed, or depend on Seats.io at runtime.

The finished system lets an administrator create a venue seating chart from a blank document, a template, or an uploaded image/PDF; use the complete reference tool set; save drafts; validate and preview the chart; and publish exactly one active chart to a TIG venue. Shows use the published chart of their venue. A show whose venue has no published chart fails closed with `공연장 좌석 배치도 준비 중` and cannot enter seat selection.

## 2. Non-negotiable boundaries

- Preserve TIG venue records and stable venue IDs.
- The current TIG chart records and bundled sample charts do not require migration. Before activation they are exported to a rollback archive, then removed from the active chart store.
- Do not copy Seats.io source code, network payloads, private APIs, icons, fonts, screenshots, or other proprietary assets.
- Reproduce only externally observable workflows, interaction contracts, keyboard shortcuts, states, layout relationships, and quality using TIG-owned code and assets.
- Do not use the Seats.io account, secret key, public key, SDK, API, renderer, storage, or billing.
- Do not modify the protected Kakao, Naver, or Google simple-login boundary.
- Draft edits never affect buyer-facing seat selection until a successful publish.
- A venue may have multiple drafts and historical published revisions, but exactly one active published chart.
- Publishing is to a venue, never directly to a show.

## 3. Chosen architecture

### 3.1 Native TIG scene editor

Retain reusable TIG geometry and domain operations where they already satisfy the contract, but replace the active editor document format and monolithic rendering boundary with a versioned native scene model. The editor is split into independent modules:

1. **Document model** — venue type, floors, zones, categories, layers, objects, labels, assets, draft revision, and published revision.
2. **Scene renderer** — high-volume drawing, zoom, pan, hit testing, selection boxes, handles, guides, and previews.
3. **Tool controller** — one state machine per tool, pointer and keyboard input, creation previews, cancellation, and commit.
4. **Inspector** — typed property editors for the selected object set.
5. **History** — bounded undo/redo transactions with copy, cut, paste, duplicate, delete, align, flip, and nudge.
6. **Reference importer/scanner** — JPG, PNG, and PDF ingestion, calibration, raster reference controls, detection, review, and conversion to editable TIG objects.
7. **Draft/publish service** — optimistic revisions, autosave, validation, immutable published snapshots, venue activation, and rollback metadata.
8. **Buyer renderer adapter** — reads only the active published venue revision and exposes the existing TIG booking identifiers and seat-selection contract.

The editor renderer may use separate visual and interaction layers, but the persisted document is renderer-independent. This keeps geometry, persistence, validation, and booking testable without browser pixels.

### 3.2 Data model

Each chart record contains:

- TIG chart ID and chart name
- required TIG venue ID and venue display name
- venue type: simple, sections-and-floors, or zones
- draft revision and optional active published revision
- floors, zones, categories, and focal point
- ordered foreground, interactive, background, and surroundings layers
- rows, sections, tables, booths, general-admission areas, shapes, lines, text, images, and icons
- object and seat technical labels plus optional buyer-facing labels
- accessibility, companion, restricted-view, and related seat properties
- reference/background asset metadata without repository-embedded binary data
- validation results, timestamps, and publishing actor metadata

Uploaded binaries are stored in the existing server-managed seat-map data boundary, not as base64 blobs inside chart JSON or Git. Inputs are type-sniffed, size-limited, metadata-stripped, and served only through authenticated admin or explicitly public published-asset routes.

### 3.3 Chart keys and API access

Use the useful part of the reference architecture — stable key-based chart retrieval — without placing one master secret in TIG browsers or apps.

- Every chart receives an opaque, stable `chartKey`. A `chartKey` is an identifier, not a credential.
- Every successful publish creates an immutable `revisionId`. A venue points atomically to one active `chartKey` and `revisionId` pair.
- A performance resolves its venue on the server, then resolves that venue's active published chart. Shows and performances do not store a second chart binding.
- Published geometry and static assets are fetched by immutable revision and may use ETag or content-hash caching.
- Live price, availability, hold, and booking state remain performance-scoped and are never cached as part of the chart document.

The first-party retrieval contract is:

```text
GET /api/venues/{venueId}/seat-chart
GET /api/seat-charts/{chartKey}/versions/{revisionId}
GET /api/performances/{performanceId}/seat-map
```

The venue endpoint returns the active published identifiers or the explicit not-ready state. The version endpoint returns only sanitized published geometry and public asset references. The performance endpoint combines the immutable published layout identity with current TIG pricing and availability.

Access is separated by caller:

- **Admin browser:** existing authenticated administrator session, seat-chart permission, and CSRF protection for create, edit, reset, asset, and publish operations. It does not use an API key.
- **TIG web and mobile clients:** existing first-party session or public read boundary as appropriate. They receive chart identifiers, never an administrative secret.
- **Optional external server integration:** separately issued `tig_sc_` service credentials with explicit environment, scope, expiry, rotation, revocation, rate limit, and audit metadata. Store only a cryptographic hash of each credential.

Never place a service credential in a URL, query string, browser bundle, local storage, chart document, screenshot, or source repository. A leaked or revoked service credential must not affect administrator sessions or other service credentials.

## 4. New-chart and image-first workflow

The new-chart flow matches the reference interaction sequence:

1. Select a preserved TIG venue.
2. Name the chart and choose simple, sections-and-floors, or zones.
3. Start from blank, a TIG-owned template, or a reference file.
4. Accept JPG, PNG, and PDF. PDFs render selectable pages to a safe raster preview.
5. Calibrate the reference using two known points and a real-world distance.
6. Move, resize, rotate, change opacity, show/hide, lock, replace, or remove the reference.
7. Draw manually over the reference or invoke the TIG scanner.
8. Review scanner candidates, adjust detection threshold and scale, exclude false positives, group seats into rows, and convert accepted candidates to normal editable objects.
9. Preserve the reference as an editor-only tracing layer or promote an image to a buyer-visible background image.

The scanner must handle closed circular and rectangular seat marks, tolerate moderate rotation, group collinear candidates into rows, order seats consistently, and produce an explicit no-detection state rather than silently creating an empty chart. Scanner output is always a reviewable draft and is never published automatically.

## 5. Functional parity matrix

Every row below requires a reference receipt captured by direct browser operation and a matching TIG receipt. A toolbar icon without the corresponding behavior is not complete.

### 5.1 Global shell and view controls

- Save and exit, autosave state, preview, light/dark canvas scheme
- Undo and redo with disabled states and keyboard shortcuts
- Snap to grid, section-content visibility, always-show-labels
- Zoom in, zoom out, fit/home, wheel zoom, pinch zoom, hand pan, spacebar temporary pan
- Floor indicator, floor switching, all-floors view, create/rename/reorder/delete floors
- Validation summary, total object/seat counts, draft/published status

### 5.2 Selection tools

- Select (`V`): click, shift-toggle, marquee, drag, resize, rotate, multi-select
- Select seats (`X`): select individual seats without selecting the parent row/table
- Selection brush (`C`): continuous add/remove selection while dragging
- Select same type (`Z`): expand selection by compatible object type
- Node (`A`): add, move, and remove polygon/curve nodes with valid-shape protection
- Selection layers: all, foreground decorations, interactive objects, background decorations, surroundings
- Locked and hidden object behavior, overlap precedence, escape-to-clear, arrow-key nudge

### 5.3 Creation tools

- Focal point (`F`)
- Row (`R`), including drag creation, seat count, spacing, curve, smoothing, rotation, labels, row blocks, and row direction
- Section (`S`), including polygon creation, curve/node editing, labels, and nested contents
- Round table (`E`), including seat count, radius, rotation, whole-table booking, and variable occupancy
- Booth (`B`), including capacity, label, size, and rotation
- Rectangular/general-admission area (`G`), including capacity and fixed/variable occupancy
- Rectangle/shape (`H`), including fill, stroke, radius where supported, rotation, and layer
- Line (`L`), including endpoints, width, style, color, rotation, and layer
- Text (`T`), including content, type scale, weight, alignment, color, rotation, and layer
- Image (`I`), including upload, crop/fit behavior, opacity, rotation, lock, and layer
- Icon (`O`), including TIG-owned icon set, size, color, rotation, and layer
- Hand (`Space`)

### 5.4 Editing and context actions

- Align center and all reference-observed alignment variants
- Horizontal and vertical flip with nested section contents preserved
- Copy, cut, paste, duplicate, delete
- Move between layers, floors, zones, sections, and categories where valid
- Preserve relative geometry for multi-object transforms
- Keyboard shortcut parity on macOS and Windows/Linux variants
- Context actions and inspector edits create single undoable transactions

### 5.5 Labels, categories, and seat properties

- Technical label and separate buyer-visible label
- Row/seat start, end, prefix, direction, and sequence rules
- Duplicate-label and missing-label validation
- Category creation, editing, ordering, color, accessibility, and assignment
- Wheelchair accessibility, companion seat, lift-up armrest, hearing assistance, semi-ambulatory, sign-language, plus-size, and restricted-view properties where applicable
- View-from-seat image metadata
- Table, booth, and area booking/occupancy properties

### 5.6 Chart structure and assets

- Simple charts, sections and floors, and zones
- Reference chart versus buyer-visible background image
- Foreground, interactive, background, and surroundings layer behavior
- Multiple floors and zone assignment
- Templates are TIG-owned and do not contain reference-site assets

## 6. Save, validation, preview, and venue publish

- Autosave uses an optimistic `revision` and rejects stale writes with a recoverable conflict state.
- Save failure keeps local edits and shows retry; it must not report a successful save.
- Preview reads the current draft in a buyer-like non-mutating renderer.
- Publish first validates the draft. Duplicate labels, invalid geometry, missing categories where required, empty bookable content, and out-of-bound section contents block publishing with object-specific errors.
- Successful publish creates an immutable snapshot and atomically makes it the selected venue's active chart.
- Draft changes after publish do not change the active snapshot until the next successful publish.
- If a venue has no active published chart, every linked show renders `공연장 좌석 배치도 준비 중` and the seat-selection CTA is disabled.
- Existing TIG shows continue to resolve their venue IDs; no show-specific chart binding is retained.

## 7. Existing chart reset

On first activation of the new document version:

1. Export the old active chart records to a timestamped rollback archive outside the repository.
2. Start the new active chart store empty.
3. Preserve every venue record and venue ID unchanged.
4. Do not silently convert old charts into the new model.
5. Require an administrator to create and publish a new chart per venue before seat selection becomes available.

This implements the approved removal while retaining an operational rollback artifact.

## 8. Error and security behavior

- Reject unsupported, malformed, oversized, or decompression-bomb image/PDF uploads.
- Rasterize PDFs in an isolated, resource-bounded process or safe browser worker.
- Strip metadata and never expose local filesystem paths.
- Treat scanner input and labels as untrusted; do not execute embedded content.
- Fail closed on missing assets, corrupted documents, validation errors, stale saves, or missing published venue charts.
- Restrict authoring, asset access, reset, and publishing to existing seat-chart admin permissions with CSRF protection and audit events.
- Never place secrets, credentials, personal data, or buyer information in chart documents or screenshots.
- Keep all simple-login files, tests, environment variables, and provider settings untouched.

## 9. Quality and performance standard

“Implemented” means the editor feels and looks comparable to the reference, not merely that an equivalent button exists.

- Extract exact computed typography, colors, spacing, borders, shadows, control sizes, cursor states, transitions, disabled states, selected states, handles, guides, and panel geometry from the reference.
- Capture desktop reference states at a fixed viewport and reproduce them with TIG design tokens and original TIG-owned icons.
- Compare each default, hover, pressed, drawing, selected, multi-selected, disabled, loading, error, empty, preview, and publish state side by side.
- Keep pointer feedback immediate while editing large-theatre fixtures. Performance tests cover at least 5,000 and 10,000 bookable objects, pan/zoom, marquee selection, history operations, save payload size, and buyer rendering.
- No visible clipping, overlap, incomplete composition, text corruption, lost pointer events, or browser horizontal overflow at supported admin widths.
- Responsive checks cover desktop 1440 px and compact admin 1024 px. The buyer renderer retains phone, tablet, and desktop coverage.

## 10. Direct reference audit protocol

Before implementing a feature family, use the logged-in Aside browser or public Demo to operate it directly. The audit is serialized to protect host resources.

For every matrix row:

1. Record reference URL, viewport, chart state, selected layer/floor, and tool.
2. Capture the default state and exact computed styles of the relevant controls.
3. Trigger the tool using both click and shortcut where available.
4. Exercise creation, drag, node edit, property edit, invalid input, undo, redo, duplicate, delete, and cancel where applicable.
5. Capture the resulting object geometry and inspector changes.
6. Repeat the same scenario in TIG with equivalent fixtures.
7. Store reference and TIG screenshots, action ledger, expected/actual state, and pass/fail result.

No feature can be marked complete from source inspection or a screenshot alone. The final matrix must contain no unreviewed or assumed rows.

## 11. Test strategy

### Unit and model tests

- Geometry, snapping, row/table seat generation, node mutation, transforms, ordering, labels, layers, floors, zones, categories, scanner grouping, validation, history, and document serialization.
- Stable results for rotated, curved, nested, empty, malformed, and high-count fixtures.

### API and persistence tests

- Admin authorization and CSRF, asset validation, autosave revisions, stale conflict, draft/published separation, venue activation, rollback metadata, and missing-chart fail-closed behavior.
- Only the public published lookup route is readable without admin privileges.
- Stable opaque chart keys, immutable published revisions, venue-to-active-revision switching, ETag/content-hash behavior, and separation of static chart data from live performance state.
- Optional service credentials cover scope denial, expiry, rotation, revocation, hashing at rest, rate limits, audit events, and rejection from URL/query-string transport.

### Browser interaction tests

- One focused scenario for every tool and context action.
- Keyboard shortcuts, pointer creation, multi-selection, inspector edits, undo/redo, import/scanner review, validation, preview, venue publish, and linked-show buyer rendering.
- Real browser manual passes reproduce the reference audit ledger at 1440 px and 1024 px.

### End-to-end booking regression

- Unpublished venue blocks seat selection.
- Published venue chart becomes available to every linked show.
- Multi-seat selection, queue transition, hold, checkout, payment compensation, reservation, cancellation, and official resale keep their current TIG contracts.

### Final gates

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- focused model/API/browser suites
- full relevant booking regression
- direct reference-to-TIG tool matrix with zero missing rows
- independent visual fidelity review and independent functional gate review, run serially
- protected-auth diff audit

## 12. Delivery and activation

Implementation is performed in the isolated `feat/admin-seat-chart-venue` worktree in small, reviewable batches. Builds, browsers, and full test suites run serially. The implementation is delivered through a verified PR and merge. After merge, `admin-dev.ticketground.co.kr/admin/seat-designer` is rebuilt from the merged checkout, then the complete image-import, drawing, venue-publish, and buyer-rendering flow is repeated in the real admin-dev browser.

The new active store is not reset until the implementation, rollback export, permission checks, automated suites, and manual QA all pass at the same commit.
