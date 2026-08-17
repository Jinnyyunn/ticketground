# Task 8 Android customer parity qualification

Baseline was `b0a15c5f6d1829bc3d2de381f6245ac852ea5b49`. Final source SHA is `28fc6e6864cd2d8570ef2db03221cd82179f6d35` (`fix(android): restore customer navigation on back`). Protected Google/Kakao/Naver login UI/config/OAuth/session/tests/env/provider consoles were not changed.

## Fix round 1

Final Fix1 SHA is `8f6f4f4a306388fc29aa3c7553f81d0cea15153d` (`test(android): skip tablet capture on phone`). `VisualCaptureTest.capture09_tabletExpandedHome` uses an explicit `smallestScreenWidthDp >= 600` JUnit assumption. Phone XML records 55 tests, 0 failures/errors, 1 intentional skip, exit 0; tablet XML records 55 tests, 0 failures/errors/skips and an executed `capture09_tabletExpandedHome` testcase. The tablet run produced 21 fresh PNGs with valid signatures/dimensions and unique hashes.

## Gradle gates

| Scenario | Invocation | Result | Evidence |
| --- | --- | --- | --- |
| JVM | `./gradlew testDevCustomerDebugUnitTest` | Final 82 tests, 0 failures/errors/skips, exit 0 | `evidence/task8/logs/final-testDevCustomerDebugUnitTest.log` |
| Lint | `./gradlew lintDevCustomerDebug` | 0 lint errors, exit 0 | `evidence/task8/logs/final2-lint.log` |
| Assemble | `./gradlew assembleDevCustomerDebug` | 38 tasks, exit 0 | `evidence/task8/logs/back-handler-green.log` |
| Tablet instrumentation | `./gradlew connectedDevCustomerDebugAndroidTest` on `ticketground_tablet_api36` | 55 tests, 0 failures/errors/skips, exit 0 | `evidence/task8/xml/final2-tablet-full.xml`, `evidence/task8/logs/final2-connected-tablet.log` |
| Phone instrumentation | same command on `ticketground_phone_api36` | 55 tests, 0 failures/errors, 1 intentional skip, exit 0 | `evidence/task8/xml/fix1-phone-full.xml`, `evidence/task8/logs/fix1-phone-connected.log` |

## Manual QA

### manualQa.surfaceEvidence

| Scenario ID | Criterion | Surface / exact invocation | Verdict | Artifact refs |
| --- | --- | --- | --- | --- |
| T8-PHONE-ROOT | home/search/back | Clean install APK with `adb install -r`; launch `am start -n kr.ticketground.app.dev/kr.ticketground.app.MainActivity`; tap visible search control, `adb shell input keyevent KEYCODE_BACK`; hierarchy dump | PASS | A-phone-home-fix1, A-phone-search-fix1, A-phone-back-fix1 |
| T8-TABLET-SEARCH-DETAIL-BACK | Search → event detail → Back restoration | Clean install on `ticketground_tablet_api36`; tap visible search, tap `IU 2026 WORLD TOUR`, send system Back; hierarchy dumps | PASS | A-tablet-search, A-tablet-detail, A-tablet-back |
| T8-TABLET-VISUAL | responsive native layout/CJK | `VisualCaptureTest` in fresh tablet run; pull newest `Pictures/TicketGroundVisualQA-1786917677849` | PASS | A-visual-png, A-visual-hash, A-window-home |
| T8-AUTH-FIXTURE | reservation/cancellation/resale/trusted-device/push/booking conflict | Installed `VisualCaptureTest` fixture flow, no target-route injection | PASS local fixture only | A-visual-png, A-final2-xml |

### manualQa.adversarialCases

| Scenario ID | Criterion | Adversarial class | Expected behavior | Verdict | Artifact refs |
| --- | --- | --- | --- | --- | --- |
| T8-ADV-BACK | Back restoration | stale navigation / exit | Tab destination Back returns Home, nested route Back returns prior native surface; no launcher exit | PASS after RED→GREEN fix | A-back-red, A-back-green, A-tablet-handler-back |
| T8-ADV-CJK | rendered integrity | CJK clipping/tofu/overlap | Korean labels and event text remain legible and bounded | PASS | A-window-home, A-visual-png |
| T8-ADV-SECURE | evidence hygiene | black/secure capture | ADB secure frame is not promoted; emulator-window capture is used | PASS | A-window-home, A-tablet-search-window |
| T8-ADV-PROVIDER | external provider | unavailable external gate | Do not infer Toss settlement/refund, real attestation, push delivery, QR consume, Kakao availability | not_applicable — no provider credential/device/hardware gate was exercised | A-blockers |
| T8-ADV-FORMFACTOR | form-factor isolation | phone/tablet test selection | Tablet-only expanded capture skips on phone and executes on tablet; tablet assertions are not weakened | PASS | A-phone-fix1-xml, A-tablet-fix1-xml |

## Artifact references

| ID | Kind | Description | Path |
| --- | --- | --- | --- |
| A-phone-home | hierarchy | real installed phone home | `evidence/task8/manual-phone/02-home-after-wait.xml` |
| A-phone-search | hierarchy | real installed phone search | `evidence/task8/manual-phone/03-search.xml` |
| A-phone-back | hierarchy | pre-fix phone Back launcher observation | `evidence/task8/manual-phone/04-back-home.xml` |
| A-phone-home-fix1 | hierarchy | final installed phone Home | `evidence/task8/manual-phone/fix1-home.xml` |
| A-phone-search-fix1 | hierarchy | final installed phone Search | `evidence/task8/manual-phone/fix1-search.xml` |
| A-phone-back-fix1 | hierarchy | final phone Search → system Back → in-app Home | `evidence/task8/manual-phone/fix1-back-home.xml` |
| A-tablet-search | hierarchy | tablet Search/list | `evidence/task8/manual-tablet/02-search.xml` |
| A-tablet-detail | hierarchy | tablet event detail | `evidence/task8/manual-tablet/03-event-detail.xml` |
| A-tablet-back | hierarchy | tablet Search/list restored after detail Back | `evidence/task8/manual-tablet/04-back-search.xml` |
| A-tablet-handler-back | hierarchy | final handler Search → Back → native home | `evidence/task8/manual-tablet/12-handler-back2.xml` |
| A-visual-png | PNG set | 21 fresh RGBA PNG captures | `/tmp/ticketground-mobile-parity/android/task8-final2-captures/` |
| A-visual-hash | hash/file receipt | unique hashes and PNG signatures/dimensions | `evidence/task8/visual/final-png-sha256.txt`, `evidence/task8/visual/final-png-files.txt` |
| A-window-home | screenshot | visible emulator-window home, 1280x828 | `/tmp/ticketground-mobile-parity/android/task8-tablet-window-home.png` |
| A-tablet-search-window | screenshot | visible emulator-window Search | `/tmp/ticketground-mobile-parity/android/task8-tablet-window-search.png` |
| A-back-red | log | failing-first ViewModel regression | `evidence/task8/logs/back-red.log` |
| A-back-green | log | targeted regression green | `evidence/task8/logs/back-green.log` |
| A-final2-xml | XML | final tablet 55-test result | `evidence/task8/xml/final2-tablet-full.xml` |
| A-phone-fix1-xml | XML/log | phone 55 tests, 1 intentional skip, 0 failures | `evidence/task8/xml/fix1-phone-full.xml`, `evidence/task8/logs/fix1-phone-connected.log` |
| A-tablet-fix1-xml | XML/log | tablet 55 tests, capture09 executed, 0 failures/skips | `evidence/task8/xml/fix1-final-tablet-full.xml`, `evidence/task8/logs/fix1-final-tablet-connected.log` |
| A-tablet-fix1-png | PNG/hash | fresh tablet VisualCapture set, 21 unique PNGs | `/tmp/ticketground-mobile-parity/android/task8-fix1-tablet-captures/`, `evidence/task8/hashes/fix1-tablet-captures.sha256`, `evidence/task8/visual/fix1-png-files.txt` |
| A-blockers | report | external qualification boundaries | `task-8-report.md` |

## Fix round2: rendered Korean semantic phrases

Pass B에서 실제 390dp 폰 렌더의 `빠르게`, `결제`, `추정하지 않습니다`가 줄바꿈되는 RED를 확인했다. `TicketGroundAppShellTest`의 TextLayoutResult line-range 검증을 추가하고, 공통 SurfaceCard 수평 패딩을 기존 `xs` 토큰으로 조정했으며 푸시 안내에는 기존 `bodySmall` 타이포 토큰을 적용했다. 세 focused 테스트는 최종 수정에서 각각 exit 0으로 GREEN이다. 최종 exact-SHA 전체 게이트와 새 21+1 PNG 증거는 `evidence/task8/fix-round2/`에 기록한다.

## Fix round3 correction

Pass A fix2 review에서 공통 SurfaceCard `xs` 패딩이 카드 전체 밀도를 훼손하고 `경우에만`·`전송`도 분리된다는 지적을 반영했다. SurfaceCard 패딩은 원래 `lg` 토큰으로 복원했고, Support·BookingProgress·TrustedDevice·Push의 해당 설명 문장에만 기존 `bodySmall` 타이포 토큰을 적용했다. 390dp TextLayoutResult 테스트는 기존 세 문구와 새 `경우에만`, `전송`을 모두 검증하며 focused GREEN exit 0을 확인했다. 최종 SHA와 새 캡처는 `evidence/task8/fix-round3/`에 기록한다.

## Fix round4 correction

Rereview3에서 실제 390dp 렌더의 `주세요`와 `실제`가 한국어 단어 중간에서 분리되는 결함을 재현했다. 네 설명 문구(Support·BookingProgress·TrustedDevice·Push)에 재사용 가능한 TextLayoutResult 안전 경계 검증을 추가해 모든 시각적 줄 경계가 공백 또는 문장부호에 놓이는지 검사한다. 전역 SurfaceCard 토큰은 변경하지 않고 네 카드에만 수평 패딩을 국소 조정했으며, 설명 Text에만 Compose `LineBreak.Paragraph`/`WordBreak.Phrase`와 화면별 기존 소형 타이포를 적용했다. Push와 Toss 문구는 실제 폭에서 필요한 최소 국소 크기 조정을 사용한다. `fix-round4/`에 canonical RED 및 focused GREEN, 이후 exact-SHA 전체 게이트와 신선한 캡처를 기록한다.

## Fix round5 correction

Rereview4에서 확인된 0dp 카드 인셋과 8–10sp 임의 본문 크기를 제거했다. 네 설명 문구는 모두 기존 `MaterialTheme.typography.bodySmall`을 기반으로 하고, 한국어 locale과 Compose `LineBreak.Paragraph`/`WordBreak.Phrase`를 적용한다. 네 화면의 국소 바깥 여백과 카드 콘텐츠 인셋은 모두 기존 `TicketGroundSpacing.sm` 토큰이다. 390dp 렌더 테스트는 각 전체 문장의 모든 줄 경계뿐 아니라 실제 TextLayoutResult의 `bodySmall` fontSize와 카드/본문 좌측 경계를 함께 검증한다. 현재 round4 구현에 대한 canonical RED는 12sp 토큰 대신 8sp, 9sp, 10sp가 렌더됨을 네 화면 모두에서 재현했고, round5 focused GREEN은 네 테스트 모두 통과했다. 최종 커밋 SHA에서 직렬 전체 게이트, phone/tablet Back 흐름, fresh 21+1 시각 증거를 `evidence/task8/fix-round5/`에 기록한다.

## Fix round6 correction

Fix5 최종 캡처에서 단어 경계는 안전했지만 Toss의 `예매가 완료되지 않습니다`, 신뢰 기기의 `서버가 등록합니다`, Push의 `실제 전송 성공`이라는 짧은 의미 단위가 줄 사이에서 분리되었다. 390dp 렌더 테스트에 세 구절 전체의 동일 줄 배치와 접근성 원문 일치 검증을 추가했고, Fix5 구현에서 세 테스트 모두 실패하는 canonical RED를 기록했다. 카드 바깥과 내용 인셋은 이미 허용 최솟값인 기존 `TicketGroundSpacing.sm`이어서 폭을 더 줄이지 않았다. 대신 세 문장에만 재사용 가능한 Compose `InlineTextContent`를 적용해 `bodySmall`로 실측한 구절을 원자적으로 배치한다. inline 대체 텍스트는 원문 구절 그대로이므로 전체 접근성 문장은 원문과 정확히 같고, 글자 크기·안전 단어 경계·`sm` 인셋 검증도 유지된다. 임의 dp/sp, 0dp, 수동 개행, NBSP/zero-width 문자, 축약은 추가하지 않았다. focused 4-test GREEN과 최종 exact-SHA 전체 게이트 및 fresh 21+1 시각 증거는 `evidence/task8/fix-round6/`에 기록한다.
