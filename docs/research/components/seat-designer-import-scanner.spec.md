# Reference Import and Scanner Specification

## Import

- JPG/PNG become sanitized trace overlays.
- PDF requires an explicit page choice and rasterizes that page.
- MIME, dimensions, decoded pixel count, and file size are boundary-validated.
- Metadata and active SVG content are removed.

## Scanner

1. upload a sanitized reference;
2. configure threshold, diameter range, and row-angle tolerance;
3. run a worker off the main thread;
4. preview accepted and rejected candidates with confidence/reason;
5. allow inclusion/exclusion and row-label correction;
6. accept once to create typed rows as one transaction.

Zero candidates, cancellation, worker error, and oversized input are explicit recoverable states.
