# Login Success Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google, Kakao, Naver 로그인이 성공하면 즉시 홈 화면으로 이동하고, 취소나 실패 시에는 로그인 화면에 그대로 남는다.

**Architecture:** `AppContainer`에 로그인 완료 시 기존 `navigationPath`를 비우는 단일 목적 메서드를 추가한다. `DiscoveryLoginView`의 Google 및 공통 소셜 로그인 성공 분기에서만 이 메서드를 호출하여 성공 이벤트에만 홈 이동을 적용하고, 기존 세션 저장·오류·취소 처리에는 손대지 않는다.

**Tech Stack:** Swift 5, SwiftUI, Observation, XCTest, Xcode iPhone Simulator

## Global Constraints

- Google, Kakao, Naver 모두 동일한 성공 이동을 사용한다.
- 성공 시 이미 저장된 네이티브 세션을 유지한다.
- 취소, 공급자 실패, 로그아웃 동작을 변경하지 않는다.
- OAuth credential, callback, backend session contract를 변경하지 않는다.
- 빌드, 테스트, 시뮬레이터 작업은 직렬 실행한다.
- 기존 동결 evidence root, 보호 checkout, retained IOS worktree를 수정하지 않는다.
- 비밀값이나 사용자 개인정보를 로그, 커밋, PR 본문에 노출하지 않는다.

---

## File Structure

- `ios/TicketGroundApp/TicketGroundApp/App/AppEnvironment.swift`: 로그인 성공 후 루트 홈으로 돌아가는 `AppContainer` 라우팅 동작을 소유한다.
- `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift`: Google 및 Kakao/Naver 성공 이벤트에서 홈 이동을 호출한다.
- `ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj`: Debug 시뮬레이터 앱을 ad-hoc 서명하여 Keychain 세션 저장을 허용한다.
- `ios/TicketGroundApp/TicketGroundAppTests/AppEnvironmentTests.swift`: 비어 있지 않은 경로가 로그인 완료 시 제거되는 회귀 테스트를 소유한다.
- `tests/ios-tooling-regression.test.mjs`: Debug 빌드에서 서명을 비활성화하는 설정의 재도입을 막는다.

### Task 1: 로그인 완료 라우팅 회귀 테스트와 최소 구현

**Files:**
- Modify: `ios/TicketGroundApp/TicketGroundApp/App/AppEnvironment.swift`
- Test: `ios/TicketGroundApp/TicketGroundAppTests/AppEnvironmentTests.swift`

**Interfaces:**
- Consumes: `AppContainer.navigationPath: [AppRoute]`
- Produces: `AppContainer.completeLoginNavigation() -> Void`

- [ ] **Step 1: 실패하는 회귀 테스트 작성**

```swift
func testLoginCompletionReturnsNavigationToHome() {
    let container = AppContainer.fixture()
    container.navigationPath = [.menu, .login]

    container.completeLoginNavigation()

    XCTAssertTrue(container.navigationPath.isEmpty)
}
```

- [ ] **Step 2: 테스트가 구현 부재로 실패하는지 확인**

Run:

```bash
xcodebuild test \
  -project ios/TicketGroundApp/TicketGroundApp.xcodeproj \
  -scheme TicketGroundApp \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:TicketGroundAppTests/AppEnvironmentTests/testLoginCompletionReturnsNavigationToHome
```

Expected: FAIL with `Value of type 'AppContainer' has no member 'completeLoginNavigation'`.

- [ ] **Step 3: 최소 라우팅 메서드 구현**

`AppContainer`에 다음 메서드를 추가한다.

```swift
func completeLoginNavigation() {
    navigationPath.removeAll()
}
```

- [ ] **Step 4: 집중 테스트 통과 확인**

Run:

```bash
xcodebuild test \
  -project ios/TicketGroundApp/TicketGroundApp.xcodeproj \
  -scheme TicketGroundApp \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:TicketGroundAppTests/AppEnvironmentTests/testLoginCompletionReturnsNavigationToHome
```

Expected: PASS.

### Task 2: 모든 공급자 성공 이벤트를 홈 이동에 연결

**Files:**
- Modify: `ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift`
- Test: `ios/TicketGroundApp/TicketGroundAppTests/AppEnvironmentTests.swift`

**Interfaces:**
- Consumes: `AppContainer.completeLoginNavigation() -> Void`
- Produces: Google 및 Kakao/Naver `.signedIn` 분기에서만 홈으로 돌아가는 사용자 동작

- [ ] **Step 1: Google 성공 분기에 홈 이동 연결**

```swift
case .signedIn(let userName):
    providerMessage = "\(userName)님으로 로그인했습니다."
    container.completeLoginNavigation()
```

- [ ] **Step 2: Kakao/Naver 성공 분기에 홈 이동 연결**

```swift
case .signedIn(_, let userName):
    providerMessage = "\(userName)님으로 로그인했습니다."
    container.completeLoginNavigation()
```

- [ ] **Step 3: 취소·실패 분기가 라우팅을 호출하지 않는지 확인**

Run:

```bash
sed -n '295,350p' ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift
```

Expected: `completeLoginNavigation()`은 두 `.signedIn` 분기에만 있고 `.cancelled`, `.failed`, `.idle`, `.loading` 분기에는 없다.

- [ ] **Step 4: iOS 집중 테스트 스위트 실행**

Run:

```bash
xcodebuild test \
  -project ios/TicketGroundApp/TicketGroundApp.xcodeproj \
  -scheme TicketGroundApp \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:TicketGroundAppTests/AppEnvironmentTests
```

Expected: `AppEnvironmentTests` 전부 PASS.

### Task 3: Debug 시뮬레이터 Keychain 서명 보장

**Files:**
- Modify: `ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj`
- Test: `tests/ios-tooling-regression.test.mjs`

**Interfaces:**
- Consumes: Xcode Debug simulator build configuration
- Produces: ad-hoc 서명된 시뮬레이터 앱과 재실행 가능한 Keychain credential

- [ ] **Step 1: 실패하는 Debug 서명 회귀 테스트 작성**

Debug configuration에 `CODE_SIGNING_ALLOWED = NO` 또는 `CODE_SIGNING_REQUIRED = NO`가 없음을 검사한다.

- [ ] **Step 2: 회귀 테스트가 기존 설정으로 실패하는지 확인**

Run:

```bash
node --test --test-name-pattern='Debug configuration permits simulator keychain signing' tests/ios-tooling-regression.test.mjs
```

Expected: FAIL because Debug explicitly disables code signing.

- [ ] **Step 3: Debug의 서명 비활성화 설정 제거**

Debug build settings에서 `CODE_SIGNING_ALLOWED = NO`, `CODE_SIGNING_REQUIRED = NO`, 빈 `CODE_SIGN_IDENTITY`를 제거한다. 시뮬레이터는 개발자 인증서나 유료 Apple 계정 없이 ad-hoc 서명한다.

- [ ] **Step 4: 회귀 테스트와 ad-hoc 서명 확인**

Run the focused Node test, build the simulator app, and verify `codesign -dv --verbose=4` reports `Signature=adhoc`.

Expected: PASS and an ad-hoc signed app.

### Task 4: 시뮬레이터 동작 검증과 배포

**Files:**
- Modify: none

**Interfaces:**
- Consumes: 빌드된 `TicketGroundApp.app`, 실행 중인 HTTPS backend
- Produces: 로그인 성공 홈 이동, 재실행 세션 복구, 로그아웃, 취소/실패 유지의 관찰 증거와 병합된 PR

- [ ] **Step 1: 최신 앱을 iPhone 17 Pro 시뮬레이터용으로 빌드**

Run:

```bash
xcodebuild build \
  -project ios/TicketGroundApp/TicketGroundApp.xcodeproj \
  -scheme TicketGroundApp \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath /private/tmp/ticketground-login-success-home-derived
```

Expected: `** BUILD SUCCEEDED **`.

- [ ] **Step 2: 설치 후 실제 소셜 로그인 성공 동작 확인**

Run:

```bash
xcrun simctl install booted /private/tmp/ticketground-login-success-home-derived/Build/Products/Debug-iphonesimulator/TicketGroundApp.app
xcrun simctl launch booted kr.ticketground.app
```

Expected: Kakao 또는 Naver 실제 인증 완료 직후 로그인 화면이 닫히고 홈 화면이 보인다.

- [ ] **Step 3: 세션 수명주기와 비성공 경로 확인**

앱 종료·재실행 후 로그인 세션이 유지되는지 확인하고, 로그아웃 후 로그인 상태가 제거되는지 확인한다. 인증 취소 또는 실패 시 로그인 화면에 남으며 기존 메시지가 보이는지 확인한다.

- [ ] **Step 4: 변경을 커밋하고 전용 브랜치 푸시**

```bash
git add ios/TicketGroundApp/TicketGroundApp/App/AppEnvironment.swift \
  ios/TicketGroundApp/TicketGroundApp/UI/Discovery/DiscoveryRouteView.swift \
  ios/TicketGroundApp/TicketGroundApp.xcodeproj/project.pbxproj \
  ios/TicketGroundApp/TicketGroundAppTests/AppEnvironmentTests.swift \
  tests/ios-tooling-regression.test.mjs \
  docs/superpowers/plans/2026-08-01-login-success-home.md
git commit -m "fix(ios): return home after social login"
git push -u origin agent/issue-96-login-success-home
```

- [ ] **Step 5: PR 생성·CI·최신 HEAD 리뷰·병합**

PR 본문에 사용자가 요청한 보호 인증 경계 변경임을 명시하고 집중 테스트 및 시뮬레이터 증거를 기록한다. 모든 필수 CI와 최신 HEAD 리뷰가 성공한 뒤 병합한다.

- [ ] **Step 6: 완료 이슈만 업데이트**

병합 후 #96에 테스트, 시뮬레이터 결과, PR URL을 댓글로 기록한다. 실제 공급자 증거·재실행·로그아웃까지 모두 확인된 경우에만 #96을 닫고, Google 실제 인증이 남아 있으면 #95는 닫지 않는다.
