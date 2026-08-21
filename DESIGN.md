# Ticketground Design Notes

> Theme policy: Ticketground supports light/dark/system themes. The default is `system`, persisted through `localStorage["ticketground:theme"]` only after controls set an explicit preference. The bootstrap script resolves the active mode before route content renders and writes the resolved `light` or `dark` value to `<html data-theme>`.
> Font policy: Pretendard Variable is the preferred self-hosted face, but no font binary is present in this repository. Add `src/app/fonts/PretendardVariable.woff2`, then enable `next/font/local` in `src/app/layout.tsx` with `variable: "--font-pretendard"`.

## Intent
Ticketground screens must feel like a dense Korean ticketing service: functional, compact, high-trust, and fast to scan.

## Tokens
- Use the semantic tokens from `src/app/globals.css`: `ticketground`, `ink`, `surface`, `line`, `ok`, `warn`, and tier colors.
- Do not introduce new raw color systems for service/API states. Use `bg-surface`, `border-line`, `text-ink-3`, `text-ticketground`, `text-ok`, and `text-warn`.
- Use semantic foreground tokens for reversed contrast states. `text-on-ink`, `text-on-ink-2`, `text-on-tier-*`, and `text-on-accent-2` are the dark-mode-safe companions for `bg-ink`, `bg-ink-2`, tier backgrounds, and the fixed bright `bg-accent-2` card.
- Use `scrim` with fixed white foreground utilities for image/poster overlays that need fixed dark contrast. Do not use theme-inverting `ink` gradients or `text-on-ink` foregrounds for photo scrims.
- Keep component radii at `8px` to `12px` unless an existing primitive already uses a different token.

## Layout
- Preserve the current public-page chrome and constrained `ticketground-container` width.
- Cards should stay compact, bordered, and single-layered. Do not place decorative cards inside other cards.
- Korean labels in nav, shortcuts, and action buttons must avoid awkward wrapping. Prefer short labels such as `재판매` in tight slots and `공식 재판매` in page titles.

## Admin Shell
- The admin console uses one persistent operations shell: a compact bordered sidebar at desktop widths and a toggleable menu below `768px`. Each menu item owns one focused workspace URL under `/console/<workspace>`; do not recreate the former all-panels dashboard.
- Admin surfaces use the existing `surface`, `line`, `ink`, `ok`, and `warn` tokens with `8px` radii. Workspace content is a single bordered working surface, with no decorative nested-card hierarchy.
- The mobile menu button exposes its state with `aria-expanded`; the menu closes after navigation and on `Escape`. Keep each workspace usable at `390px` without horizontal scrolling.
- Mutation feedback stays beside the active workspace action, in Korean, and in an `aria-live="polite"` region. Access-denied states explain the missing permission without attempting to load that workspace's data.

## Seat Designer

- `/admin/seat-designer` is a clean-room editor, not an extension of the retired TIG designer. The route imports only `seat-designer-v2`; no v1 toolbar, canvas, geometry engine, inspector, template rail, or tool definition may render in the new surface.
- The editor frame follows the observed reference exactly: a compact title/action bar, `42px` vertical tool rail, fluid white drawing canvas, `336px` contextual inspector, bottom gesture help strip, and bottom-left pan/zoom control. Tool buttons, flyouts, disabled states, active blue treatment, dividers, and inspector rows are reusable v2 primitives.
- New charts begin with the reference-plan import step. PNG, JPEG, GIF, WEBP, SVG, and PDF are accepted; the chosen venue plan is fitted to the canvas as a locked tracing layer before drawing begins. `빈 캔버스` remains a secondary explicit choice, never the default path.
- The tracing layer is independent from buyer-visible images. It supports fit, opacity, lock/unlock, show/hide, replace, scale, rotate, and remove without becoming a selectable seat object or leaking its local filename to public chart data.
- Row creation is a single observable contract: click-drag live seats, infinite extension guides, live seat-count badge, `Shift` 15-degree constraint, `Alt` snap bypass, right-rail row/seat spacing steppers, bottom gesture help, Escape cancel, and one undoable commit.
- Tool completion is behavioral. A tool is not present merely because its icon or label exists: click/shortcut activation, cursor/help state, creation gesture, live preview, commit/cancel, selected handles, contextual fields, undo/redo, copy/duplicate/delete, and serialized output must all work.
- Tool groups mirror the reference interaction model: row / segmented row / multiple rows / section; round / rectangular table; rectangular / elliptic / polygonal area; rectangle / ellipse / polygon; line; text; image; icon; focal point; select; seat select; brush; same-type; node; and hand.
- Reference defaults are first-class tokens: row spacing `14pt`, seat spacing `5pt`, round table `6` chairs, rectangular table `4/4/0/0` chairs at `120x36pt`, booth `50x50pt`, and icon `40pt`.
- Shape selection exposes real resize, rotation, vertex, and side-insertion handles. The node tool moves vertices, inserts a vertex on an edge, and removes a vertex while rejecting invalid geometry.
- The buyer-visible state changes only through venue publish. Saving edits creates/updates a draft; publishing atomically activates the chart for its bound venue. No show-specific chart binding is introduced.
- Seats.io remains a behavior and visual reference only. TIG does not ship its SDK, runtime, code, account identifiers, keys, fonts, icons, assets, screenshots, or network calls.

## States
- Backend-backed controls must show loading, success, and error text near the action that caused the state.
- Disabled controls must use existing muted surface tokens and remain readable.
- API evidence should be visible to users as concise status copy, not developer-oriented endpoint descriptions.

## Accessibility
- Interactive controls must be keyboard reachable and preserve visible focus rings.
- Dynamic API result regions should use `aria-live="polite"` when user actions update status.
- Mobile and tablet layouts must avoid horizontal overflow at 390px and 768px widths.

## Theme Exceptions
- Preserve poster gradients and Kakao/Naver brand colors as content and brand identity colors; do not invert or token-recolor them for dark mode.
- Preserve `queue-waiting-room.tsx` as a special waiting-room surface for now. It is already designed as a dark queue experience, so P6 should not absorb it into global dark tokens until a separate visual redesign validates that surface.

## Issue Guidance
- Issue #2 resale entry points should be visible on the home page and footer without crowding the header.
- Issue #3 backend status should be surfaced through the affected public workflows: login/session, booking/seat map, checkout/purchase, mypage/tickets/QR, resale, transfer, watchlist, and inquiry.
