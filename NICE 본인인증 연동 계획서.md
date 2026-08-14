# NICE 본인인증(NICE ID) 표준창 연동 계획

## 배경과 목적

Ticketground의 본인인증 정책은 `휴대폰 본인인증.md`에 정의되어 있다. 요지만 다시 적는다.

```text
계정 프로필 변경 != 티켓 소유자 변경 != 현장 발권 대상자 변경
```

본인확인기관에서 받은 CI/DI 같은 동일인 식별값을 `identityKeyHash = HMAC(serverSecret, provider + ":" + ciOrDi)` 형태로 해시해 `users.identityKeyHash`, `ticketEntitlements.holderIdentityKeyHash`에 저장하고, 재인증 시 이 값을 비교해 계정 프로필 변경과 티켓 발권 대상자 변경을 분리한다. 이 문서는 그 정책을 구현하는 본인확인 채널 — NICE평가정보 표준창(CheckPlus 계열) 직접 연동 — 의 도입 계획을 다룬다. 정책 자체의 근거와 판정 기준, 위험도 표는 `휴대폰 본인인증.md`를 그대로 따르며 이 문서에서 반복하지 않는다.

## 본인인증 채널 구성

NICE 표준창이 Ticketground의 유일한 본인인증 채널이다. 휴대폰 본인인증(상품 코드 CK622)에 더해 **성인인증**도 함께 도입한다.

재사용할 기존 코드 패턴 (provider와 무관한 순수 로직):

- `assertIdentityCanBeVerified` — 같은 phoneHash/personHash가 다른 계정에 이미 인증되어 있는지 판정
- `maskPhoneNumber`, `normalizePhoneNumber` — 휴대폰 번호 정규화/마스킹
- `appendLedger` — 인증 시작/완료 이벤트 기록

`provider` 필드는 항상 `"nice-standard"`로 기록한다.

## 성인인증 도입

휴대폰 본인인증(CK622)에 더해 **성인인증**도 NICE로 도입한다. 두 상품 모두 같은 Client ID/Secret(같은 NICE 계약)을 쓰고 상품 코드만 다른 것으로 보이나, 정확한 사양은 재검증이 필요하다.

미확정 사항:

- 성인인증 상품 코드가 아직 없다. `auth-guide.niceid.co.kr` 연동정보 페이지에서 휴대폰(CK622)과 별도로 발급받아야 하는데, **이 상품은 별도 비용이 발생한다.** 그래서 이번 라운드에서는 발급을 진행하지 않고 미결정으로 남긴다 — 예산이 승인되면 그때 발급받아 진행한다. 휴대폰 본인인증 구현은 이 결정을 기다리지 않고 먼저 진행한다(아래 로드맵 참고).
- 성인인증을 **어느 시점에 요구할지는 지금 확인 불가하다** — 도입 자체는 확정이지만 시점(회원가입 시 전원 / 성인 전용 티켓 구매 시 / 휴대폰 인증과 동시)은 아직 정해지지 않았고, 언제 정해질지도 모른다. 그래서 이 결정을 기다리지 않고 진행한다: API/데이터 계층(`product: "adult"`)은 지금 만들어 두되, 어디서 언제 요구할지를 코드에 하드코딩하지 않고 **켜고 끌 수 있는 설정**(예: 관리자 설정값 또는 티켓/이벤트 단위 플래그)으로 둔다. 시점이 정해지면 그 설정만 켜면 되게 한다.
- 성인인증 결과에서 실제로 받는 데이터 항목(성인여부만인지, 생년월일도 포함되는지)은 가이드 원문 재검증이 필요하다.

권장 저장 원칙(휴대폰 본인인증과 동일한 최소수집 원칙): 생년월일 원문은 저장하지 않고 **성인 여부(boolean)** 만 저장한다. CI/DI는 휴대폰 인증과 동일하게 해시로만 저장한다.

## 기술 연동 흐름 개요

아래는 NICE ID 같은 CheckPlus 계열 표준창 연동의 일반적인 단계를 서술한 것이다. **정확한 API 엔드포인트 경로, 요청/응답 파라미터명, 암복호화 알고리즘 스펙은 이 문서에서 확정하지 않는다. 실제 구현 착수 전 auth-guide.niceid.co.kr의 최신 개발가이드 원문으로 반드시 재검증해야 한다.** 아래 내용은 지식 기반의 일반적인 흐름 설명이며, NICE의 실제 API 사양과 다를 수 있다.

```text
1. 서버가 Client ID/Client Secret으로 OAuth 방식 access token을 발급받는다.
2. 서버가 access token으로 요청 데이터(암호화 토큰)를 생성한다.
   여기에 요청 번호, 상품 코드(휴대폰 CK622 또는 성인인증 코드),
   결과 수신용 콜백(리턴) URL 등이 포함되는 것이 일반적이다.
3. 브라우저에서 표준창 팝업을 연다 (폼 POST 방식으로 암호화 토큰을 전달).
4. 사용자가 팝업 안에서 본인확인 절차를 진행한다.
5. NICE가 서버가 지정한 콜백 URL로 암호화된 결과를 전달한다.
6. 서버가 access token으로 결과를 복호화한다.
7. 복호화 결과에서 CI/DI, 이름, 생년월일, 성별, 통신사, 휴대폰번호,
   내/외국인 여부, (성인인증 상품이면) 성인 여부 등을 받는다.
8. CI/DI 값으로 identityKeyHash를 계산해 기존 정책(휴대폰 본인인증.md)대로 처리한다.
```

NICE 표준창은 일반적으로 "NICE가 지정된 콜백 URL로 결과를 직접 POST"하는 push(콜백) 방식이라, 서버 쪽에 콜백 수신 엔드포인트가 필요하다. 이 부분도 가이드 원문으로 재검증해야 한다.

## 콜백(리턴) URL

**테스트 도메인과 운영 도메인이 분리되어 있고, 지금은 테스트 도메인만 쓴다.**

```text
지금 (테스트): https://dev.ticketground.co.kr/api/identity/nice/callback
나중 (운영):   https://ticketground.co.kr/api/identity/nice/callback
```

진행 방식: `dev.ticketground.co.kr`에 콜백 URL을 등록해 NICE 표준창 연동 전체(팝업 → 콜백 수신 → 복호화 → CI/DI 처리)를 먼저 검증한다. 검증이 끝나면 같은 코드를 그대로 운영 도메인(`ticketground.co.kr`)으로 옮기고, NICE 콘솔에도 운영 콜백 URL을 추가로 등록한다.

NICE 표준창은 카카오/네이버 로그인처럼 요청 Host를 그대로 써서 콜백 URL을 동적으로 만드는 방식(간편로그인-수정금지-지침.md 참고)이 아니라, **사전에 고정된 URL을 NICE 콘솔에 등록**해야 하는 방식으로 보인다(가이드 원문으로 재검증 필요). `localhost:5501`이나 Tailscale IP 같은 로컬 주소로는 NICE 콜백을 직접 받을 수 없으므로, 로컬 개발 중 코드를 짤 때는 목(mock) 모드(`TIG_NICE_IDENTITY_TEST_MODE`, 아래 참고)로 진행하고, 실제 콜백 수신 검증은 `dev.ticketground.co.kr`에 배포한 뒤에 한다.

`dev.ticketground.co.kr`은 아직 배포되어 있지 않다 — NICE 연동 코드(위 로드맵 4~7단계)를 먼저 만들고, 그 코드를 완성해서 이 도메인에 배포한 뒤 실제 콜백 수신을 검증한다. 최종 배포(운영) 페이지는 `ticketground.co.kr`이다.

## 환경변수 설계

`.env.local`에 채워져 있고 `.env.local.example`에 자리표시자가 있는 값(NICE 콘솔에서 Client ID/Secret을 모두 "Secret Key"로 분류하므로, 카카오 REST API 키처럼 공개 식별자로 취급하지 않고 둘 다 `.env.local`에 둔다):

```text
TIG_NICE_CLIENT_ID
TIG_NICE_CLIENT_SECRET
TIG_NICE_PRODUCT_CODE_PHONE=CK622
TIG_NICE_PRODUCT_CODE_ADULT      ← 아직 미발급 (위 "성인인증 도입" 참고)
TIG_NICE_CALLBACK_RETURN_URL=https://dev.ticketground.co.kr/api/identity/nice/callback
                                  ← 지금은 테스트 도메인 값. 운영 전환 시
                                    https://ticketground.co.kr/api/identity/nice/callback로 교체
```

구현 단계에서 추가로 필요할 수 있는 변수(제안, 확정 아님):

```text
TIG_NICE_IDENTITY_TEST_MODE
  → 로컬/CI에서 실제 NICE API를 호출하지 않고 목(mock) 경로로
    테스트를 통과시키기 위한 플래그.

TIG_NICE_API_BASE_URL (필요시)
  → 샌드박스/운영 API 베이스 URL이 분리되어 있다면 필요. 실제로 필요한지,
    엔드포인트가 무엇인지는 가이드 재검증 후 확정한다.
```

이 문서에는 실제 키 값을 적지 않는다. `.env.local`의 실제 값은 이미 채워져 있으므로 별도로 물어볼 필요가 없다.

## API/데이터 설계 초안

휴대폰 본인인증과 성인인증 두 상품 모두 같은 흐름을 쓰되 상품 코드만 다르므로, start 요청에 상품 구분 파라미터를 둔다.

```text
POST /api/identity/nice/start
  body: { product: "phone" | "adult" }
→ 서버가 access token 발급 + 상품 코드(TIG_NICE_PRODUCT_CODE_PHONE 또는
  TIG_NICE_PRODUCT_CODE_ADULT)에 맞는 요청 데이터 생성
→ 브라우저가 표준창 팝업을 열 수 있는 정보 반환

POST /api/identity/nice/callback
→ NICE가 인증 결과를 전달하는 수신 엔드포인트 (상품 공용)
→ access token으로 결과 복호화
→ CI/DI 추출 → identityKeyHash(personHash) 계산
→ 기존 assertIdentityCanBeVerified로 중복 판정
→ product가 "adult"면 성인 여부(boolean)도 함께 저장
```

기존 `GET /api/users/:userId/identity` 조회 엔드포인트는 그대로 재사용하되, 응답 필드를 NICE 연동 상태(`niceConfigured`, 상품별 인증 여부 등) 기준으로 채운다.

데이터 저장 형태:

```text
db.identityVerifications[]
  - provider: "nice-standard"
  - product: "phone" | "adult"
  - phoneHash / personHash — 동일한 해시 함수 사용

user.identityVerification
  - provider: "nice-standard"
  - phoneVerifiedAt   (product: phone 인증 완료 시각)
  - adultVerifiedAt   (product: adult 인증 완료 시각, 미인증이면 null)
  - isAdult            (boolean — 성인인증 결과. 생년월일 원문은 저장하지 않는다)
```

## 보안/개인정보 체크리스트

- CI/DI 원문은 저장하지 않는다. `휴대폰 본인인증.md`의 `identityKeyHash = HMAC(serverSecret, provider + ":" + ciOrDi)` 규칙을 그대로 따르고, provider 문자열에 `"nice-standard"`를 사용한다.
- 성인인증도 최소수집 원칙을 따른다 — 생년월일 원문 대신 성인 여부(boolean)만 저장한다.
- 콜백 요청 위변조 방지: NICE가 보내는 콜백 결과는 access token 기반 복호화 자체가 무결성 검증을 겸하는지, 별도 서명/무결성 값이 있는지 가이드 원문으로 확인하고, 복호화 실패·서명 불일치 시 즉시 거부한다.
- 로그에 개인정보/CI·DI 원문을 남기지 않는다. `appendLedger` 호출도 `phoneHash`/`personHash`(해시값)만 기록하고 원문 전화번호나 CI/DI를 넣지 않는다.
- HTTPS 강제 — 콜백 URL, 팝업 진입 URL 모두 HTTPS만 허용한다 (테스트: `https://dev.ticketground.co.kr/...`, 운영: `https://ticketground.co.kr/...`).
- 토큰 재사용(replay) 방지 — access token, 요청 데이터, 콜백 결과에 재사용 방지를 위한 1회성 값(요청 번호 등)이 있는지 가이드로 확인하고, 서버 쪽에서도 동일 결과값의 중복 처리를 막는다.
- `.env.local` 시크릿 취급 원칙은 `간편로그인-수정금지-지침.md`를 그대로 따른다 — `TIG_NICE_CLIENT_ID`/`TIG_NICE_CLIENT_SECRET`은 둘 다 `.env.local`에만 두고 절대 커밋하지 않는다.
- `.env`, `.env.local`, `.env.example`, `.env.local.example`은 `.github/scripts/ticketground-bot.cjs`의 `PROTECTED_AUTH_PATTERNS`(`/^\.env(?:\.|$)/`)에 걸리는 보호 대상 파일이다. 구현 PR에서 이 파일들을 수정할 때는 AGENTS.md 코드 리뷰 규칙에 따라 "사용자가 요청한 변경임을 PR에 명시"해야 한다.

## 테스트 계획

`tests/identity-payment-gate.test.mjs`에 본인인증-결제 게이트 테스트가 이미 있다. NICE 기준으로 새로 작성한다.

- `/api/identity/nice/start`(phone/adult 각각), `/api/identity/nice/callback`에 대한 mock 기반 단위/통합 테스트 (`TIG_NICE_IDENTITY_TEST_MODE`로 실제 NICE API 호출 없이 결정적으로 테스트).
- 미인증 상태 결제 차단, 동일 phoneHash/personHash 중복 인증 차단(`PHONE_ALREADY_VERIFIED`), 본인 계정 외 조회 차단.
- 콜백 위변조/복호화 실패 시나리오에 대한 실패 테스트(보안 체크리스트 항목의 회귀 방지용).
- 성인인증: `isAdult`가 false/미인증 상태에서 (요구 시점 설정이 켜졌을 때) 성인 전용 티켓 구매가 차단되는지에 대한 테스트. 요구 시점 설정이 꺼져 있으면 차단하지 않는다는 것도 함께 테스트한다.
- `dev.ticketground.co.kr`에 배포한 뒤 실제 NICE 표준창 팝업 → 콜백 수신 E2E 확인.

## 단계별 실행 로드맵

```text
1. auth-guide.niceid.co.kr 최신 개발가이드 원문 재검증
   (엔드포인트, 파라미터, 암복호화 스펙, 콜백 방식 확정)
2. 테스트 콜백 URL(https://dev.ticketground.co.kr/api/identity/nice/callback)을
   NICE 콘솔에 등록
3. backend/identity.js에 NICE용 헬퍼 추가
   (기존 assertIdentityCanBeVerified / maskPhoneNumber /
    normalizePhoneNumber / appendLedger 재사용)
4. backend/api-router.js에 /api/identity/nice/start, /callback 라우트 등록
5. checkout-panel.tsx에 NICE 휴대폰 인증 UI 연동
   (성인인증 UI는 상품 코드 발급 후 별도 착수 — 아래 참고)
6. tests/ 에 NICE 휴대폰 인증 경로 mock/통합 테스트 추가
7. dev.ticketground.co.kr에 배포해 실제 콜백 수신 E2E 검증
8. 검증 완료 후 같은 코드를 운영 도메인(ticketground.co.kr)으로 이전,
   NICE 콘솔에 운영 콜백 URL 추가 등록
9. 운영 전환 (휴대폰 본인인증)

──────────────────────────────────────────────
성인인증 (예산 승인 후, 위와 독립적으로 진행):
──────────────────────────────────────────────
A. 성인인증 상품 코드 발급 (비용 발생 — 예산 승인 필요)
B. 위 1~4단계와 같은 방식으로 성인인증 경로(product: "adult") 추가
   (API/데이터 설계는 이미 phone/adult 공용으로 만들어 두므로 코드 재사용)
C. 요구 시점이 정해지면 설정을 켜서 UI/차단 로직 활성화
```

## 결정 및 보류 사항

이번 라운드에서 필요한 결정은 끝났다. 휴대폰 본인인증 NICE 연동은 바로 착수 가능하다.

**보류 (예산 승인 후 별도 진행, 휴대폰 인증 착수를 막지 않음):**

- **성인인증 상품 코드 발급** — 별도 비용이 발생해 이번 라운드에서는 진행하지 않는다. 예산이 승인되면 그때 auth-guide.niceid.co.kr에서 발급받아 로드맵의 "성인인증" 단계(A~C)를 진행한다.

**확인됨:**

- 성인인증 요구 시점 — 지금은 정할 수 없다고 확인됨. 도입은 확정이나 시점은 미정이므로, 시점을 코드에 하드코딩하지 않고 설정으로 켜고 끌 수 있게 설계한다.
- 배포 도메인 — 테스트: `dev.ticketground.co.kr`(아직 미배포, NICE 연동 코드 완성 후 배포), 운영: `ticketground.co.kr`.

## 참고 자료

- `휴대폰 본인인증.md` — 본인인증 도입 정책, CI/DI 사용 기준, 판정 플로우
- `backend/identity.js` — 본인인증 백엔드 로직이 구현될 위치
- `src/components/ticketing/checkout-panel.tsx` — 본인인증 프론트 연동
- `tests/identity-payment-gate.test.mjs` — 본인인증-결제 게이트 테스트
- `간편로그인-수정금지-지침.md` — `.env`/`.env.local` 공개 식별자/비밀 값 분리 관례
- `.env.local.example` — NICE 환경변수 자리표시자
- auth-guide.niceid.co.kr — NICE 본인인증 개발가이드 (사용자 제공, 구현 착수 전 원문 재검증 필요)
- KISA 본인확인기관 현황: https://identity.kisa.or.kr/web/main/contents/M010-03
