# Ticketground Design System

## Open Design Alignment
Ticketground uses this file as the project design contract, following the Open Design idea that a portable `DESIGN.md` should carry visual direction, brand choices, component rules, and QA criteria into the public ticketing surface and the operations console.

## Product Intent
Ticketground should feel like a major ticketing service with a slightly modern edge: familiar, dense enough for repeated booking work, visually confident, and free of decorative clutter that makes ticket selection harder.

## Surfaces
- Public ticketing surface: event discovery, date-first booking, seat selection entry, resale, My tickets, virtual/admission QR, and customer support.
- Operations console: overview metrics, account moderation, ticket sale setup, venue/seat-map preview, customer support queue, and audit visibility.

## Brand Personality
- Trustworthy before playful.
- Commercial ticketing density over landing-page spectacle.
- Modern through crisp tokens, spacing, and interaction states rather than soft editorial decoration.
- Korean ticketing vocabulary should stay direct, short, and action-oriented.

## Core Tokens
- `color.ink=#141416`
- `color.muted=#69707d`
- `color.surface=#f4f6f8`
- `color.card=#ffffff`
- `color.border=#dfe4eb`
- `color.border.strong=#b9c1cc`
- `color.action=#ffd400`
- `color.danger=#d9291f`
- `color.info=#146eb4`
- `color.success=#168050`
- `radius.surface=8px`
- `radius.control=6px`
- `radius.pill=999px`
- `shadow.raised=0 14px 34px rgba(20,20,22,0.10)`
- `shadow.resting=0 6px 16px rgba(20,20,22,0.07)`
- `font.primary=Noto Sans KR, Inter, Pretendard, Segoe UI, system-ui, sans-serif`

## Layout Rules
- The public hero may be full-bleed, but booking, catalog, support, and My surfaces must use constrained content width.
- Cards and panels must use 8px radius or less unless the element is a pill, avatar, or status badge.
- Page sections must not look like nested decorative cards; repeated items can be cards.
- Public mobile navigation must collapse without horizontal scrolling.
- Operations console tables must preserve scan density and use horizontal table overflow only inside table wrappers.

## Public Components
- Header: sticky, white, compact, with clear route state and account summary.
- Hero: product/event first, real image background, readable overlay, no gradient or bokeh ornament layers.
- Event cards: image, sale status, metadata, price/remaining-state copy, and one obvious action.
- Booking widget: date-first progression; seat/payment controls appear only after the user advances.
- QR panel: virtual ticket and admission QR must look distinct; admission QR copy must stress timed refresh.
- Support chat: compact floating access plus a full customer-center page route.

## Admin Components
- Console tabs: sticky on desktop, static on mobile, high contrast active state.
- Metric cards: compact labels with large numeric values.
- Tables: predictable rows, visible status pills, no marketing-style spacing.
- Forms: labels above controls, 46px controls, strong focus ring, explicit save/confirm flows.
- Support queue: selected state must be obvious and readable at a glance.

## Interaction States
- Buttons must define default, hover, focus-visible, disabled, and active states.
- Primary actions use `#ffd400`; destructive/admin blocking actions use red; confirmation/safe actions can use green.
- Disabled booking or QR actions must expose why in nearby copy when the user may reasonably expect them to work.
- Focus indicators must be visible and not depend on color alone.

## Accessibility
- Target WCAG 2.2 AA contrast for text and controls.
- Do not hide focus-visible outlines.
- Interactive targets should be at least 44px tall on touch surfaces.
- Long Korean labels must wrap cleanly inside buttons, tabs, cards, and table cells.
- Motion must not be required to understand route or booking state.

## Content Standards
- Use direct action labels: `예매하기`, `좌석선택완료`, `판매 정보 저장`, `입장 QR 발급`.
- Avoid explanatory in-app text that describes the UI design itself.
- Use operational nouns in admin: `상태`, `신뢰 점수`, `제재`, `대기자`, `원장`.
- Public copy should reduce uncertainty around booking order, payment, QR timing, resale rules, and support responses.

## Anti-Patterns
- Do not use purple/blue gradients as the dominant theme.
- Do not use decorative radial blobs, floating orbs, or soft editorial backgrounds on task surfaces.
- Do not use large card radii for ticketing controls.
- Do not expose admin navigation on the public port.
- Do not place seat/payment controls below date selection before the booking action opens the next step.
- Do not present the virtual ticket QR as a valid admission QR.

## QA Checklist
- Public desktop and mobile have no horizontal overflow.
- Admin desktop and mobile have no horizontal overflow.
- Public and admin card radii max at 8px except pills/statuses/avatars.
- CSS and JS cache versions are bumped after visual system changes.
- `node --check server.js`, `node --check public/app.js`, test suite, and `git diff --check` pass before handoff.
