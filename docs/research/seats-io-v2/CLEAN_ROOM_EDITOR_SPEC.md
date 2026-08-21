# TIG Seat Designer V2 Clean-room Contract

## Boundary

- Replace the current editor component tree and geometry engine. Do not wrap or restyle v1.
- Preserve only TIG venue selection, draft persistence, publication, public revision, and service-credential APIs.
- Observe Seats.io through the user-authorized browser session. Do not copy source, SDK code, account identifiers, fonts, logos, or proprietary assets.

## First action

1. Choose a TIG venue.
2. Upload the venue plan as PNG, JPEG, GIF, WEBP, SVG, or PDF.
3. Fit it to the scene as a locked reference layer.
4. Enter the editor with the Row tool ready.
5. Allow an explicit secondary `빈 캔버스` path.

## Editor anatomy

- Top title/action bar: title, draft state, preview, light scheme, undo/redo, snap, labels, alignment, duplicate/copy/paste/delete, help.
- Left rail: Select, seat select, brush, same-type, node, focal, Row group, Table group, Area group, Booth, Shape group, Line, Text, Image, Icon, Hand.
- Canvas: white infinite plane, reference overlay, guides, live creation preview, selected handles.
- Right rail: tool defaults when creating, object properties when selected, chart validation otherwise.
- Bottom strip: active tool name plus exact pointer/modifier/keyboard contract.

## Row reference state

- Straight row, segmented row, and multiple-row flyout.
- Default row spacing `14 pt`; seat spacing `5 pt`.
- Drag shows seats immediately, extends construction lines beyond endpoints, and displays the current count in a black badge.
- `Shift` constrains to 15 degrees. `Alt` bypasses snapping. Escape cancels.
- Segmented Row completes by clicking its last seat again or pressing `Enter`.
- Multiple Rows uses two gestures: draw one base row, then drag perpendicular to it to choose direction and live row count. `aligned` and half-seat `staggered` layouts are available.
- Smart guides use red for matching centers, blue for projected bounds, and green for the active drawing axis. Holding `Alt` hides node insertion handles as well as bypassing snap.

## Hierarchy and properties

- Floors keep editable name and abbreviation values and switch the visible editing scope without deleting other floors.
- A Section can be entered as an independent interior scope and exited through the floor breadcrumb.
- A selected seat exposes buyer label, wheelchair, companion, transfer-seat, and restricted-view properties.
- Reference and object images preserve their source ratio by default. Reference imports accept up to `15 MB`.
- Multi-selection supports edge/center alignment plus horizontal and vertical equal distribution.
- Help opens a complete tool and keyboard reference rather than acting as a decorative button.
- Grid visibility and snapping are independent. Theme, labels, section-content visibility, horizontal/vertical flip, and temporary `Space` pan remain available as global editor commands.
- Mobile keeps the inspector and selected-object commands in a responsive property drawer, and the complete active-tool help reflows instead of clipping.
- Editor colors, selection states, guide colors, surfaces, borders, and elevation consume shared semantic `--editor-*` tokens; persisted object defaults are centralized in `design-tokens.ts`.

## Shape defaults

- Round table and rectangular table (`4/4/0/0`, `120 x 36 pt`).
- Rectangular, elliptic, and polygonal general-admission areas.
- Booth (`50 x 50 pt`).
- Rectangle, ellipse, polygon, line, text, image, and icon (`40 pt`).
- All objects have native v2 selection, movement, resize/vertex handles, property editing, undo/redo, copy/paste, duplicate, and delete.

## Completion evidence

- A browser action test per tool family, including creation preview and committed geometry.
- Reference-plan upload is the first primary path and remains visible while tracing.
- Same-viewport reference and TIG captures for every tool/flyout/inspector state.
- Venue publish returns `200`; the linked public event resolves the published venue chart.
- Exact merged build deployed to `admin-dev`, then re-exercised in the authenticated browser.
