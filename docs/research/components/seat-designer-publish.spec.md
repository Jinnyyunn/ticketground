# Venue Publish Specification

## Preconditions

- Authenticated seat-chart administrator and valid CSRF/session boundary
- Selected TIG venue with stable venue ID
- Expected draft revision equals server draft revision
- Blocking validation errors are empty

## Transaction

Write immutable content-addressed revision first, verify it, then atomically replace the venue active pointer. A failure before pointer replacement leaves the former revision active. The chart stores no show slug.

## Retrieval

- Venue route returns active `chartKey` and `revisionId`.
- Version route returns a sanitized immutable document with ETag support.
- Performance route combines venue chart identity with current pricing and availability.
- No active chart produces `공연장 좌석 배치도 준비 중` and no selectable seat controls.
