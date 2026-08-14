# Task 1 — Android build foundation report

## Delivered files and decisions

- Added the native Gradle application at `android/TicketGroundApp/` with Gradle 9.5.0 wrapper, AGP 9.3.0, Java/Kotlin target 17, SDK 37, build tools 36.0.0, and the required `kr.ticketground.app` namespace.
- Added a version catalog with Compose BOM 2026.06.00 and only the requested foundation dependencies: Compose Material 3, adaptive navigation suite, Navigation Compose, lifecycle/ViewModel, coroutines, serialization, OkHttp, and unit/Compose test support.
- Added explicit `dev`/`prod` flavors and `debug`/`release` build types. The dev variant is `kr.ticketground.app.dev` with `https://dev.ticketground.co.kr`; production is `https://ticketground.co.kr`. Release enables minification/resource shrinking and all variants reject cleartext traffic.
- Added the skeletal adaptive Compose navigation shell, deterministic loading/empty/error state primitives, Android Keystore AES-GCM bearer vault, test-only in-memory vault, backup/device-transfer exclusions, and `FLAG_SECURE` screenshot protection. No credentials are Gradle constants, resources, or logs.
- Added unit coverage for secure API-origin parsing, UI state data, and vault store/read/clear semantics. Added an Android Compose smoke-test source for later emulator CI; this task did not run an emulator.
- Added Android-only generated/local ignore entries and build documentation. `local.properties` is ignored and was not created or committed.

## Verification evidence

All Android Gradle commands used the Android Studio embedded JDK and local SDK:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

| Scenario | Invocation | Binary observable | Captured artifact |
| --- | --- | --- | --- |
| JVM state/configuration/vault behavior | `./gradlew testDevDebugUnitTest --no-daemon --console=plain` | `BUILD SUCCESSFUL`; 6 tests | `.omo/evidence/android-foundation-2026-08-12/testDevDebugUnitTest.log`, `.omo/evidence/android-foundation-2026-08-12/test-report.html` |
| Dev debug APK build | `./gradlew assembleDevDebug --no-daemon --console=plain` | `BUILD SUCCESSFUL`; APK SHA-256 `99ae879893082e18b94228b52bddd80b5e6a54953aaee96272eae4d010b7e446` | `.omo/evidence/android-foundation-2026-08-12/assembleDevDebug.log`, `.omo/evidence/android-foundation-2026-08-12/app-dev-debug.apk.sha256` |
| Dev debug lint | `./gradlew lintDevDebug --no-daemon --console=plain` | `BUILD SUCCESSFUL`; no Error/Fatal findings | `.omo/evidence/android-foundation-2026-08-12/lintDevDebug.log`, `.omo/evidence/android-foundation-2026-08-12/lint-report.html` |
| Whitespace validation | `git diff --check` | exit 0, `git diff --check: PASS` | `.omo/evidence/android-foundation-2026-08-12/git-diff-check.log` |

## Commit

- `4e40a36 feat(android): bootstrap native app foundation`

## Concerns

- `lintDevDebug` reports 14 non-failing dependency-version advisories. They are expected because this task pins the explicitly requested AGP 9.3.0, Gradle 9.5.0, Compose BOM 2026.06.00, and compatible foundation versions; there are no Error/Fatal lint findings.
- The Compose smoke test is source-ready for emulator CI. Emulator/device execution, Play signing, Play Integrity, FCM, Toss merchant credentials, and physical-device admission are intentionally outside Task 1.
