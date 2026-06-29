# Ticketground Design Notes

## Intent
Ticketground screens must feel like a dense Korean ticketing service: functional, compact, high-trust, and fast to scan.

## Tokens
- Use the semantic tokens from `src/app/globals.css`: `ticketground`, `ink`, `surface`, `line`, `ok`, `warn`, and tier colors.
- Do not introduce new raw color systems for service/API states. Use `bg-surface`, `border-line`, `text-ink-3`, `text-ticketground`, `text-ok`, and `text-warn`.
- Keep component radii at `8px` to `12px` unless an existing primitive already uses a different token.

## Layout
- Preserve the current public-page chrome and constrained `ticketground-container` width.
- Cards should stay compact, bordered, and single-layered. Do not place decorative cards inside other cards.
- Korean labels in nav, shortcuts, and action buttons must avoid awkward wrapping. Prefer short labels such as `재판매` in tight slots and `공식 재판매` in page titles.

## States
- Backend-backed controls must show loading, success, and error text near the action that caused the state.
- Disabled controls must use existing muted surface tokens and remain readable.
- API evidence should be visible to users as concise status copy, not developer-oriented endpoint descriptions.

## Accessibility
- Interactive controls must be keyboard reachable and preserve visible focus rings.
- Dynamic API result regions should use `aria-live="polite"` when user actions update status.
- Mobile and tablet layouts must avoid horizontal overflow at 390px and 768px widths.

## Issue Guidance
- Issue #2 resale entry points should be visible on the home page and footer without crowding the header.
- Issue #3 backend status should be surfaced through the affected public workflows: login/session, booking/seat map, checkout/purchase, mypage/tickets/QR, resale, transfer, watchlist, and inquiry.
