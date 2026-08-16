# Task 6 report: Android Compose customer-home parity

## Scope and outcome

- Base: `a04919b46310b55aae94b083b13104defc9f19a2`.
- Implemented native Compose opening, resale, genre, editorial, and shortcut sections in the required order on phone and expanded layouts.
- Added typed collection, opening-calendar, and public-resale destinations with system Back restoration.
- The public resale destination is read-only, makes no listing or purchase success claim, and routes its signed-in action to My Page.
- Removed the duplicate generic opening-calendar block. No `AndroidView` or `WebView` was added.
- Protected Google, Kakao, and Naver simple-login UI, config, OAuth, session, tests, environment files, and provider consoles were not edited.

## TDD evidence

### RED

Command (with Android Studio JDK and local Android SDK exported):

```text
./gradlew :app:connectedDevCustomerDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=kr.ticketground.app.TicketGroundAppShellTest
```

- The first environment attempts correctly stopped before tests because the host had no selected Java runtime and then no Android SDK path.
- After booting `ticketground_phone_api36`, the canonical RED ran 14 tests and failed 2, exit 1. The new parity test timed out on the deliberately missing `home-list` tag; the existing expanded-home assertion also exposed its stale direct lookup of the removed generic opening-calendar block.
- A focused formatting RED then ran 1 test and failed the expected `2026.08.14 20:00` assertion because the destination still rendered raw ISO text.

### GREEN

```text
node --test tests/mobile-home-parity.test.mjs
```

- Exit 0: 3 tests, 3 pass, 0 fail, 0 skipped (`duration_ms 51.032917`).

```text
./gradlew :app:connectedDevCustomerDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=kr.ticketground.app.TicketGroundAppShellTest
```

- Exit 0: 14 tests, 14 pass, 0 fail, 0 skipped; `BUILD SUCCESSFUL in 28s`; 72 tasks (1 executed, 71 up-to-date). XML totals were independently parsed.

```text
./gradlew :app:testDevCustomerDebugUnitTest
```

- Exit 0: 68 tests across 16 suites, 0 failures, 0 errors, 0 skipped; `BUILD SUCCESSFUL in 1s`; 26 tasks up-to-date. XML totals were independently parsed.

Visual fixture verification was also run serially. `VisualCaptureTest` finished 15/15 on the correct phone/tablet AVD pair; the dedicated expanded capture rerun was 1/1 after the initial phone-only device mismatch.

## Manual action matrix

The dev customer APK was clean-installed on `ticketground_phone_api36`, and the real `MainActivity` was cold-launched (reported total launch time 2521 ms). Actions used Compose semantics/UIAutomator or direct Android interaction.

| Action | Native observation | Back/result |
| --- | --- | --- |
| `home-open-more` | `open-calendar-screen`, heading `티켓오픈 예정`, formatted dates | Back restored home |
| `home-resale-pool` | `resale-screen`, `CLEAN 티켓 공식 양도`, public-only safety copy | CTA opened signed-out My Page; no mutation-success claim; Back restored home |
| `home-genre-콘서트` | `collection-screen-콘서트`, live concert catalog | Back restored home |
| `home-editorial-1` | `collection-screen-기획전`, live editorial collection | Back restored home |
| shortcut `오픈캘린더` | native opening-calendar destination | Back restored home |
| shortcut `공연 검색` | native search destination | Back restored home |
| shortcut `공지·자주 묻는 질문` | native support destination | Back restored home |

The route-tag observations above are also locked by the 14/14 Compose instrumentation suite.

## Screenshot evidence and visual findings

Artifact root: `/tmp/ticketground-mobile-parity/android/task6/`.

- Phone opening/resale: `captures-phone/13-phone-home-opening-resale.png` (780x1440).
- Phone genre/editorial: `captures-phone/14-phone-home-genre-editorial.png` (780x1440).
- Phone shortcuts: `captures-phone/15-phone-home-shortcuts.png` (780x1440).
- Expanded/tablet: `captures-tablet/09-tablet-expanded-home-parity.png` (2240x1440).
- Real-window fresh home: `manual/00-fresh-home.png` (822x1902).
- Real-window resale: `manual/02-public-resale-destination.png` (822x1902).
- Real-window editorial/shortcuts: `manual/03-editorial-shortcuts-home.png` (822x1902).
- Final real-window opening destination: `manual/05-open-calendar-final.png` (822x1902).

Inspection confirmed the required section anatomy/order, consistent spacing and radii, safe image fallback, and no clipping or overlap at phone and expanded widths. The first isolated resale capture revealed an orphaned Korean final syllable; smaller body typography fixed it. A live opening capture revealed the raw ISO `Z`, and a subsequent capture revealed `뮤지/컬` caused by reusing a home-width card. The final capture has localized `yyyy.MM.dd HH:mm` dates and full-width destination cards without those orphaned breaks. Earlier `manual/01-open-calendar-destination.png` and `manual/04-open-calendar-formatted-live.png` are retained only as superseded RED/visual-regression evidence.

## Adversarial and boundary results

- `stale_state`: clean APK install plus cold `MainActivity` launch; no prior navigation state was reused.
- `dirty_worktree`: final path audit found only the five owned implementation/test files plus this required report.
- `hung/long commands`: builds, instrumentation, emulator work, and captures ran serially with bounded progress updates; no unresolved hang remained.
- `flaky_tests`: focused formatter and expanded-capture failures were rerun after root-cause fixes; final focused and full targets were green.
- `misleading_success_output`: command exit codes, Gradle footer counts, instrumentation progress, and generated XML totals were checked.
- `malformed/empty states`: visual instrumentation retained loading, empty, and error fixture coverage; signed-out public resale was exercised manually.
- `repeated interruptions`: checkpoints were reported before long instrumentation and emulator passes.
- `sensitive artifacts`: no QR payload, PII, keys, tokens, or environment values were added to the captures or report.
- Prompt injection: not applicable.
- Protected-boundary audit: none of the changed paths match `.github/scripts/ticketground-bot.cjs` `PROTECTED_AUTH_PATTERNS`; the `CustomerApp.kt` diff changes only home/destination routing and Back handling, not native login/provider behavior.

## Cleanup and self-review

- Cleanup receipt: `./gradlew --stop` stopped 1 daemon; `adb -s emulator-5554 emu kill` returned `OK`; the follow-up device list was empty and no qemu/emulator/Gradle daemon remained (apart from the process-query command matching itself).
- Source audit found no `AndroidView` or `WebView` in the new Compose source.
- Touch surfaces use minimum interactive sizing of 48 dp or existing components with that contract.
- Review found no listing/purchase mutation path on the public resale screen and no duplicate generic opening-calendar section.
- Commit SHA is reported in the Task 6 DONE handoff because a commit cannot reliably embed its own content hash.
