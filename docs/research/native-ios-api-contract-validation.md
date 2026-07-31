# Virtual fixture validation

The validation command is intentionally local and non-live:

```sh
node scripts/validate-ios-virtual-fixtures.mjs
```

It parses the manifest and every declared JSON fixture, requires `mode: virtual`, `source: fixture-only`, `live: false`, deterministic markers, explicit endpoint field lists, and all five negative probes. It never starts Node `server.js`, calls an endpoint, reads a shared database, or asserts owner approval.

Red-first evidence for this Todo 2 change: before the artifacts existed, the command failed with `missing artifact: docs/research/native-ios-api-contract.json` and status 1. The green result is valid only for fixture integrity; it does not clear the live-contract or owner-signoff gates.

Malformed, unknown-key, null-required-field, empty, and unauthorized cases are represented in `ios/TicketGroundApp/Fixtures/Backend/negative-probes.json`. They are deterministic expected outcomes, not live observations.
