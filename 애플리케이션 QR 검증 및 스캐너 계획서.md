# QR 생성 및 게이트 스캐너 계획서

## 목적

Ticketground의 암표 방지 철칙은 다음 한 줄로 요약된다.

```text
계정 프로필 변경 != 티켓 소유자 변경 != 현장 발권 대상자 변경
```

입장 QR과 게이트 스캐너는 이 철칙이 실제로 지켜지는지 검증하는 마지막 관문이다. 예매 단계에서 아무리 본인확인을 철저히 해도, 입장 순간에 "QR을 들고 있는 사람이 곧 발권 대상자"라는 등식이 깨지면 그 앞의 모든 방어가 무의미해진다. 이 계획서는 두 가지 축을 다룬다.

```text
QR 생성: 서버가 발급하는 입장 자격이 실제 발권 대상자에게만 나가는가
게이트 스캐너: 그 QR을 검증하는 쪽(게이트 운영자)도 신뢰할 수 있는 주체인가
```

`휴대폰 본인인증.md`가 정의한 `holderIdentityKeyHash`(예매 시점 본인확인 결과에 고정되는 값)는 현재 QR 발급 로직과 연결되어 있지 않다. `admissionCredential.userId`는 `ticket.ownerId`, 즉 계정 로그인 기준으로만 채워진다. 계정 프로필을 구매자 정보로 바꿔치기하는 암표(계정 양도형 암표)를 막으려면 QR 발급 시점에도 `holderIdentityKeyHash` 일치를 확인해야 한다. 이 계획서의 5장은 이 연결을 어떻게 만드는지 다룬다.

`입장qr 문제점.md`의 결론도 다시 확인한다.

```text
QR 캡처를 100% 막는 것은 불가능하다.
방지·추적·무력화를 함께 설계해야 한다.
```

즉 이 계획서의 목표는 "완벽한 방어"가 아니라 "매크로/암표 비용을 올리고, 캡처·전매가 발생했을 때 역추적 가능한 상태를 유지하는 것"이다.

## 현재 구현 상태 요약

`backend/admission.js`, `backend/admission-qr.js`, `backend/admission-devices.js`는 이미 main에 병합되어 있다. 아래는 실제 코드가 지금 하는 일이다. 이 계획서는 이 위에서 "다음 단계"를 설계한다.

| 항목 | 구현 여부 | 파일 |
| --- | --- | --- |
| 가상티켓(`VIRTUAL_READY`) → 입장 QR(`QR_ACTIVE`) → 사용완료(`USED`) 상태 전이 | 구현됨 | `backend/admission.js:34-71` |
| 가상티켓 준비 시점(공연 24시간 전) | 구현됨 | `backend/admission.js:18-20` (`qrPreparedAt`) |
| 입장 QR 활성화 시점(공연 3시간 전) | 구현됨 | `backend/admission.js:22-24` (`qrActiveAt`) |
| 위험 계정 판정(`WATCHLIST` 또는 `trustScore < 50`) | 구현됨 | `backend/admission.js:26-28` (`isRiskUser`) |
| QR 20초 TTL, HMAC 서명, nonce | 구현됨 | `backend/admission-qr.js:75-78` |
| QR 1회 사용 후 무효화, timing-safe 서명 비교 | 구현됨 | `backend/admission-qr.js:121-152` |
| 10자리 추적 코드(`traceCode`) 서버 생성 | 구현됨(화면 노출 UI는 없음) | `backend/admission-qr.js:78` |
| 웹 채널 QR 발급 차단(`APP_CHANNEL_REQUIRED`) | 구현됨 | `backend/admission-qr.js:55-60` |
| 앱 인증 서명 필수(`APP_ATTESTATION_REQUIRED`) | 구현됨(단, 실제 하드웨어 증명 아님 — 3장 참조) | `backend/admission-qr.js:61-63`, `backend/runtime.js:66-74` |
| 신뢰 기기 필수(`TRUSTED_DEVICE_REQUIRED`) | 구현됨 | `backend/admission-devices.js:74-88` |
| 신뢰 기기 등록 시 생체인증 + 앱 인증서명 요구 | 구현됨 | `backend/admission-devices.js:22-31` |
| 위험 계정 OTP 강제(`OTP_REQUIRED`) | 구현됨 | `backend/admission-qr.js:65-67` |
| QR 발급 로그(`qrIssueLogs`) 저장 | 구현됨 | `backend/admission-qr.js:83-93` |
| 게이트 검증 엔드포인트 인증 경계 | 미구현 — 완전 공개 | `backend/api-router.js:779-782` |
| `/api/tickets/qr`, `/api/tickets/virtual-qr` 세션 기반 사용자 검증 | 미구현 — body의 `userId` 그대로 신뢰 | `backend/api-router.js:766-778` |
| `holderIdentityKeyHash`와 QR 발급 연결 | 미구현 — 필드 자체가 스키마에 없음 | 해당 없음 |
| iOS App Attest / Android Play Integrity 실제 검증 | 미구현 — HMAC 서명 확인 수준 | `backend/runtime.js:59-74` |
| 게이트 운영자 전용 인증(소비자 로그인과 분리) | 미구현 | 해당 없음 |
| 게이트 스캐너 클라이언트(PWA) | 미구현 | 해당 없음 |
| QR 화면 동적 워터마크 렌더링 | 미구현 | 해당 없음 |

관련 GitHub 이슈: `#107` "[Ticket] 모바일 티켓 QR 발급·입장 검증 연동"(OPEN, `status: externally-blocked`). 이슈 본문이 이미 "게이트 검증 장비/운영자 앱의 권한과 온라인·오프라인 정책을 서버에서 확정해야 합니다"를 선행 조건으로 명시하고 있다. 물리적 게이트 하드웨어가 부족한 게 아니라 이 인증 경계 자체가 없는 것이 원인이며, 이번 PWA 설계가 그 실질적 해결책이다.

## iOS 플랫폼 설계

### App Attest가 실제로 하는 일

Apple의 App Attest(`DCAppAttestService`, DeviceCheck 프레임워크 하위)는 앱 인스턴스가 진짜 Apple 하드웨어에서 실행 중인 정품 바이너리인지 증명하는 기능이다. 핵심 동작은 다음과 같다.

```text
1. generateKey()
   Secure Enclave 안에 앱 전용 키 쌍을 생성한다.
   개인키는 Secure Enclave를 벗어나지 않는다.
   앱은 keyId(공개키 해시)만 받는다.

2. attestKey(keyId, clientDataHash)
   서버가 발급한 challenge를 해시해 전달한다.
   Apple 서버가 서명한 attestation object를 반환한다.
   이 attestation object는 기기가 진짜 Apple 하드웨어이고
   탈옥/변조되지 않았음을 증명하는 인증서 체인을 포함한다.
   attestKey는 키 쌍마다 1회만 호출한다(비용이 큼).

3. generateAssertion(keyId, clientDataHash)
   이후 매 요청마다 호출한다.
   요청 payload의 해시를 개인키로 서명한 assertion을 반환한다.
   assertion에는 replay 방지용 counter가 포함된다.
```

중요한 제약:

```text
시뮬레이터에서 동작하지 않는다. Secure Enclave가 있는 실기기가 필요하다.
attestKey는 키 쌍 생성 후 1회만 유효하다 — 매 요청마다 attestKey를 부르면 안 된다.
챌린지(clientDataHash)는 반드시 서버가 생성해서 내려줘야 한다.
앱이 직접 challenge를 만들면 replay 공격을 막을 수 없다.
```

### 현재 `verifyAppAttestation`과의 차이

`backend/runtime.js:59-74`의 `verifyAppAttestation`은 다음과 같다.

```js
function appAttestationSignature(purpose, ...parts) {
  return crypto
    .createHmac("sha256", attestationSecret)
    .update(["app", purpose, ...parts].join(":"))
    .digest("hex");
}
```

이는 서버와 앱이 공유하는 비밀키(`attestationSecret`) 기반 HMAC이다. 앱 바이너리를 리버스 엔지니어링해 `attestationSecret`이 유출되면 누구나 유효한 `appAttestation` 값을 계산할 수 있다. 이것이 App Attest처럼 "Secure Enclave만 알고 있는 개인키로 서명"하는 방식과의 근본적 차이다. 즉 지금은 "앱에서 왔다는 걸 서명으로 흉내낸 것"이지, "탈옥되지 않은 진짜 Apple 하드웨어에서 왔다는 하드웨어 증명"이 아니다.

App Attest의 SafeTix식 반면교사도 참고할 필요가 있다. Ticketmaster SafeTix 바코드는 15초마다 회전하는 TOTP 두 개(이벤트 키 기반, 고객 키 기반)로 구성되지만, 스캘퍼들이 브라우저 콘솔에 노출된 bearer token과 두 키를 추출해 오프라인에서 유효한 바코드를 무제한 생성할 수 있었다(리버스 엔지니어링 사례, 2024년). 교훈은 다음과 같다.

```text
회전 자체는 캡처 방지 수단일 뿐이다.
회전 로직에 쓰이는 비밀값이 클라이언트에 노출되면 회전은 의미가 없다.
기기 바인딩(App Attest/Play Integrity) 없이는 "합법 앱처럼 보이는 요청"을 위조할 수 있다.
```

Ticketground의 traceCode(7장)는 SafeTix의 TOTP와 달리 "인증에 쓰이지 않는 추적 전용 표시값"으로 설계되어 있어(서버 서명 검증과 별개), 유출되어도 QR 위조로 이어지지 않는다. 이 구조는 유지해야 한다.

### 통합 방법

```text
1. 앱 최초 실행 시 DCAppAttestService.generateKey() 호출
   → keyId를 Keychain에 저장(kSecClassGenericPassword,
     kSecAttrAccessibleWhenUnlockedThisDeviceOnly)

2. 서버에 POST /api/devices/attest/challenge 요청
   → 서버가 1회용 challenge(랜덤 32바이트) 발급, TTL 5분

3. clientDataHash = SHA256(challenge)
   attestKey(keyId, clientDataHash) 호출
   → attestation object를 서버에 전송

4. 서버(POST /api/devices/attest/register)에서 검증
   - Apple의 App Attest Root CA로 인증서 체인 검증
   - nonce가 challenge와 일치하는지 확인
   - 앱의 Team ID + Bundle ID(app ID)가 일치하는지 확인
   - Counter가 0인지 확인(attestKey는 최초 1회이므로)
   - 검증 통과 시 공개키를 users.trustedDevices에 저장

5. 이후 QR 발급/신뢰 기기 등록 요청마다
   generateAssertion(keyId, SHA256(requestPayload)) 호출
   → assertion을 요청에 첨부

6. 서버는 저장된 공개키로 assertion 서명을 검증하고
   counter가 이전 값보다 증가했는지 확인한다.
   counter가 감소하거나 그대로면 복제된 앱/키 유출 의심으로 차단한다.
```

### Keychain 저장 정책

```text
저장 항목: keyId만 저장한다. 개인키는 저장 대상이 아니다(Secure Enclave 내부에만 존재).
접근 등급: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
  - 기기 잠금 해제 상태에서만 접근 가능
  - iCloud Keychain 동기화 대상에서 제외(다른 기기로 복사되면 안 됨)
동기화 금지 이유: keyId가 다른 기기로 넘어가면 서버가 "같은 신뢰 기기"로 오인할 수 있다.
                  Ticketground의 신뢰 기기는 물리적 기기 단위로 묶여야 한다.
재설치 시 동작: 앱 삭제 후 재설치하면 Keychain 항목도 사라지는 것이 기본값이다(
                 kSecAttrAccessibleWhenUnlockedThisDeviceOnly는 앱 삭제 시 삭제됨).
                 재설치한 사용자는 신뢰 기기 재등록(생체인증 + 새 App Attest 키) 절차를 다시 밟는다.
```

## Android 플랫폼 설계

### Play Integrity API가 실제로 하는 일

iOS App Attest에 대응하는 Android 쪽 표준 메커니즘은 Google Play Integrity API다(구 SafetyNet Attestation API의 후속, SafetyNet은 지원 종료 수순). 핵심 개념은 App Attest와 유사하지만 판정 방식이 다르다.

```text
App Attest: 하드웨어 키로 서명 → 서버가 서명을 검증(암호학적 증명)
Play Integrity: Google Play 서버가 판정(verdict)을 내려 암호화된 토큰으로 전달
                → 서버는 그 토큰을 복호화해 판정 내용을 확인(신뢰 위임 모델)
```

세 가지 핵심 판정(verdict)이 있다.

```text
appIntegrity   — 우리 앱의 변조되지 않은 정품 바이너리가 맞는가 (PLAY_RECOGNIZED)
deviceIntegrity — 정품 인증된 Android 기기에서 실행 중인가
  MEETS_STRONG_INTEGRITY (Android 13+, 하드웨어 기반 보안 + 최신 보안 패치)
  MEETS_DEVICE_INTEGRITY (하드웨어 기반 보안 신호)
  MEETS_BASIC_INTEGRITY (최소 수준, 루팅/에뮬레이터 탐지 취약)
accountDetails — Google Play를 통해 정식 설치/구매되었는가 (LICENSED)
```

### 통합 방법

```text
1. 표준(Standard) API 요청 사용(권장) — 지연시간 수백ms, 자동 캐싱/워밍업 지원
   클래식(Classic) API는 고위험 단발성 액션에만 예외적으로 사용

2. 앱: requestHash 생성
   requestHash = SHA256(요청 payload의 핵심 필드들: userId, ticketId, deviceId 등)

3. 앱: IntegrityManager.requestIntegrityToken(requestHash) 호출
   → Google Play 서비스가 암호화된 JWT 토큰 반환

4. 앱: 이 토큰을 요청 본문에 담아 서버로 전송

5. 서버: Google Play의 Decryption/Verification 키로 토큰을 복호화·서명 검증
   - requestHash가 서버가 알고 있는 값과 일치하는지 확인(요청 재사용 방지)
   - appRecognitionVerdict == PLAY_RECOGNIZED 확인
   - appLicensingVerdict == LICENSED 확인
   - deviceIntegrity 등급에 따라 단계적 정책 적용:
     STRONG → 정상 발급
     DEVICE → 정상 발급(모니터링)
     BASIC만 → OTP 등 추가 인증 요구
     verdict 없음 → 거부
```

### 향후 Android 네이티브 앱 개발 시 필요한 것

```text
Google Play Console에서 앱 등록 및 Cloud Project 번호 연결
Play Integrity API 활성화, 일일 쿼터 설정(기본 10,000 요청/일 — 공연 당일 피크 트래픽 고려해 상향 신청 필요)
서버 측 Google Play 응답 복호화 키 발급 및 안전한 보관(현재 attestationSecret과 동일한 위치에 두면 안 됨 — Google이 발급한 별도 키)
requestHash를 캐시하지 않는다(캐시된 verdict를 다른 요청에 재사용하는 공격을 허용하게 됨)
바이너리 판정(허용/거부)이 아니라 단계적 정책(STRONG/DEVICE/BASIC/없음)으로 설계
```

`backend/admission-devices.js:42`의 `platform` 필드는 이미 자유 문자열("APP" 기본값)이므로 `"iOS"` / `"Android"` 구분을 위한 스키마 변경은 필요 없다. `trustDevice()` 호출 시 `platform: "iOS"` 또는 `"Android"`를 넘기고, `attestationVerified` 값을 만들어내는 실제 검증 로직만 플랫폼별로 분기하면 된다.

```text
platform === "iOS"     → App Attest 인증서 체인 + assertion 검증
platform === "Android" → Play Integrity 토큰 복호화 + verdict 검증
```

## QR 발급 API 보안 경계 수정안

### 문제

`backend/api-router.js:766-778`은 다음과 같다.

```js
if (req.method === "POST" && url.pathname === "/api/tickets/qr") {
  requireBody(body, ["userId", "ticketId"]);
  if (String(body.channel || "WEB").toUpperCase() === "APP") {
    requireBody(body, ["deviceId", "appAttestation"]);
    verifyAppAttestation(body, "ISSUE_QR", [body.userId, body.deviceId, body.ticketId]);
    return issueQr(db, { ...body, attestationVerified: true });
  }
  return issueQr(db, body);
}
if (req.method === "POST" && url.pathname === "/api/tickets/virtual-qr") {
  requireBody(body, ["userId", "ticketId"]);
  return virtualQr(db, body);
}
```

두 엔드포인트 모두 `body.userId`를 그대로 `issueQr`/`virtualQr`에 전달한다. `issueQr` 내부는 `ticket.ownerId === user.id`를 확인하지만, 그 `user.id` 자체가 로그인 세션이 아니라 요청자가 스스로 신고한 값이다. 로그인 세션 없이(또는 다른 사용자로 로그인한 채) `userId`만 티켓 소유자의 ID로 바꿔 보내면 티켓 소유자 확인 로직을 그대로 통과한다.

같은 파일의 재판매·양도·본인인증 엔드포인트는 이미 `resolveActorId`/`resolvePurchaseUserId` 패턴(`backend/api-router.js:194-204`)으로 고쳐져 있다.

```js
// 로그인 세션이 있으면 그 세션의 사용자로만 동작하고 클라이언트가 보낸
// id 필드는 무시한다. 세션이 아예 없을 때만(비로그인 데모) 그 필드를
// 그대로 신뢰한다 — 로그인한 사용자를 다른 사용자로 사칭하는 걸 막기 위함.
function resolveActorId(db, req, fallbackId) {
  const session = optionalAuthenticateNativeSession(db, req);
  return session ? session.user.id : fallbackId;
}
```

QR 발급 경로에는 아직 이 패턴이 적용되지 않았다. 이것이 이번 계획서가 다루는 가장 시급한 갭이다 — App Attest/Play Integrity가 아무리 튼튼해도, "누구 명의로 QR을 발급할지"를 요청자가 자기 신고로 정할 수 있으면 기기 신뢰 계층 전체가 무의미해진다.

### 수정안

```js
if (req.method === "POST" && url.pathname === "/api/tickets/qr") {
  requireBody(body, ["ticketId"]);
  const userId = resolvePurchaseUserId(db, req, body);
  if (String(body.channel || "WEB").toUpperCase() === "APP") {
    requireBody(body, ["deviceId", "appAttestation"]);
    verifyAppAttestation(body, "ISSUE_QR", [userId, body.deviceId, body.ticketId]);
    return issueQr(db, { ...body, userId, attestationVerified: true });
  }
  return issueQr(db, { ...body, userId });
}
if (req.method === "POST" && url.pathname === "/api/tickets/virtual-qr") {
  requireBody(body, ["ticketId"]);
  return virtualQr(db, { ...body, userId: resolvePurchaseUserId(db, req, body) });
}
```

핵심 변경은 두 가지다.

```text
1. requireBody에서 userId를 제거한다 — 클라이언트가 신고하는 값이 아니라
   서버가 세션에서 계산하는 값이 되어야 하므로 필수 입력값 목록에서 뺀다.
2. verifyAppAttestation의 purpose 문자열에 들어가는 userId도
   resolvePurchaseUserId 결과값으로 통일한다 — body.userId를 그대로 쓰면
   attestation 서명 검증에 위조 가능한 사용자 ID가 다시 섞여 들어간다.
```

이 변경은 로그인 세션이 있는 정상 사용자 경로에는 영향이 없다(세션의 사용자 ID가 그대로 쓰인다). 세션이 없는 상태에서 `userId`를 body로 넘기던 흐름(현재 테스트/데모 스크립트가 이렇게 호출하고 있다면)만 "로그인해야 한다"는 요구로 바뀐다. `POST /api/tickets/qr`은 어차피 `APP_CHANNEL_REQUIRED`로 웹에서는 실패하므로, 실질적으로 이 경로는 전용 앱의 로그인 세션이 있는 상태에서만 의미를 가져야 한다.

### `holderIdentityKeyHash` 연결 설계

현재 `admissionCredential`, `ticket` 스키마 어디에도 `identityKeyHash`/`holderIdentityKeyHash` 필드가 없다(코드베이스 전체 검색 기준, `휴대폰 본인인증.md` 문서에만 설계로 존재). 이 필드는 `휴대폰 본인인증.md`가 정의한 본인확인 도입과 함께 스키마에 추가되어야 하는 선행 작업이며, 이 계획서는 그 필드가 생겼을 때 QR 발급 로직이 이를 어떻게 사용해야 하는지를 정의한다.

```text
ticketEntitlements.holderIdentityKeyHash  (휴대폰 본인인증.md에서 정의, 예매 시점 고정)
users.identityKeyHash                     (휴대폰 본인인증.md에서 정의, 최신 본인확인 결과)
```

`ensureAdmissionCredential`(`backend/admission.js:34-71`)에 다음 검증을 추가한다.

```js
function ensureAdmissionCredential(db, { user, ticket, event, performanceDate }) {
  const entitlement = db.ticketEntitlements.find((item) => item.ticketId === ticket.id);
  if (entitlement && entitlement.holderIdentityKeyHash !== user.identityKeyHash) {
    throw httpError(409, "HOLDER_IDENTITY_MISMATCH",
      "예매 시점 본인확인 결과와 현재 계정의 본인확인 결과가 일치하지 않습니다.",
      { ticketId: ticket.id, requiresOfficialTransfer: true });
  }
  // ... 기존 로직
}
```

판정 기준은 `휴대폰 본인인증.md`의 표와 동일하게 맞춘다.

```text
holderIdentityKeyHash == user.identityKeyHash
→ 계정 로그인자가 예매 시점 본인확인자와 동일인
→ QR 발급 진행

holderIdentityKeyHash != user.identityKeyHash
→ 계정은 로그인됐지만 예매 시점 본인확인자와 다른 사람
→ QR 발급 거부(HOLDER_IDENTITY_MISMATCH)
→ 공식 양도/재판매 절차로 안내

entitlement 자체가 없음(과거 발급된 티켓, 마이그레이션 이전)
→ 자동 거부하지 않음(기존 사용자 불편 방지)
→ ownerId 기준 기존 로직 유지 + 위험 신호로만 가중치 반영
```

이 검증이 정확히 막는 시나리오는 "암표상이 자기 계정으로 예매 → 구매자 이름/번호로 계정 정보만 변경 → 구매자가 로그인해서 QR 발급"이다. `ticket.ownerId`는 계정과 함께 그대로지만 `holderIdentityKeyHash`는 예매 시점 값에 고정되어 있으므로, 계정 정보 변경만으로는 이 값이 바뀌지 않는다.

## 게이트 스캐너 PWA 설계

게이트(입장 검증) 앱은 PWA로 개발한다. 기존 Next.js 스택을 그대로 재사용하고, 앱스토어 심사 없이 즉시 배포·패치할 수 있으며, iOS Safari와 Android Chrome에서 동일 코드로 동작한다. 카메라 QR 스캔은 `BarcodeDetector` API(Chrome 계열 네이티브 지원)를 우선 사용하고, 구형 Safari 등 미지원 브라우저는 `jsQR` 폴백으로 처리한다.

### 게이트 운영자 인증 경계

게이트 운영자 인증은 소비자 로그인과 완전히 분리된 별도 자격증명이어야 한다. 소비자 세션 토큰이 게이트 검증 권한을 갖게 되면, 소비자 계정 탈취 하나로 위조 QR을 "입장 완료" 처리할 수 있는 경로가 생긴다.

```text
소비자 인증: users 테이블, 이메일/소셜 로그인, optionalAuthenticateNativeSession
게이트 운영자 인증: 별도 gateOperators 테이블, 게이트별 발급 토큰, 완전히 다른 세션 네임스페이스
```

게이트별 자격증명 모델은 다음 두 층으로 구성한다.

```text
1. 게이트 디바이스 등록(설치 시 1회)
   - 운영 담당자가 관리자 화면에서 게이트 ID + 공연/구역을 지정해 발급
   - 게이트 PWA는 이 토큰을 IndexedDB(로컬 저장, 서버 재발급 전까지 유효)에 저장
   - 토큰 자체는 짧은 TTL이 아니라 "게이트 세션"으로 관리(공연 종료 시 관리자가 폐기)

2. 게이트 운영자 로그인(교대 근무 단위)
   - 게이트 디바이스 토큰 위에 운영자 PIN 또는 짧은 코드 입력을 추가로 요구할 수 있음(선택)
   - 최소 요구사항은 게이트 디바이스 토큰만으로도 검증 가능해야 함(오프라인 대응, 아래 참조)
```

### `POST /api/gate/verify` 인증 추가

현재 `backend/api-router.js:779-782`는 다음과 같다.

```js
if (req.method === "POST" && url.pathname === "/api/gate/verify") {
  requireBody(body, ["ticketId", "ownerId", "expiresAt", "nonce", "signature"]);
  return verifyQr(db, body);
}
```

요청 바디의 `ticketId`, `ownerId`, `expiresAt`, `nonce`, `signature`만 맞으면 어떤 게이트 인증도 없이 호출할 수 있다. QR 자체가 20초 TTL이라 이 값들을 미리 알아내기는 어렵지만, 문제는 값 위조가 아니라 "누가 이 엔드포인트를 호출할 자격이 있는가"가 전혀 검증되지 않는다는 점이다. 스캐너가 아닌 임의의 클라이언트도 QR을 스캔한 사람보다 먼저(또는 나중에) 같은 요청을 재현해 정상 QR을 가로채 "사용됨" 처리할 수 있다.

수정안:

```js
if (req.method === "POST" && url.pathname === "/api/gate/verify") {
  requireBody(body, ["ticketId", "ownerId", "expiresAt", "nonce", "signature"]);
  const gate = requireGateSession(db, req); // 게이트 토큰 헤더 검증, 없으면 401 GATE_AUTH_REQUIRED
  return verifyQr(db, { ...body, gateId: gate.gateId, operatorId: gate.operatorId });
}
```

```js
function requireGateSession(db, req) {
  const token = req.headers["x-gate-token"];
  if (!token) throw httpError(401, "GATE_AUTH_REQUIRED", "게이트 인증 토큰이 필요합니다.");
  const gate = db.gateSessions.find((item) =>
    item.status === "ACTIVE" && timingSafeStringMatches(item.tokenHash, hash(token))
  );
  if (!gate) throw httpError(401, "GATE_AUTH_INVALID", "유효하지 않은 게이트 세션입니다.");
  return gate;
}
```

`verifyQr`(`backend/admission-qr.js:121-152`) 내부에도 `gateId`를 로그에 남기도록 확장한다 — 어느 게이트에서 어떤 QR이 소비됐는지는 분쟁 대응과 매크로 탐지 모두에 필요한 데이터다.

```js
appendLedger(db, ownerId || "GATE", valid ? "GATE_QR_ACCEPTED" : "GATE_QR_REJECTED", {
  ticketId,
  admissionCredentialId: credential?.id || null,
  gateId: gateId || "UNKNOWN",
  reason: valid ? "valid-dynamic-token-one-use-consumed" : "invalid-expired-or-replayed-token"
});
```

### 두 게이트 동시 스캔 시 원자적 1회 소비 보장

같은 QR을 두 게이트에서(또는 캡처된 화면을 다른 기기로 동시에) 스캔하는 경쟁 상황은 반드시 한쪽만 성공해야 한다. `verifyQr`은 이미 `ticket.currentQr.usedAt`과 `credential.status`를 검사·갱신하는 한 함수 안에서 처리하지만, 실제 서버가 다중 프로세스/다중 인스턴스로 스케일아웃되면 현재의 인메모리 `db` 객체 기준 검사-후-갱신 로직은 경쟁 조건에 노출된다.

```text
현재(단일 프로세스 인메모리 DB): 함수 호출이 이벤트 루프에서 원자적으로 실행되므로 안전하다.
확장 시(다중 인스턴스 + 공유 DB): 검사와 갱신 사이에 다른 요청이 끼어들 수 있다.
```

원자성 보장 방법:

```text
1. DB 레벨 조건부 업데이트를 단일 쿼리로 수행한다.
   UPDATE admission_credentials
   SET status = 'USED', used_at = now()
   WHERE ticket_id = $1 AND status = 'QR_ACTIVE'
   RETURNING *;
   → 영향받은 row가 0개면 이미 다른 요청이 먼저 처리한 것 → 실패 처리
   → 이 UPDATE 자체가 compare-and-swap 역할을 하므로 별도 락이 필요 없다.

2. 신호 하나가 이기고 나머지는 GATE_QR_REJECTED로 기록되어야 하며,
   "먼저 스캔한 게이트가 이긴다"를 명확한 정책으로 UI에도 표시한다
   (게이트 화면에 "이미 다른 게이트에서 입장 처리됨 · 19:02:41 · GATE-A"처럼 표시).

3. 두 게이트가 동시에 REJECTED를 받는 경우(둘 다 늦게 도착)는 없어야 한다 —
   조건부 업데이트가 반드시 한쪽만 성공시키므로 이는 구조적으로 보장된다.
```

### 오프라인 정책

공연장은 네트워크 품질이 나쁠 수 있으므로 게이트 PWA는 완전 온라인 의존 설계를 피해야 한다. 다만 QR이 20초 TTL이라는 점 때문에 "완전 오프라인 검증"은 위험하다(오프라인 중에는 재사용 여부를 확인할 수 없다).

```text
정책: 온라인 우선, 짧은 오프라인 유예만 허용한다.

온라인 정상: 매 스캔마다 서버에 실시간 검증 요청. 기본 동작.

일시적 오프라인(네트워크 끊김 수 초~수십 초):
  - 서명 자체(HMAC)는 게이트 디바이스에 사전 배포된 공개 검증용 키로 로컬 검증 가능
    (단, 이 키는 "위조 여부만" 확인하고 "이미 사용됨"은 확인 불가)
  - 로컬 검증 통과분은 "조건부 입장 허용 + 큐에 적재"로 처리
  - 네트워크 복귀 시 큐를 서버로 일괄 전송해 최종 확정
  - 같은 ticketId가 큐에서 두 번 이상 조건부 통과됐다면 서버가 최초 1건만 확정하고
    나머지는 사후 EXCEPTION_REVIEW 상태로 표시(운영자 수동 확인 대상)

장시간 오프라인(수 분 이상):
  - 조건부 허용을 계속 쌓는 것은 위험(같은 QR이 여러 게이트에서 반복 허용될 수 있음)
  - 정책: 게이트별로 조건부 허용 큐 상한(예: 게이트당 미확정 30건)을 두고,
    상한 초과 시 신규 스캔은 "네트워크 연결 후 재시도" 안내로 전환
  - 장시간 오프라인 상태 자체를 관리자 대시보드에 실시간 경고로 표시
```

## QR 화면 동적 워터마크(추적 코드) UI 설계

`backend/admission-qr.js:78`은 이미 `traceCode`를 생성한다.

```js
const traceCode = hash(`${ticket.id}:${nonce}:${now()}`).slice(0, 10).toUpperCase();
```

이 값은 `issueQr` 응답 객체에 포함되어 API 레벨에는 존재하지만, 이를 실제로 렌더링하는 프론트엔드 코드는 없다. `입장qr 문제점.md`가 제시한 표시 형태를 그대로 따른다.

```text
TG-8F3A · 19:02:20 · M-0421
```

구성 요소:

```text
TG-8F3A  — traceCode 앞 6자리(서버가 이미 생성)
19:02:20 — QR 발급 시각(issuedAt), 초 단위까지
M-0421   — ticketId 또는 credential.id 기반 짧은 표시용 코드(개인정보 아님)
```

렌더링 위치와 동작:

```text
1. QR 이미지 하단에 고정 텍스트로 표시(캡처하면 함께 찍히도록)
2. QR이 20초마다 갱신될 때 워터마크의 시각(HH:MM:SS)도 함께 갱신한다
3. 워터마크는 화면 안에서 미세하게 위치가 흔들리도록 한다(예: 좌우 2px 랜덤 오프셋,
   1초 간격) — 동일 지점 캡처 여러 장을 자동 비교로 걸러내기 어렵게 만드는 보조 장치
4. 폰트 크기는 QR보다 작게, 대비는 낮지 않게 — 육안 식별은 쉽되 QR 스캔에는 간섭하지 않도록
   QR 코드 quiet zone 바깥에 배치한다
```

캡처 이미지가 중고 거래 사이트에 올라왔을 때의 대응 흐름:

```text
1. 캡처 이미지에서 traceCode 앞 6자리를 육안으로 확인(신고/모니터링 담당자)
2. db.qrIssueLogs에서 traceCode로 조회
   → ticketId, credentialId, userId, deviceId, issuedAt 역추적
3. 해당 티켓의 admissionCredential을 adminHold 처리
4. 계정에 risk_score 가중치 반영, 반복 시 WATCHLIST 전환
```

traceCode는 서명 검증에 관여하지 않는 순수 표시값이므로(3장에서 다룬 SafeTix의 실패 사례와 달리), 유출되어도 QR 위조 수단이 되지 않는다. 이 성질은 반드시 유지해야 한다 — traceCode 생성식에 서명 검증 로직이 의존하게 만들면 안 된다.

## 위험도 기반 단계적 마찰 정책

`입장qr 문제점.md`가 제시한 구간을 실제 API 응답으로 구체화한다.

```text
risk_score < 30   : 정상 — 추가 조치 없음
risk_score 30~60  : OTP 1회
risk_score 60~80  : QR 열람 지연(예: 30초 대기 화면) 또는 고객센터 확인
risk_score 80 이상: QR 보류(ADMIN_HOLD) 또는 구매 제한
```

현재 코드는 `isRiskUser`(`backend/admission.js:26-28`)로 `WATCHLIST` 상태 또는 `trustScore < 50`만 이진 판정한다. 이를 연속 구간으로 확장한다.

```js
function riskScoreFor(user, context) {
  let score = 0;
  if (user.status === "WATCHLIST") score += 40;
  if (user.trustScore < 50) score += 100 - user.trustScore;
  if (context.newDeviceSinceLastAdmission) score += 20;
  if (context.holderIdentityMismatchRecent) score += 30;
  if (context.multipleAccountsSameIdentity) score += 25;
  return Math.min(score, 100);
}

function riskGate(score) {
  if (score < 30) return { action: "ALLOW" };
  if (score < 60) return { action: "OTP_REQUIRED" };
  if (score < 80) return { action: "DELAY_OR_SUPPORT_CHECK", delaySeconds: 30 };
  return { action: "HOLD", requiresAdminReview: true };
}
```

`issueQr`(`backend/admission-qr.js:65-67`)의 이진 분기를 `riskGate` 결과로 대체한다.

```js
const gate = riskGate(riskScoreFor(user, riskContext));
if (gate.action === "HOLD" && !emergencyAllowed) {
  throw httpError(423, "RISK_HOLD_ACTIVE", "위험도 평가에 따라 QR 발급이 보류되었습니다.", gate);
}
if (gate.action === "OTP_REQUIRED" && otpVerified !== true && !emergencyAllowed) {
  throw httpError(403, "OTP_REQUIRED", "추가 인증이 필요합니다.");
}
if (gate.action === "DELAY_OR_SUPPORT_CHECK" && !emergencyAllowed) {
  throw httpError(409, "DELAY_REQUIRED", "잠시 후 다시 시도하거나 고객센터 확인이 필요합니다.", gate);
}
```

사용자 경험 목표는 그대로 유지한다.

```text
정상 사용자 95%는 risk_score < 30 구간에서 마찰 없이 통과한다.
위험 신호가 쌓인 5%만 단계적으로 강한 확인을 거친다.
```

## 구현 단계

```text
1단계: QR 발급 API 보안 경계 수정 (5장)
  - resolvePurchaseUserId를 /api/tickets/qr, /api/tickets/virtual-qr에 적용
  - 회귀 테스트: 세션 없이 body.userId만 보내는 기존 호출 경로가 의도대로 막히는지 확인

2단계: 게이트 인증 경계 도입 (6장)
  - gateSessions 테이블/토큰 발급 관리 화면
  - POST /api/gate/verify에 requireGateSession 적용
  - 이슈 #107의 "게이트 검증 장비/운영자 앱의 권한 경계" 선행 조건 충족

3단계: 게이트 스캐너 PWA MVP
  - BarcodeDetector 우선, jsQR 폴백
  - 게이트 디바이스 등록 플로우, IndexedDB 토큰 저장
  - 조건부 업데이트 기반 원자적 1회 소비 처리
  - 온라인 우선 + 짧은 오프라인 유예 큐

4단계: QR 화면 동적 워터마크 UI
  - traceCode 표시 컴포넌트, 20초 갱신 동기화
  - 캡처 신고 대응 운영 절차(traceCode → qrIssueLogs 역추적) 문서화

5단계: 위험도 단계적 마찰 정책 고도화 (8장)
  - riskScoreFor/riskGate 도입, 이진 판정에서 4단계 구간으로 확장

6단계: iOS App Attest 실제 통합 (3장)
  - DCAppAttestService 연동, challenge/attestKey/generateAssertion 플로우
  - 서버 측 인증서 체인 검증 및 counter 기반 replay 방지

7단계: holderIdentityKeyHash 연결 (5장)
  - 휴대폰 본인인증.md 스키마(users.identityKeyHash, ticketEntitlements.holderIdentityKeyHash)
    도입과 동기화해서 진행 — 이 필드가 먼저 존재해야 QR 발급 로직에 연결 가능
  - ensureAdmissionCredential에 HOLDER_IDENTITY_MISMATCH 검증 추가

8단계: Android Play Integrity 실제 통합 (4장)
  - Android 네이티브 앱 개발 착수 시점에 맞춰 진행
  - 스키마 변경 불필요(platform 필드 이미 자유 문자열), 검증 로직만 플랫폼 분기
```

1~5단계는 기존 웹/PWA 스택만으로 진행 가능하며 네이티브 앱 개발을 기다릴 필요가 없다. 6~8단계는 각각 iOS/Android 네이티브 앱 존재를 전제로 한다.

## 테스트 계획

기존 `tests/admission-flow.test.mjs`가 이미 다음을 커버한다.

```text
가상티켓 발급 → 앱 전용 QR 발급 → 1회 사용 게이트 검증 정상 흐름
서명은 유효하지만 이미 대체된(superseded) QR의 게이트 거부
웹 채널 QR 발급 거부, 조기 QR 활성화 거부, 위조된 앱 인증 거부
공식 재판매 시 이전 소유자의 관리자 보류 해제 후 신규 소유자 QR 발급
```

이번 계획서가 추가해야 하는 테스트:

```text
1. 두 기기 동시 스캔 경쟁
   - 같은 유효 QR을 두 게이트 세션에서 동시에(레이스 컨디션 시뮬레이션) 검증 요청
   - 정확히 1건만 valid: true, 나머지는 GATE_QR_REJECTED + "다른 게이트에서 처리됨" 사유
   - 조건부 업데이트(UPDATE ... WHERE status = 'QR_ACTIVE') 도입 후에도
     동시 100회 요청 시 정확히 1건만 성공하는지 부하 테스트로 검증

2. 만료/재사용 거부
   - 20초 경과 후 검증 시도 → REAL_QR_NOT_READY 계열이 아닌 만료 사유로 거부
   - 동일 QR 2회 검증 시도 → 두 번째는 무조건 거부, credential.status가 USED로 고정되는지 확인

3. 신뢰 기기 등록/해제
   - 생체인증만 있고 attestationVerified 없는 등록 시도 → APP_ATTESTATION_REQUIRED
   - attestationVerified만 있고 biometricVerified 없는 등록 시도 → DEVICE_VERIFICATION_REQUIRED
   - 신뢰 기기 해제(status != TRUSTED) 후 QR 발급 시도 → TRUSTED_DEVICE_REQUIRED

4. 위험도 단계별 마찰
   - risk_score 0~29: OTP 없이 정상 발급
   - risk_score 30~59: otpVerified 없이 요청 시 OTP_REQUIRED, otpVerified: true면 통과
   - risk_score 60~79: DELAY_REQUIRED 응답, 지연 후 재시도 시 통과
   - risk_score 80+: RISK_HOLD_ACTIVE, 관리자 emergencyOverride로만 우회 가능하고
     emergencyReason이 ledger에 남는지 확인

5. QR 발급 API 세션 검증 (5장 수정 이후)
   - 세션 없이 body.userId만 다른 사용자 ID로 보낸 요청 → 실제 티켓 소유자가 아니면 거부
   - 로그인 세션이 있는 정상 사용자 → 기존과 동일하게 정상 발급

6. 게이트 인증 경계 (6장 도입 이후)
   - x-gate-token 헤더 없이 /api/gate/verify 호출 → GATE_AUTH_REQUIRED
   - 폐기된(status != ACTIVE) 게이트 토큰으로 호출 → GATE_AUTH_INVALID
   - 유효한 게이트 토큰 + 유효한 QR → 정상 처리, 로그에 gateId 기록 확인

7. holderIdentityKeyHash 불일치 (7장 도입 이후)
   - 계정 프로필만 구매자 정보로 바뀌고 identityKeyHash가 예매 시점 값과 다른 상태에서
     QR 발급 시도 → HOLDER_IDENTITY_MISMATCH
   - 공식 양도 완료 후에는 새 holderIdentityKeyHash로 정상 발급되는지 확인

8. 오프라인 유예 큐
   - 오프라인 상태에서 로컬 서명 검증만으로 조건부 허용된 스캔이 큐에 쌓이는지 확인
   - 네트워크 복귀 후 큐 일괄 전송 시 중복 ticketId는 1건만 확정되고 나머지는
     EXCEPTION_REVIEW로 전환되는지 확인
   - 게이트당 미확정 큐 상한 초과 시 신규 스캔이 재시도 안내로 전환되는지 확인
```

## 참고 자료

- Apple, DCAppAttestService (App Attest 공식 API 문서): https://developer.apple.com/documentation/devicecheck/dcappattestservice
- Apple, Preparing to use the app attest service: https://developer.apple.com/documentation/devicecheck/preparing-to-use-the-app-attest-service
- Apple, Mitigate fraud with App Attest and DeviceCheck (WWDC21): https://developer.apple.com/videos/play/wwdc2021/10244/
- Apple, Secure your apps with App Attest (WWDC26): https://developer.apple.com/videos/play/wwdc2026/201/
- Google, Play Integrity API 개요: https://developer.android.com/google/play/integrity/overview
- Google, Make a standard API request (Play Integrity): https://developer.android.com/google/play/integrity/standard
- Google, Play Console 도움말 — Play Integrity API로 위험 상호작용 탐지: https://support.google.com/googleplay/android-developer/answer/11395166
- Google, Play Integrity API 위협 탐지 강화 발표(2025): https://android-developers.googleblog.com/2025/10/stronger-threat-detection-simpler.html
- conduition.io, Reverse Engineering TicketMaster's Rotating Barcodes (SafeTix) — TOTP 구조, 취약점 분석: https://conduition.io/coding/ticketmaster/
- Hackaday, Ticketmaster SafeTix Reverse-Engineered: https://hackaday.com/2024/07/11/ticketmaster-safetix-reverse-engineered/
- AXS Help Centre, Do I need the AXS App to use my AXS mobile ID tickets?: https://support.axs.com/hc/en-gb/articles/201086794-Do-I-need-the-AXS-App-to-use-my-AXS-mobile-ID-tickets-
- Ticketground GitHub 이슈 #107 (모바일 티켓 QR 발급·입장 검증 연동, OPEN): 저장소 이슈 트래커
- Ticketground 문서: `휴대폰 본인인증.md`, `입장qr 문제점.md`
