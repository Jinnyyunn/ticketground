# iOS 시뮬레이터 운영 준비 체크리스트

## 저장소 및 시뮬레이터에서 완료

- API 계약: `profile`, `reservations`, `watchlist`, `support`, `booking`, `devices`, `mobile-ticket-qr`
- 인증 경계: revocable native bearer principal, 소유권 검증, mutation idempotency
- 예매: READY 대기열, revision 기반 좌석 충돌, 5분 hold, 결제 전 `AWAITING_PAYMENT` draft
- 기기: 시뮬레이터 HMAC challenge, replay counter, push-token hash/회전/폐기
- QR: 20초 서명 토큰, 이전 QR 폐기, 구형·신형 게이트 공통 키 인증, 동시 스캔 1회만 성공하는 atomic consume
- QR 보관: 원문은 응답 멱등성 기록에도 남기지 않고 서버 비밀로 AES-GCM 봉인하며, 재시작 재시도 시에만 복원
- Cloudflare Quick Tunnel HTTPS: health 200, native contract 200, authenticated profile 200, 시뮬레이터 설치·실행 확인

증거는 `.omo/evidence/open-issues-simulator-qualification/https-20260802/`에 저장한다. 임시 터널 URL과 credential은 저장하지 않는다.

## 운영 비밀 저장소에 준비할 값

- `TIG_SECRET`, `TIG_ADMIN_TOKEN`, `TIG_ADMIN_SESSION_SECRET`, `TIG_ADMIN_USERNAME`, `TIG_ADMIN_PASSWORD`
- `TIG_GATE_API_KEY`: 소비자 API나 iOS 앱이 아닌 게이트 장비에만 배포
- `TIG_SIMULATOR_ATTESTATION_SECRET`: 시뮬레이터 검증 환경 전용, 운영 App Attest 키와 분리
- Google/Kakao/Naver 서버 OAuth 비밀과 등록 redirect URI
- APNs 인증 키와 production/sandbox 환경 분리
- PortOne/Danal 운영 본인인증 계약과 callback 검증 정보

## 운영 배포 시 검증 순서

1. 소비자 API를 영구 HTTPS 도메인에 배포하고 `TICKETGROUND_API_BASE_URL`과 `TICKETGROUND_ASSET_BASE_URL`을 설정한다.
2. 관리자 포트가 외부에서 접근 불가한지 확인한다.
3. `/api/health`, `/api/native/v1/contract`, 로그인 후 `/api/me/profile`을 확인한다.
4. 실제 제공자 로그인, APNs, App Attest, 본인인증, 게이트 장비를 각각 실제 계정/장비에서 검증한다.
5. 결제 프로그램, 결제 승인·웹훅·환불·정산은 별도 작업으로 검증한다.

## 명시적 제외

- #103 결제 프로그램 연동 전체
- #104 중 결제 승인·취소·환불·재판매 정산 mutation
- #105 실제 외부 제공자 운영 연동
