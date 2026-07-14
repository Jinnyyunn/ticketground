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

- 대부분의 공개 엔드포인트는 별도 로그인 토큰 없이 `userId`를 요청 본문/쿼리로 직접 전달하는 데모 방식입니다 (세션 쿠키 기반 인증 없음).
- 소셜 로그인(Google/Kakao/Naver)은 `/api/auth/*` 참고.
- **앱 전용 서명(App Attestation)이 필요한 엔드포인트가 2개 있습니다** — `POST /api/devices/trust`, `POST /api/tickets/qr` (channel=`APP`인 경우). 아래 "App Attestation" 절 참고.

### App Attestation 서명 계산법

서버는 `TIG_APP_ATTESTATION_SECRET` 환경변수를 HMAC 키로 사용합니다.

```
appAttestation = HMAC_SHA256(secret, "app:" + purpose + ":" + part1 + ":" + part2 + ...)
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
| GET | `/api/state` | 전체 상태 스냅샷 (이벤트/장소/유저/티켓/리세일풀/원장 검증) |
| GET | `/api/catalog` | 공개 공연 카탈로그 (판매 중인 이벤트 목록, 회차/가격/좌석 요약) |
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
| POST | `/api/devices/trust` | `userId, deviceId, biometricVerified` + **appAttestation** | 기기 신뢰 등록 |
| POST | `/api/tickets/qr` | `userId, ticketId` (APP 채널은 + `deviceId, appAttestation`) | 입장 QR 발급 |
| POST | `/api/tickets/virtual-qr` | `userId, ticketId` | 가상 QR 발급 |
| POST | `/api/gate/verify` | `ticketId, ownerId, expiresAt, nonce, signature` | 게이트 QR 검증 (입장 스캐너용) |

## 주요 응답 데이터 형태

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
- 소스: `backend_server` 브랜치, `backend/api-router.js`가 라우팅 진입점입니다.
- 요청/응답 형식이 바뀌면 이 문서도 같이 업데이트해주세요.
