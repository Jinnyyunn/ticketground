# NOL Ticket Page Topology

Source: live Aside inspection of `https://nol.interpark.com/ticket`, `https://tickets.interpark.com/contents/genre/musical`, `https://tickets.interpark.com/goods/L0000142`, auth/search/support pages, plus the existing homepage extraction in `docs/research/nol.interpark.com/content.json`.

## Scope Boundary

The real service has large catalog data and authenticated back-office flows. This clone implements the ticketing product surface and representative transactional paths with local mock data. It does not implement every individual performance page.

Representative records:

- Musical detail and purchase path: `dracula`, based on live detail page `L0000142`.
- Time-deal musical: `beethoven`.
- Concert/festival: `palette-festival`.
- Exhibition/event: `banksy`.

## Implemented Routes

| Live surface | Clone route | Purpose |
| --- | --- | --- |
| NOL Ticket home | `/` | Existing cloned landing page with local navigation hooks. |
| Genre listing | `/contents/genre/[genre]` | Category catalog grid, ranking/tabs, representative products. |
| Search | `/contents/search?q=...` | Query results, empty state, popular keywords. |
| Goods detail | `/goods/[slug]` | Poster, venue, period, price table, casts, notices, calendar, booking CTA. |
| Waiting/queue | `/queue/[slug]` | Ticketing waiting room handoff before seat selection. |
| Booking | `/booking/[slug]` | Date, time, seat selection, guard for missing selections. |
| Checkout | `/checkout/[slug]` | Mock member login, payment method, agreement, order summary. |
| Reservation complete | `/reservation/[id]` | Confirmation details and next actions. |
| My page | `/mypage` | Reservation summary and account-oriented quick actions. |
| Login | `/login` | NOL members social/email login reference. |
| Signup | `/signup` | Mock NOL members signup form. |
| Support inquiry | `/support/inquiry` | Required-field validation and reservation lookup affordance. |
| Ranking | `/contents/ranking` | Ranking entry point tied to representative shows. |
| Region | `/contents/region` | Regional discovery entry point. |
| Venue | `/place` | Venue discovery entry point. |
| Notice | `/contents/notice` | Service notices. |
| NOL Day event | `/event/nolday` | Promotion/event entry point. |
| Cancellation guide | `/cancel` | Booking cancellation/refund guide. |

## Header And Footer Links

The live header exposes genre tabs, ranking, opening soon, regional discovery, venue discovery, search, login, and my page. The clone routes these to local pages so browser QA can traverse the same product shell without leaving the app.

The live footer exposes customer-center actions such as notices, one-to-one inquiry, cancellation/refund policy, terms, and privacy. The clone links the high-value ticketing actions to local pages and keeps legal/support-only links as inert placeholders where no ticketing behavior was requested.

## Not Implemented

- Real identity, phone verification, or account creation.
- Real payment gateway authorization, refunds, or receipt issuance.
- Live seat map inventory synchronization.
- Full catalog import for every performance, venue, region, and show.

Those boundaries preserve the requested clone behavior while keeping implementation size proportional to a representative ticketing system.
