# Issue 62 Event ID Mapping Evidence

Worktree: `/tmp/ticketground-issue-worktrees/issue-62-event-id-mapping`
Branch: `fix/issue-62-event-id-mapping`

## RED Proof

- Scenario: source proof that booking and checkout consumers used the default backend event.
- Invocation: `rg -n "getSeatMap\\(DEMO_EVENT_ID\\)|ticket\\.eventId === DEMO_EVENT_ID|DEMO_EVENT_ID" src/components/ticketing src/lib/ticketground-api.ts`
- Observable: `booking-panel.tsx` called `getSeatMap(DEMO_EVENT_ID)` and `checkout-panel.tsx` filtered `ticket.eventId === DEMO_EVENT_ID`.
- Artifact: `.omo/evidence/issue-62-event-id-mapping/red-source-hardcoded.txt`

- Scenario: runtime proof that two different booking pages both fetched the default event.
- Invocation: Playwright browser script against `booking/les-miserables` and `booking/palette-festival`.
- Observable: both pages requested `/api/seat-map?eventId=event_kpop_001`.
- Artifact: `.omo/evidence/issue-62-event-id-mapping/red-runtime-two-booking-pages.json`

- Scenario: failing-first regression test.
- Invocation: `node --test tests/event-id-mapping.test.mjs`
- Observable: expected `event_musical_001` / `event_festival_001`, actual `event_kpop_001`.
- Artifact: `.omo/evidence/issue-62-event-id-mapping/red-regression-test.txt`

## Green Verification

- Scenario: regression coverage for booking and checkout event mapping.
- Invocation: `node --test tests/event-id-mapping.test.mjs`
- Observable: `2` tests passed, `0` failed.
- Artifact: `.omo/evidence/issue-62-event-id-mapping/green-regression-test.txt`

- Scenario: TypeScript compile check.
- Invocation: `npm run typecheck`
- Observable: `typecheck_status=0`.
- Artifact: `.omo/evidence/issue-62-event-id-mapping/typecheck.txt`

- Scenario: production build.
- Invocation: `npm run build`
- Observable: `build_status=0`, `✓ Compiled successfully`, `67/67` static pages generated.
- Artifact: `.omo/evidence/issue-62-event-id-mapping/build.txt`

- Scenario: browser and HTTP QA for two booking pages.
- Invocation: Playwright browser script plus direct `fetch` to `/api/seat-map`.
- Observable: `booking/les-miserables` requested/displayed `event_musical_001` / `Midnight Sonata`; `booking/palette-festival` requested/displayed `event_festival_001` / `Tig Summer Beat Festival`; both HTTP probes returned `200`.
- Artifacts:
  - `.omo/evidence/issue-62-event-id-mapping/browser-http-qa.json`
  - `.omo/evidence/issue-62-event-id-mapping/qa-booking-les-miserables.png`
  - `.omo/evidence/issue-62-event-id-mapping/qa-booking-palette-festival.png`
