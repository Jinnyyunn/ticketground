# Native iOS API contract: virtual fixture mode

Status: `virtual` / `fixture-only` / `non-live`

This manifest is a user-authorized substitute for live backend characterization because no separate backend is available in the iOS worktree. Its values are deterministic virtual values for Todo 3 model and decoding work. They are not observed backend responses, do not establish native authentication, and must never be presented as live availability or account state.

## Authorization and gates

- Authorization: explicit user override for fixture-only implementation on 2026-07-14.
- Owner sign-off: not provided. This document is not an owner-signoff receipt.
- Live characterization: blocked; the prior production/dev runtime receipts remain preserved under `.omo/evidence/native-ios/w0/2/blocked/`.
- Authentication: disabled in fixture mode. The `fixture-scenario` selector is the only transport switch.
- Persistence: bundled fixtures only. No request mutates a backend or shared database.
- Determinism: fixed clock `2026-07-13T00:00:00Z`, fixed seed label, and no randomness.

## Endpoint surface

| Method | Path | Fixture | Success shape | Auth |
| --- | --- | --- | --- | --- |
| GET | `/api/state` | `state.json` | raw object with events, venues, users, tickets, resalePools, summary, ledger | none |
| GET | `/api/events/{eventId}/seat-map` | `seat-map.json` | raw event/map/zones object | none |
| GET | `/api/users/{userId}/session` | `session.json` | raw user/authenticated/source object | none |
| GET | `/api/users/{userId}/tickets` | `tickets.json` | raw ticket array | none |
| POST | `/api/tickets/buy` | `purchase.json` | raw ticket/event/date/payment/admission object | none |
| POST | `/api/tickets/virtual-qr` | `virtual-qr.json` | raw virtual QR object | none |

`/api/state` intentionally includes `venues`, `users`, and ticket `virtualQr` as modeled fields. Nullable fields are explicit in the JSON manifest; additive fields are rejected unless an endpoint allowlist names them. The fixture manifest is the only source for Todo 3 fixture decoding in this mode.

## Negative probes

`negative-probes.json` records deterministic, non-live expectations for malformed JSON, unallowlisted keys, null required fields, empty responses, and unauthorized access. These are validation inputs, not claims that the virtual transport has contacted or characterized the backend.

## Consumption rule

Todo 3 may consume these fixtures only behind an explicit fixture-mode/data-source marker. A future live adapter requires a new authoritative characterization and real owner sign-off before it can be enabled.
