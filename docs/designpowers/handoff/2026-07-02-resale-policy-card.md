# 공식 재판매 정책 카드 디자인 핸드오프

## 목적
- 공식 재판매 페이지의 `클린티켓 정책` 영역을 단순 안내 박스가 아니라 신뢰형 정책 모듈로 보이게 한다.
- 메이저 티켓 서비스처럼 흰색, 검정, 브랜드 레드, 제한적 옐로 포인트만 사용한다.

## 적용 범위
- 대상 컴포넌트: `src/components/clean-ticket/resale-intro.tsx`
- 대상 화면: `/resale`

## 시각 기준
- 카드 전체 배경은 `bg-background`, 테두리는 `border-line`, 그림자는 `shadow-ticket-2`를 사용한다.
- 상단 정책 헤더는 `bg-ink`로 무게감을 주고, 상단 1px 브랜드 강조선은 `bg-ticketground`를 유지한다.
- `공식` 배지는 `bg-accent-2`를 사용해 기존 클린티켓 노란 포인트를 작게 남긴다.
- 정책 상세 항목은 `divide-line`으로 분리해 표처럼 빠르게 읽히도록 한다.

## 접근성 및 반응형
- `aside`는 `aria-labelledby="resale-policy-title"`를 유지한다.
- 정책 번호는 장식 요소이므로 `aria-hidden="true"`를 유지한다.
- 모바일 390px에서 가로 스크롤 없이 3개 정책 항목이 세로로 쌓여야 한다.
