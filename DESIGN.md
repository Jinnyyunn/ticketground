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
