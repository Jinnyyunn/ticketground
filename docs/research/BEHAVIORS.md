# NOL Ticket Behavior Notes

Source: Aside browser inspection on 2026-06-28.

## Discovery

- The homepage is organized around hero promotions, genre ranking, opening-soon items, NOL PLAY, discount/time-deal shelves, MD picks, recommended keywords, and reviews.
- Genre pages use a catalog/ranking layout with tabs and product cards. Product records carry poster, title, venue, run period, rank/badge, and sale status.
- Search supports an empty state for no results and exposes popular keyword chips.

Clone mapping:

- Existing homepage sections now expose `data-section` markers for regression checks.
- Local cards link into representative product detail pages instead of external goods links.
- Search uses local representative data and popular keyword chips.

## Product Detail

The live `L0000142` detail page includes:

- Poster, title, venue, run period, runtime, age limit.
- Price tiers.
- Cast and notice blocks.
- Date/time selection around a calendar module.
- Booking CTA that hands off to an authenticated popup flow.

Clone mapping:

- `/goods/dracula` is the full reference detail page.
- The booking CTA sends users through `/queue/dracula` and then `/booking/dracula`.
- Additional representative goods reuse the same data model for genre/search/ranking coverage.

## Booking

The live unauthenticated booking popup is gated by account state, so the clone implements the front-end ticketing path as a local mock:

- Queue/waiting page.
- Date and time selection.
- Seat selection with one unavailable seat.
- Guard message when the user tries to pay before selecting required values.
- Checkout handoff after valid selection.

## Login And Checkout

The live auth surface uses Yanolja/NOL account login with social actions and an email/password step. The clone implements:

- Standalone `/login` with social buttons and email/password fields.
- Standalone `/signup` with mock NOL members signup fields.
- `/checkout/[slug]` with member login fields, payment method selection, agreement checkbox, and a mocked confirmation handoff.
- Confirmation route `/reservation/TG-260710-001` and linked my-page summary.

No real authentication, payment capture, or member data is transmitted.

## Support

The live ticket inquiry page contains reservation lookup, inquiry type, title, body, file upload, and required-field guidance.

Clone mapping:

- `/support/inquiry` implements reservation lookup affordance, inquiry type, title, body, file upload styling, and blank-submit validation.

## Verification Targets

- Happy path: home -> genre -> detail -> queue -> booking -> checkout -> confirmation -> my page.
- Edge path: booking guard, search empty state, inquiry blank-submit validation.
- Regression path: homepage sections and local header links remain present.
