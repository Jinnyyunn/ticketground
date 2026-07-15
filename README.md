# Ticketground Admin Branch

## 이 브랜치는 무엇인가

`admin`은 새 관리자 콘솔 작업이 먼저 들어오는 브랜치다. PR #82에서는 초기 콘솔과 ACL 기반 권한 관리가 들어갔고, PR #83에서는 재고와 공식 재판매 운영, finance/audit 뷰, support/account/admission 액션이 추가되어 `main`에 병합됐다.

지금 이 README를 쓴 시점에는 PR #83 직후라 이 브랜치의 제품 코드는 `main`과 동일하다. 앞으로 새 관리자 작업이 다시 커밋되면 `admin`은 `main`보다 앞서 나가고, 검증 후 PR로 다시 `main`에 합쳐진다.

## 셋업/실행

전체 설치와 실행 방법은 `main` 브랜치의 [README.md](https://github.com/Jinnyyunn/ticketground/blob/main/README.md)를 기준으로 본다. 이 브랜치에서 특히 확인할 값은 관리자 콘솔 주소 `http://127.0.0.1:50084/console`, `.env.local`의 `TIG_ADMIN_USERNAME`/`TIG_ADMIN_PASSWORD`, 그리고 IP별 로그인 rate limit이다.

## 지금까지 구축된 것

- 공연과 회차 등록, 포스터 업로드, 대용량 포스터 자동 downscale, 기존 공연 event picker
- 판매 상태, 할인 정보, 회차 일정 수정이 사용자 공개 페이지와 예매 흐름에 반영되는 동기화
- 관리자 고정 랭킹과 예매 수요 기반 자동 정렬을 함께 쓰는 hybrid ranking
- 티켓 재고 필터, 좌석 상태 bulk action, 미판매 좌석 중심의 운영 변경
- 공식 재판매 강제 취소, 운영자 alert ack, 관련 감사 로그
- finance/settlement 작업공간과 결제/정산 요약
- audit log 필터와 CSV export
- support thread history, 관리자 답변, 문의 상태 변경
- 계정 검색과 제재, admission QR hold, ACL 관리

전체 기능 요구사항과 완료 기준은 [관리자 페이지 세부작업 내역서.md](관리자%20페이지%20세부작업%20내역서.md)를 본다.

## 작업 규칙

관리자 콘솔 작업은 이 브랜치 또는 이 브랜치에서 분기한 topic branch에서 진행하고, `main`에는 PR로 병합한다.

병합 전에는 `npm run check`가 통과해야 한다. UI나 화면 문구, API 응답 내용이 바뀌는 커밋은 관련 `tests/*.test.mjs`도 함께 갱신한다. 이 저장소에는 `booking-admin-flow`, `admin-event-content`처럼 큰 UI/content 변경이 테스트 갱신 없이 들어간 전례가 있으므로 같은 패턴을 반복하지 않는다.
