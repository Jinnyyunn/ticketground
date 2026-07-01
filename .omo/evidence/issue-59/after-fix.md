# Issue 59 After-fix Evidence

Verification was run after the venue route/data fix.

## Automated checks

```text
node --test --test-concurrency=1 tests/detail-venue-routes.test.mjs
pass 1, fail 0
```

```text
npm run typecheck
tsc --noEmit exited 0
```

```text
npm run build
next build exited 0
/place/[slug] generated:
- /place/blue-square
- /place/lg-arts-center
- /place/sac-concert-hall
- /place/jamsil-olympic-main-stadium
```

```text
npm test
tests 41
pass 41
fail 0
duration_ms 184393.724375
```

## Browser-click QA

Command summary:

```bash
NODE_ENV=production node server.js on temporary public port 51175 and admin port 51176
node --input-type=module <playwright click probe>
```

The probe opened Chromium and clicked both the main venue CTA and the booking-panel seat-preview link for Blue Square and IU/Jamsil.

Observed output:

```json
{
  "baseUrl": "http://127.0.0.1:51175",
  "publicPort": 51175,
  "adminPort": 51176,
  "clicks": [
    {
      "slug": "les-miserables",
      "linkName": "main venue CTA",
      "href": "/place/blue-square",
      "reachedPath": "/place/blue-square",
      "heading": "블루스퀘어 신한카드홀"
    },
    {
      "slug": "les-miserables",
      "linkName": "seat preview link",
      "href": "/place/blue-square",
      "reachedPath": "/place/blue-square",
      "heading": "블루스퀘어 신한카드홀"
    },
    {
      "slug": "iu-world-tour",
      "linkName": "main venue CTA",
      "href": "/place/jamsil-olympic-main-stadium",
      "reachedPath": "/place/jamsil-olympic-main-stadium",
      "heading": "잠실종합운동장 주경기장"
    },
    {
      "slug": "iu-world-tour",
      "linkName": "seat preview link",
      "href": "/place/jamsil-olympic-main-stadium",
      "reachedPath": "/place/jamsil-olympic-main-stadium",
      "heading": "잠실종합운동장 주경기장"
    }
  ]
}
```
