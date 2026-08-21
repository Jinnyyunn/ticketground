# TIG Seat Designer Reference-Parity Rebuild Design

Date: 2026-08-21
Status: Approved in conversation
Target: `/admin/seat-designer`

## Goal

Replace the current simplified TIG editor with a TIG-owned scene editor that reproduces the externally observable Seats.io designer workflows from blank canvas or image import through object editing and venue publish. The reference is inspected directly, but no reference code, SDK, key, asset, screenshot, or network dependency ships in TIG.

## Confirmed failure in the current implementation

The merged editor preloads a 2,322-seat theatre, keeps the chart library/template rail inside the editor, and treats tool IDs as parity. Its SVG objects have only partial geometry, selection handles, and inspectors. The passing baseline tests assert object types, labels, and source tokens, so they do not fail when the actual editor is visibly and behaviorally different.

## Surface architecture

1. `ChartLibrary` lists saved venue charts and launches a new or existing document.
2. `SeatDesigner` is a full-screen editor containing only top toolbar, tool rail, canvas, inspector, and transient dialogs/popovers.
3. `EditorDocument` is renderer-independent and serializable. Every committed gesture produces one immutable document transaction.
4. `ToolController` owns activation, pointer sequence, live draft, completion, cancellation, cursor, and help for one tool mode.
5. `SceneCanvas` renders objects and a separate overlay for selection, resize, rotation, vertex, and draft handles.
6. `SelectionInspector` renders fields from the selected discriminated object type and applies typed commands.
7. Existing seat-chart draft/revision/venue publish APIs remain the persistence boundary; the browser never receives a service credential.

## Exact observed editor shell

- Top toolbar height: `45px`.
- Right inspector: `336px` total width with a `320px` sheet and `#f5f5f5` panel surface.
- Tool rail buttons: `35px` square in a `41px` rail.
- Blank canvas is white in light mode and fills all space between rail and inspector.
- Toolbar order: save/exit, editable name/status, preview/theme, undo/redo, snap, labels, alignment, flip, duplicate, copy, paste, delete, help.
- Bottom-left view controls: compass/home, zoom out, zoom in, and zoom status.
- Inspector changes with tool and selection. Empty select state shows chart name, categories, and focal-point status.

## Initial and image-first flow

- A new chart is created only after selecting a TIG venue and chart name.
- The document starts with zero scene objects and the select tool active.
- The empty canvas exposes `이미지 불러오기`; the image tool exposes the same action at any time.
- Accepted types are PNG, JPEG, GIF, WEBP, and SVG, maximum 10 MB after boundary validation.
- Imported files are sanitized by the existing asset boundary, become an editable image object, preserve aspect ratio initially, and expose position, width, height, opacity, rotation, lock, layer, replace, and delete.
- Image upload failure leaves the document unchanged and renders an adjacent retryable error.

## Tool contract

| Family | Modes | Creation and default contract |
| --- | --- | --- |
| Select | Select `V`, seats `X`, brush `C`, same type `Z` | click, shift-toggle, marquee/brush drag, parent-independent seat selection, compatible-type expansion |
| Node | Node `A` | drag node; click side to add; secondary click node to remove; reject fewer than valid minimum vertices |
| View | Focal `F`, hand `Space` | click to set focal point; drag to pan; space temporarily pans from another tool |
| Row | Row, segmented row, multiple rows `R` | straight drag; multi-click segmented path ending on last seat; repeated parallel rows; default row spacing 14 pt and seat spacing 5 pt; Shift angle snap; Alt disables snap |
| Section | Section `S` | polygon node insertion and completion, nested contents, editable nodes and label/category |
| Table | Round and rectangular `E` | round click default 6 chairs; rectangular drag/default 4 top, 4 bottom, 0 left, 0 right at 120x36 pt |
| Booth | Booth `B` | click/drag placement, default 50x50 pt, editable size/rotation/category/label |
| Area | Rectangular, elliptic, polygonal `G` | drag rectangle/ellipse, multi-click polygon, Shift proportional constraint, Alt disables snap |
| Shape | Rectangle, ellipse, polygon `H` | same creation families with fill/stroke/opacity/rotation/layer fields |
| Line | Line `L` | multi-click nodes, secondary click removes last, Enter commits, Shift snaps 45 degrees, Alt disables snap |
| Text | Text `T` | click placement, immediate text edit, font size/weight/alignment/color/rotation/layer |
| Image | Image `I` | upload/drop then drag placement; PNG/GIF/JPEG/WEBP/SVG up to 10 MB |
| Icon | Icon `O` | click placement, TIG-owned icon gallery, default size 40 pt, color/rotation/layer |

Every creation mode has an in-canvas preview. `Escape` cancels the draft without history. A valid commit selects the new object and creates exactly one undo step. Invalid or undersized geometry creates nothing.

## Selection and transform contract

- Selected objects show a visible bounding outline, corner resize handles, and a rotation handle.
- Polygonal objects expose vertex handles only in node mode; edge handles insert vertices.
- Dragging one selected object moves all selected objects while preserving relative geometry.
- Resize, rotation, alignment, horizontal/vertical flip, nudge, duplicate, copy/paste, delete, and inspector changes are single undoable transactions.
- Locked objects render but do not select or mutate. Layer filters affect hit testing, marquee, same-type selection, and brush selection.
- Undo/redo restore the document, selection, and inspector deterministically. A new commit clears redo history.

## Inspector contract

- Empty selection shows document name, category manager, place count, and focal-point status.
- Tool-active creation state shows its observed instructions and defaults.
- One selected object shows common label/category/floor/zone/layer/lock/rotation fields plus type-specific geometry.
- Multiple selections show only shared editable fields and a mixed-value state.
- Numeric input is parsed once, rejects non-finite data, clamps only documented bounds, and never writes partial invalid geometry.
- Row, section, table, booth, area, shape, line, text, image, and icon inspectors are independent components rather than branches in one monolith.

## Persistence and publish

- Draft autosave and explicit save preserve current venue binding and optimistic revision.
- Publish validates the current draft and atomically activates a new immutable revision for the bound venue.
- Linked shows resolve the venue's active revision; the editor never stores or asks for a show binding.
- Service keys remain optional server-to-server credentials. Admin browser save/publish uses the existing administrator session.
- The protected Kakao, Naver, and Google simple-login boundary remains byte-unchanged.

## Completion evidence

- Pure tests cover every tool controller, geometry variant, transaction, serialization, and invalid boundary.
- Browser tests perform real pointer and keyboard actions for every mode and assert observable object/handle/inspector results.
- Manual QA repeats the reference and TIG action ledger at desktop and compact widths; no row is passed from label/source presence.
- Visual QA covers blank, image imported, tool active, object selected, node edit, multi-select, dark scheme, preview, save failure, validation failure, and venue-published states.
- Final gates are lint, typecheck, build, focused/full seat-chart tests, protected-auth diff, PR CI/review, merge, and a merged local admin browser left open.
