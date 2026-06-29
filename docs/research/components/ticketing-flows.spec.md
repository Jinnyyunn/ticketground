# Ticketing Flow Component Spec

## Data Contract

`src/data/ticketing.ts` owns representative show records and reservations. Every show record provides:

- `slug`, `code`, `category`, `title`, `shortTitle`.
- `venue`, `period`, `runtime`, `ageLimit`, `poster`.
- `prices`, `schedules`, `casts`, `notices`, `summary`.

The app intentionally uses local data so the clone remains deterministic in browser QA.

## Shared Components

- `PageShell`: local header/footer wrapper for subpages.
- `ShowCard`: compact catalog card for genre, ranking, search, venue, and account surfaces.
- `BookingPanel`: client-side date/time/seat selector and missing-selection guard.
- `CheckoutPanel`: client-side mock login/payment/agreement form and confirmation link.
- `InquiryForm`: client-side support form with required-field validation.
- `LoginPanel`: standalone mock NOL members login page.

## Acceptance Evidence

ULW evidence is stored under:

`.omo/ulw-loop/565347d5-2447-4b32-b4d3-bab65d550e9f/evidence/`

The evidence set includes browser JSON results and screenshots for the happy path, edge path, and regression path.
