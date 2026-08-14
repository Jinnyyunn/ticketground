# 미해결 이슈 시뮬레이터 검증 결과

2026-08-02 기준으로 결제 프로그램과 실제 외부 제공자 연동을 제외한 #99, #100, #101, #102, #106, #107의 저장소 구현과 iOS Simulator 검증을 완료했다. #108은 운영 인계 항목을 이 문서와 운영 체크리스트로 정리했다.

| 이슈 | 결과 | 핵심 증거 |
|---|---|---|
| #99 고객센터 | 완료 | 문의 조회·작성·답변·오류·빈 상태 XCUITest |
| #100 계정/예매내역 | 완료 | 프로필·예매내역·수정 실패 XCUITest |
| #101 관심공연 | 완료 | optimistic rollback·빈 상태 XCUITest |
| #102 예매 상태 | 결제 전까지 완료 | hold 충돌·만료·재연결·draft XCUITest |
| #106 기기/알림 | 시뮬레이터 완료 | `/tmp/tg-device-ui-20260802-1412.xcresult` |
| #107 모바일 QR | 시뮬레이터 및 서버 계약 완료 | `/tmp/tg-mobile-ticket-ui-20260802-1417.xcresult`, 인증된 동시 gate 스캔·재시작 만료·원문 비저장 테스트 |
| #108 운영 준비 | 문서화 및 임시 HTTPS 확인 | `.omo/evidence/open-issues-simulator-qualification/https-20260802/` |

Cloudflare Quick Tunnel은 검증 종료와 함께 정리했다. 영구 URL, bearer, QR 원문, gate key는 어떤 증거에도 기록하지 않았다.
