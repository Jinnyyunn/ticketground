# Mobile operations admin implementation plan

## Goal

Extend the existing responsive web admin with operational controls for both native applications.

## Work units

1. Add a mobile operations workspace with app-version policy, maintenance notices, push campaigns, device trust/revocation, admission QR audit, cancellation requests, and payment/refund reconciliation.
2. Reuse the existing admin session and ACL model; add least-privilege permissions for each mutation and preserve CSRF protection.
3. Add immutable audit records, idempotent mutations, pagination/filtering, explicit loading/empty/error states, and secret/PII redaction.
4. Verify mobile, tablet, and desktop layouts in a real browser and cover critical admin actions with backend and browser tests.
5. Publish through an admin-specific PR and merge only after review and CI.

## Non-goals

- Embedding provider secrets or raw device tokens in browser payloads.
- Treating a cancellation request as an automatic refund without an authorized operator decision.
