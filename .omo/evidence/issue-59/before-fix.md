# Issue 59 Pre-fix Evidence

Captured after merging `origin/main` into `fix/issue-59-venue-routes` and before the issue-specific fix.

Command summary:

```bash
node --input-type=module <playwright probe>
```

The probe started `server.js` on a random temporary port that was not `5500` or `5501`, opened Chromium, read the venue links on detail pages, then visited the captured hrefs.

Observed output:

```json
{
  "baseUrl": "http://127.0.0.1:61332",
  "results": [
    {
      "slug": "les-miserables",
      "expectedVenue": "블루스퀘어 신한카드홀",
      "expectedPath": "/place/blue-square",
      "mainHref": "/place/blue-square",
      "mainText": "BLUE SQUARE 공연장 상세 보기",
      "sideHref": "/place",
      "mainRouteResult": {
        "path": "/place/blue-square",
        "heading": "블루스퀘어 신한카드홀"
      },
      "sideRouteResult": {
        "path": "/place",
        "heading": "블루스퀘어 신한카드홀"
      }
    },
    {
      "slug": "iu-world-tour",
      "expectedVenue": "잠실종합운동장 주경기장",
      "expectedPath": "/place/jamsil-olympic-main-stadium",
      "mainHref": "/place",
      "mainText": "잠실종합운동장 주경기장 공연장 상세 보기",
      "sideHref": "/place",
      "mainRouteResult": {
        "path": "/place",
        "heading": "블루스퀘어 신한카드홀"
      },
      "sideRouteResult": {
        "path": "/place",
        "heading": "블루스퀘어 신한카드홀"
      }
    }
  ]
}
```

Findings:

- Blue Square main detail venue link resolves to `/place/blue-square`, but the booking-panel seat-preview link still points at `/place`.
- IU World Tour uses the Jamsil main stadium venue string on the detail page, but both venue links point at `/place`.
- Visiting `/place` renders `블루스퀘어 신한카드홀`, so IU/Jamsil venue links route to the wrong venue content.

Regression test red phase:

```text
Command: node --test --test-concurrency=1 tests/detail-venue-routes.test.mjs
Result: failed

AssertionError [ERR_ASSERTION]: les-miserables seat preview href
+ actual - expected

+ '/place'
- '/place/blue-square'
         ^
```
