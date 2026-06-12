# Ticketground MVP

블록체인/NFT 인프라 없이도 사업계획서의 핵심인 “암표 수익 구조 차단”을 검증할 수 있는 프론트엔드 + 백엔드 MVP입니다.

## 실행

```bash
npm start
```

브라우저에서 `http://localhost:4173`을 엽니다.

## 현실형 대체 구조

- NFT 민팅: 중앙 DB의 `tickets` 테이블과 `ledger` 감사 원장으로 대체
- 스마트 계약: 백엔드 정책 엔진으로 대체
- 온체인 전송 차단: API 승인 없는 지정 양도 시도는 무조건 실패 및 신뢰 점수 차감
- 블록체인 추적성: 각 이벤트를 이전 해시에 연결한 append-only hash chain 원장으로 대체
- 지갑: 실명 계정 기반 플랫폼 보관 지갑으로 대체
- 랜덤 재판매: 구역별 공용 풀에 구매 대기자를 모은 뒤 서버 HMAC seed로 랜덤 매칭
- QR NFT 입장권: HMAC 서명 기반 20초 만료 동적 QR 토큰으로 대체

## API 요약

- `GET /api/state`: 화면용 전체 상태
- `GET /api/ledger`: 최근 감사 원장
- `GET /api/ledger/verify`: 해시 체인 위변조 검증
- `POST /api/tickets/buy`: 1차 티켓 구매
- `POST /api/resale/list`: 재판매 풀 등록
- `POST /api/resale/join`: 재판매 풀 대기
- `POST /api/resale/draw`: 랜덤 매칭 실행
- `POST /api/security/direct-transfer-attempt`: 지정 양도 차단 및 제재 시뮬레이션
- `POST /api/tickets/qr`: 동적 QR 발급
- `POST /api/gate/verify`: 게이트 QR 검증

## 실제 서비스화 시 다음 단계

- PostgreSQL + row-level audit table + WORM 스토리지/S3 Object Lock
- 결제/충전금은 전자금융업, PG, 에스크로, 예치금 분리 보관 검토
- KYC/본인인증, 부정거래 탐지, 속도 제한, 디바이스 핑거프린팅
- 랜덤 추첨 seed 공개 검증 방식
- 운영자 어드민, 신고/보증금 동결 워크플로우, 현장 게이트 앱
