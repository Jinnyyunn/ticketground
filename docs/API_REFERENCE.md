# Ticketground Backend API Reference

모바일 앱에서 호출할 Ticketground backend API 정리 문서입니다. 이 서버는 UI 없이 `/api/*` 요청만 처리하는 API 전용 서버입니다.

## Base URL

```
http://132.145.109.87:4174
```

- `/api/` 로 시작하지 않는 모든 경로는 404를 반환합니다 (UI를 제공하지 않음).
- `/api/admin/*` 및 `/api/ledger`는 이 포트에서 항상 404입니다 (관리자 전용 API는 별도 서버에서만 서비스되며 외부에 공개되지 않습니다).

## 공통 응답 형식

**성공 (HTTP 200)**
```json
{ "ok": true, "data": { /* 엔드포인트별 결과 */ } }
```

**실패 (HTTP 4xx/5xx)**
```json
{
  "ok": false,
  "error": { "code": "MISSING_FIELD", "message": "userId 값이 필요합니다.", "detail": {} }
}
```

## 인증

- 대부분의 공개 엔드포인트는 아직 별도 로그인 토큰 없이 `userId`를 요청 본문/쿼리로 직접 전달하는 데모 방식도 허용합니다 (세션 쿠키 기반 인증 없음).
- `GET /api/users/:userId/session` 및 `POST /api/auth/google` 성공 응답은 모바일용 `sessionToken`을 함께 반환합니다.
- 모바일 앱은 이후 요청에 `Authorization: Bearer <sessionToken>`을 보낼 수 있습니다.
- **현재 토큰 enforcement는 optional/best-effort입니다.** 토큰이 없으면 기존 웹 UI 호환을 위해 오늘과 동일하게 허용합니다. 단, 토큰이 있으면 URL/body의 `userId`, `buyerId`, `sellerId` 등 소유자 필드와 반드시 일치해야 하며, 불일치 시 `403 TOKEN_USER_MISMATCH`를 반환합니다. 토큰을 mandatory로 바꾸는 것은 기존 caller를 모두 전환한 뒤 별도 결정해야 합니다.
- 소셜 로그인(Google/Kakao/Naver)은 `/api/auth/*` 참고.
- **앱 전용 서명(App Attestation)이 필요한 엔드포인트가 2개 있습니다** — `POST /api/devices/trust`, `POST /api/tickets/qr` (channel=`APP`인 경우). 아래 "App Attestation" 절 참고.

### App Attestation 서명 계산법

서버는 `TIG_APP_ATTESTATION_SECRET` 환경변수를 HMAC 키로 사용합니다.

1. 먼저 `GET /api/devices/attestation-nonce?purpose=TRUST_DEVICE|ISSUE_QR`로 서버 발급 nonce를 받습니다.
2. nonce는 약 2분 동안만 유효하며 성공 검증 시 1회 사용 후 폐기됩니다.
3. body에는 `nonce`와 아래 공식으로 계산한 `appAttestation`을 함께 보냅니다.

```
appAttestation = HMAC_SHA256(secret, "app:" + purpose + ":" + nonce + ":" + part1 + ":" + part2 + ...)
```
(hex 인코딩, 결과를 body의 `appAttestation` 필드로 전달)

| 엔드포인트 | purpose | parts |
|---|---|---|
| `POST /api/devices/trust` | `TRUST_DEVICE` | `[userId, deviceId]` |
| `POST /api/tickets/qr` (channel=APP) | `ISSUE_QR` | `[userId, deviceId, ticketId]` |

> **확인 필요**: 서버 `.env.production`에 `TIG_APP_ATTESTATION_SECRET`이 고정값으로 설정되어 있는지 확인이 필요합니다. 설정 안 되어 있으면 서버 재시작마다 랜덤 값으로 바뀌어서 앱에서 서명을 미리 계산해둘 수 없습니다 — 확인 후 모바일 개발자에게 별도로 안전하게 전달해야 합니다.

## 엔드포인트

### 조회 (GET)

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/health` | DB를 읽거나 저장하지 않는 경량 연결 상태 확인 |
| GET | `/api/app/config` | 앱 최소/권장 버전, 점검 모드, 앱 채널 필수 엔드포인트 목록 |
| GET | `/api/devices/attestation-nonce?purpose=` | 앱 attestation용 1회성 nonce 발급 |
| GET | `/api/state` | 공개 상태 스냅샷. 기본 응답은 전체 `tickets` 배열을 제외하고 `backendSummary.tickets` 카운트만 포함 |
| GET | `/api/state?include=tickets` | 기존 웹 UI 호환용 전체 티켓 포함 상태 스냅샷 |
| GET | `/api/catalog?limit=&cursor=` | 공개 공연 카탈로그. `limit/cursor`가 없으면 기존처럼 전체 반환 |
| GET | `/api/seat-map?category=&venueId=&eventId=` | 좌석 맵 조회 |
| GET | `/api/events/:eventId/seat-map` | 특정 이벤트의 장소 좌석 맵 |
| GET | `/api/users/:userId/session` | 데모 세션/유저 프로필 조회 |
| GET | `/api/users/:userId/identity` | 본인인증 상태 조회 |
| GET | `/api/users/:userId/tickets` | 유저 보유 티켓 목록 |
| GET | `/api/users/:userId/watchlist` | 유저 관심목록 |
| GET | `/api/support/threads?userId=` | 고객문의 스레드 조회 |
| GET | `/api/payments/bootpay/config` | BootPay 결제 설정값 |
| GET | `/api/auth/kakao/start` / `/api/auth/naver/start` | 소셜 로그인 시작 (리다이렉트) |
| GET | `/api/auth/kakao/callback` / `/api/auth/naver/callback` | 소셜 로그인 콜백 |
| GET | `/api/auth/kakao/session` / `/api/auth/naver/session` | 소셜 로그인 세션 조회 |

### 변경 (POST)

| Method | Path | 필수 body 필드 | 설명 |
|---|---|---|---|
| POST | `/api/auth/google` | `credential` | Google 로그인 |
| POST | `/api/identity/portone-danal/start` | `userId, phone` | 본인인증 시작 |
| POST | `/api/identity/portone-danal/confirm` | `userId, phone, identityVerificationId` | 본인인증 확인 |
| POST | `/api/users/:userId/profile` | `name` | 데모 프로필 수정 |
| POST | `/api/watchlist` | `userId, eventId` | 관심목록 추가/토글 |
| POST | `/api/watchlist/notify` | - | 관심목록 알림 트리거 |
| POST | `/api/devices/push-token` | `userId, platform, token` | 푸시 토큰 등록/갱신 (`platform`: `ios` 또는 `android`) |
| POST | `/api/support/threads` | `userId, message` | 문의 스레드 생성 |
| POST | `/api/support/messages` | `threadId, actorId, message` | 문의 메시지 추가 |
| POST | `/api/tickets/buy` | `userId, ticketId` | 티켓 정가 구매 |
| POST | `/api/payments/bootpay/purchase` | `userId, ticketId, paymentMethod` | BootPay 결제 확정 + 구매 |
| POST | `/api/resale/list` | `sellerId, ticketId, price` | 리세일 등록 |
| POST | `/api/resale/join` | `buyerId, poolId` | 리세일 응모 참여 |
| POST | `/api/resale/cancel` | `sellerId, poolId` | 리세일 등록 취소 |
| POST | `/api/resale/draw` | `poolId` | 리세일 추첨 실행 |
| POST | `/api/resale/purchase` | `buyerId, poolId` | 리세일 즉시구매 |
| POST | `/api/security/direct-transfer-attempt` | `actorId, ticketId, targetUserId` | 직거래 양도 시도 차단 로직 |
| POST | `/api/devices/trust` | `userId, deviceId, biometricVerified, nonce` + **appAttestation** | 기기 신뢰 등록 |
| POST | `/api/tickets/qr` | `userId, ticketId` (APP 채널은 + `deviceId, nonce, appAttestation`) | 입장 QR 발급 |
| POST | `/api/tickets/virtual-qr` | `userId, ticketId` | 가상 QR 발급 |
| POST | `/api/gate/verify` | `ticketId, ownerId, expiresAt, nonce, signature` | 게이트 QR 검증 (입장 스캐너용) |

## 주요 응답 데이터 형태

**App Config** (`/api/app/config`)
```json
{
  "minSupportedVersion": "1.0.0",
  "recommendedVersion": "1.1.0",
  "maintenanceMode": false,
  "maintenanceMessage": "",
  "appChannelRequired": ["/api/devices/trust", "/api/tickets/qr"]
}
```

`TIG_APP_MIN_VERSION`, `TIG_APP_RECOMMENDED_VERSION`, `TIG_MAINTENANCE_MODE`, `TIG_MAINTENANCE_MESSAGE` 환경변수로 값을 바꿀 수 있으며 서비스 재시작 후 반영됩니다.

**Catalog** (`/api/catalog?limit=20&cursor=20`)
```json
{
  "events": [ /* 공개 이벤트 */ ],
  "venues": [ /* 공연장 */ ],
  "nextCursor": "40",
  "total": 128
}
```

`limit/cursor`를 생략하면 기존 caller 호환을 위해 전체 이벤트를 반환합니다.

**Ticket** (`publicTicket`)
```json
{
  "id": "tkt_...", "eventId": "...", "performanceDateId": "...", "zoneId": "...",
  "seatLabel": "...", "status": "ON_SALE", "available": true,
  "faceValue": 0, "minPrice": 0, "maxPrice": 0,
  "transferCount": 0, "maxTransferCount": 0, "issuedAt": "ISO-8601",
  "virtualQr": { "type": "...", "issuedAt": "ISO-8601" } | null
}
```

**구매 결과** (`/api/tickets/buy`, `/api/payments/bootpay/purchase`)
```json
{
  "ticket": { /* Ticket */ },
  "event": { "id": "...", "title": "...", "venue": "..." },
  "performanceDate": { /* ... */ },
  "payment": { "method": "...", "label": "...", "status": "..." },
  "admission": { "status": "...", "preparedAt": "...", "activeAt": "...", "activationChannel": "...", "riskStatus": "..." }
}
```

**리세일 풀** (`publicResalePool`)
```json
{
  "id": "...", "eventId": "...", "performanceDateId": "...", "zoneId": "...", "ticketId": "...",
  "sellerId": "...", "price": 0, "buyerFee": 0, "buyerTotal": 0, "sellerSettlement": 0,
  "buyerCount": 0, "status": "...", "createdAt": "...", "matchedAt": "..." | null
}
```

## 참고

- 이 서버는 개발 중인 전체 웹사이트(UI)와 별개로, 모바일 앱 전용으로 띄운 API-only 서버입니다 (`server.js`의 `API_PORT`).
- API-only 서버에는 메모리 기반 IP별 rate limit이 적용됩니다. GET은 POST보다 넉넉하고, 변경 요청은 더 낮은 한도로 제한됩니다.
- 푸시 발송은 현재 `pushTokens` 저장 및 watchlist notification 연결만 구현되어 있습니다. FCM/APNs 자격 증명과 실제 provider 연동은 아직 없으며, `backend/push-delivery.js`가 로그 + no-op stub으로 동작합니다.
- 소스: `backend_server` 브랜치, `backend/api-router.js`가 라우팅 진입점입니다.
- 요청/응답 형식이 바뀌면 이 문서도 같이 업데이트해주세요.

## 에러 코드 카탈로그

| code | HTTP | 발생 조건 | detail |
|---|---:|---|---|
| `ADMIN_ACCOUNT_EXISTS` | 409 | 같은 관리자 계정명이 이미 있음 | - |
| `ADMIN_ACCOUNT_NOT_FOUND` | 404 | 수정 대상 관리자 계정을 찾지 못함 | - |
| `ADMIN_ROLE_ESCALATION` | 403 | 보유하지 않은 권한을 다른 관리자에게 부여하려 함 | - |
| `ADMIN_SELF_UPDATE_DENIED` | 403 | 본인 관리자 계정 역할/ACL 직접 수정 시도 | - |
| `ADMIN_WORKSPACE_NOT_FOUND` | 404 | 존재하지 않는 관리자 작업공간 | - |
| `APP_ATTESTATION_REQUIRED` | 403 | 앱 attestation 누락/위조/만료/nonce 재사용 | - |
| `APP_CHANNEL_REQUIRED` | 403 | 실제 입장 QR을 웹 채널로 요청 | `allowedChannel`, `webPolicy` |
| `BAD_JSON` | 400 | JSON body 파싱 실패 | - |
| `BOOTPAY_PAYMENT_NOT_CONFIRMED` | 402 | BootPay 결제 승인 상태가 아님 | - |
| `BOOTPAY_TOKEN_FAILED` | 502 | BootPay 토큰 발급 실패 | - |
| `DANAL_PHONE_MISMATCH` | 422 | 입력 전화번호와 다날 인증 결과 불일치 | - |
| `DANAL_PHONE_NUMBER_UNAVAILABLE` | 422 | 다날 응답에서 전화번호 확인 불가 | - |
| `DEVICE_VERIFICATION_REQUIRED` | 403 | 생체/기기잠금 인증 결과가 true가 아님 | - |
| `DUPLICATE_ZONE_GRADE` | 422 | 관리자 이벤트 좌석 등급 중복 | - |
| `EMPTY_POOL` | 409 | 재판매 추첨 대기자가 없음 | - |
| `EMPTY_SUPPORT_MESSAGE` | 400 | 고객센터 메시지가 비어 있음 | - |
| `EVENT_ALREADY_EXISTS` | 409 | 같은 공연 초안이 이미 있음 | - |
| `EVENT_DATE_NOT_FOUND` | 404 | 공연 회차를 찾지 못함 | - |
| `EVENT_INVENTORY_TOO_LARGE` | 422 | 좌석 등급/회차가 허용 범위 초과 | - |
| `EVENT_NOT_FOUND` | 404 | 공연을 찾지 못함 | - |
| `EVENT_NOT_ON_SALE` | 409 | 판매 상태상 예매 불가 | - |
| `EVENT_SCHEDULE_IN_USE` | 409 | 보유/거래 티켓이 있는 회차 제거 시도 | - |
| `EVENT_SLUG_EXISTS` | 409 | 이미 사용 중인 공연 슬러그 | - |
| `EVENT_ZONE_IN_USE` | 409 | 보유/거래 티켓이 있는 좌석 등급 제거 시도 | - |
| `FORBIDDEN` | 403 | 허용되지 않는 정적 파일 경로 접근 | - |
| `GOOGLE_AUTH_INVALID` | 401 | Google credential 검증 실패 | - |
| `GOOGLE_AUTH_NOT_CONFIGURED` | 500 | Google client id 미설정 | - |
| `IDENTITY_VERIFICATION_NOT_FOUND` | 404 | 진행 중인 본인인증 요청 없음 | - |
| `IDENTITY_VERIFICATION_REQUIRED` | 403 | 티켓 결제 전 본인인증 필요 | - |
| `INVALID_ADMIN_IP_ACL` | 422 | 관리자 IP allowlist 형식 오류 | - |
| `INVALID_ADMIN_ROLE` | 422 | 관리자 역할 입력 오류 | - |
| `INVALID_ADMIN_USERNAME` | 422 | 관리자 아이디 형식 오류 | - |
| `INVALID_ATTESTATION_PURPOSE` | 422 | nonce 발급 purpose가 지원되지 않음 | - |
| `INVALID_EVENT_CATEGORY` | 422 | 지원하지 않는 행사 유형 | - |
| `INVALID_EVENT_CONTENT` | 422 | 공연 콘텐츠 배열/문자열 형식 오류 | - |
| `INVALID_EVENT_DATE` | 422 | 공연 개최 날짜 오류 | - |
| `INVALID_EVENT_IMAGE` | 422 | 포스터 형식/크기 오류 | - |
| `INVALID_EVENT_SCHEDULE` | 422 | 공연 일정/시간 오류 | - |
| `INVALID_EVENT_SLUG` | 422 | 슬러그 형식 오류 | - |
| `INVALID_PHONE_NUMBER` | 422 | 휴대폰 번호 형식 오류 | - |
| `INVALID_PINNED_RANK` | 422 | 고정 랭킹 범위 오류 | - |
| `INVALID_PROFILE_NAME` | 422 | 닉네임 길이/공백 오류 | - |
| `INVALID_PUSH_PLATFORM` | 422 | 푸시 플랫폼이 `ios`/`android`가 아님 | - |
| `INVALID_SALE_STATE` | 422 | 지원하지 않는 판매 상태 | - |
| `INVALID_SESSION_TOKEN` | 401 | bearer 토큰 형식/서명/만료 오류 | - |
| `INVALID_SUPPORT_STATUS` | 422 | 지원하지 않는 문의 상태 | - |
| `INVALID_TICKET_STATE` | 409 | 구매/입장/재판매 가능한 티켓 상태가 아님 | - |
| `INVALID_TICKET_STATUS` | 422 | 지원하지 않는 관리자 티켓 상태 | - |
| `INVALID_USER_STATUS` | 422 | 지원하지 않는 계정 상태 | - |
| `INVALID_ZONE_GRADE` | 422 | 좌석 등급명이 유효하지 않음 | - |
| `INVALID_ZONE_PRICE` | 422 | 좌석 가격 입력 오류 | - |
| `MISSING_FIELD` | 400 | 필수 필드 누락 | `field`가 가능한 라우트에서 포함됨 |
| `NOT_FOUND` | 404 | 존재하지 않는 API/파일/페이지 | - |
| `NOT_OWNER` | 403 | 티켓/문의/재판매 리소스 소유자가 아님 | - |
| `OTP_REQUIRED` | 403 | 위험 계정의 입장 QR 추가 인증 필요 | - |
| `PHONE_ALREADY_VERIFIED` | 409 | 다른 계정에서 이미 인증된 전화번호 | - |
| `POOL_CLOSED` | 409 | 종료된 재판매 풀 조작 시도 | - |
| `POOL_NOT_FOUND` | 404 | 재판매 풀을 찾지 못함 | - |
| `PORTONE_DANAL_NOT_CONFIGURED` | 503 | 포트원 다날 환경변수 미설정 | - |
| `PORTONE_IDENTITY_NOT_VERIFIED` | 422 | 포트원 인증이 아직 완료되지 않음 | - |
| `PORTONE_INVALID_RESPONSE` | 502 | 포트원 응답 형식 오류 | - |
| `PORTONE_REQUEST_FAILED` | 502 | 포트원 조회 요청 실패 | - |
| `PRICE_OUT_OF_POLICY` | 422 | 재판매 가격 정책 범위 초과 | `minPrice`, `maxPrice` |
| `RATE_LIMITED` | 429 | API-only 서버 IP별 요청 한도 초과 | - |
| `REAL_QR_NOT_READY` | 409 | 입장 QR 활성화 시간이 아직 아님 | `preparedAt`, `activeAt`, `performanceStartsAt` |
| `REQUEST_TOO_LARGE` | 413 | JSON body가 8MB 초과 | - |
| `SELF_PURCHASE_BLOCKED` | 409 | 본인 재판매 티켓 구매/대기 시도 | - |
| `SOCIAL_SESSION_INVALID` | 401 | 소셜 OAuth 세션 쿠키/서명 오류 | - |
| `SUPPORT_FORBIDDEN` | 403 | 본인 문의가 아닌 스레드에 고객 메시지 작성 | - |
| `SUPPORT_THREAD_NOT_FOUND` | 404 | 문의 스레드를 찾지 못함 | - |
| `TICKET_LOCKED` | 409 | 소유/거래 중인 티켓 재고 상태 직접 변경 시도 | - |
| `TICKET_NOT_AVAILABLE` | 409 | 구매 가능한 티켓이 아님 | - |
| `TICKET_NOT_FOUND` | 404 | 티켓을 찾지 못함 | - |
| `TOKEN_USER_MISMATCH` | 403 | bearer 토큰 사용자와 요청 소유자 필드 불일치 | `tokenUserId`, `requestUserId` |
| `TRANSFER_LIMIT_REACHED` | 409 | 재판매/양도 가능 횟수 초과 | - |
| `TRUSTED_DEVICE_REQUIRED` | 403 | 신뢰 기기 또는 deviceToken 검증 실패 | - |
| `UNSUPPORTED_PAYMENT_METHOD` | 422 | 지원하지 않는 결제수단 | - |
| `USER_BANNED` | 403 | 제재 계정 거래 시도 | - |
| `USER_NOT_FOUND` | 404 | 사용자를 찾지 못함 | - |
| `VENUE_NOT_FOUND` | 404 | 공연장을 찾지 못함 | - |
| `WATCHLIST_NOT_FOUND` | 404 | 관심 공연 항목을 찾지 못함 | - |
| `WEAK_ADMIN_PASSWORD` | 422 | 관리자 비밀번호가 12자 미만 | - |
| `ZONE_NOT_FOUND` | 404 | 좌석 구역을 찾지 못함 | - |
