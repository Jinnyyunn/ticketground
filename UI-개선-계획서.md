# Ticketground UI 개선 계획서

- 대상: https://github.com/Jinnyyunn/ticketground `main` 브랜치 (v0.3.1, 커밋 `746c96b`)
- 스택: Next.js 16 / React 19 / Tailwind v4 / shadcn·base-ui(설치만 됨) / lucide-react
- 작성일: 2026-07-03
- 검증: 초안을 별도 리뷰 에이전트가 소스와 파일:라인 단위로 대조 검증, 지적사항 반영 완료 (v2)

---

## 1. 현재 UI 진단 요약

전반적으로 토큰 기반 디자인 시스템(`globals.css`의 `--ink`/`--fs-*`/`--r-*` 스케일)과 시맨틱 마크업, 포커스 링 등 기본기가 잘 잡혀 있는 프로토타입입니다. 다만 아래 5개 영역에서 구조적인 개선 여지가 확인됩니다.

| # | 영역 | 핵심 문제 | 심각도 |
|---|---|---|---|
| 1 | 모바일 내비게이션 | 햄버거 메뉴 없음, 모바일에서 로그인 진입점 소실 | 높음 |
| 2 | 예매~예약확인 플로우 | 금액을 URL로 전달(2개 구간), 좌석 UI 이원화·자동선택 | 높음 |
| 3 | 디자인 시스템 분열 | px 임의값 362건 + hex 하드코딩 135건, 페이지군별 스타일 체계 이원화, 미로드 폰트 | 중간 |
| 4 | 접근성 | 좌석 터치 타깃 24px, 스크롤 잘림 인지 불가, live region 불안정 | 중간 |
| 5 | 다크모드·이미지 | `.dark` 토큰 반쪽 구현(데드코드), `next/image` 4개 파일만 사용 | 낮음~중간 |

---

## 2. 세부 진단 및 개선 방향

### 2-1. 모바일 내비게이션 (우선순위 1)

**진단**
- `src/components/site-header.tsx:139` — 유틸리티 바(로그인/회원가입/고객센터/MY)가 `hidden sm:block`이라 **모바일에서는 로그인·회원가입 텍스트 링크가 사라지고**, MY 아이콘으로만 우회 진입 가능.
- `site-header.tsx:178` — 카테고리 내비가 `no-scrollbar overflow-x-auto`로 가로 스크롤인데 스크롤바를 숨겨서 **뒤에 더 항목이 있다는 시각적 단서가 전혀 없음**.
- 코드베이스 전체에 햄버거/드로어/Sheet 류 모바일 메뉴가 존재하지 않음 (grep 0건).

**개선안**
1. 모바일 전용 햄버거 버튼 + 드로어 메뉴 추가 (base-ui `Dialog` 활용 — 이미 의존성에 있음). 드로어 안에 카테고리 전체, 로그인/회원가입, 고객센터, 재판매 링크 배치.
2. 카테고리 스크롤 영역 양끝에 fade-out 그라데이션(`mask-image` 또는 가장자리 오버레이) 추가로 스크롤 가능함을 시각화.
3. 로그인 상태 표시(`HeaderAuthLinks`)를 모바일에서도 노출 — 드로어 상단에 계정 영역.

**대상 파일**: `src/components/site-header.tsx`, 신규 `src/components/mobile-nav.tsx`

### 2-2. 예매~예약확인 플로우 (우선순위 2)

**진단**
- **금액이 URL 쿼리스트링으로 두 구간에 걸쳐 전달됨** — 이 Phase의 핵심 문제.
  - booking→checkout: `booking-panel.tsx:94`가 `base`/`fee`/`total`을 쿼리로 전달.
  - checkout은 이를 그대로 신뢰(`checkout/[slug]/page.tsx:43-46`)하며, **`discount = base + fee - total` 역산 구조라 URL에서 total만 낮추면 화면에 "할인"으로 표시됨**.
  - checkout→reservation: `checkout-panel.tsx:69-80`이 같은 금액들을 다시 쿼리로 `router.push` — booking 구간만 고치면 절반만 고치는 셈.
- **좌석 선택 UI 이원화 + 자동 선택**: 백엔드 연동 `BackendSeatPicker`와 데모용 정적 `SeatMap`이 한 화면에 동시 렌더링(`booking-panel.tsx:218-226`)되고, 백엔드 좌석 선택 시 정적 선택이 조용히 무시됨(`:87-89`). 게다가 **좌석도 로드 시 첫 가용 좌석이 자동 선택되어(`:68-70`) 사용자가 아무것도 안 골라도 금액이 채워지고 결제 가능 상태**가 됨.
- 스텝 탭이 가드 없이 클릭 가능(`booking-panel.tsx:140`). 단 심각도는 낮음: date/time은 첫 스케줄로 자동 기본 선택되고(`:44-45`), STEP 1 하단 이동 버튼에는 이미 `disabled={!canChooseSeats}` 가드가 있음(`:202`). 미가드 경로는 탭 직접 클릭뿐.
- `결제하기` 링크: 비활성 시 `href="#"`라 이동은 안 되지만(`:228`), **포커스는 잡히고 Enter 시 `#`으로 스크롤 점프**하는 어색한 동작.
- 타이머: 만료 섹션에 `aria-live="polite"`가 있으나(`:153`) **만료 시점에 조건부 마운트되어 스크린리더 공지가 보장되지 않고**, 잔여 시간 경고(예: 1분 미만)는 없음.

**개선안**
1. 금액 URL 전달 제거(2개 구간 모두): booking→checkout은 좌석 ID·회차만 전달하고 checkout에서 금액 재계산, checkout→reservation도 동일하게 예약 식별자 기반으로 변경.
2. 좌석 선택 단일화: 백엔드 `seatMap` 로드 성공 시 정적 `SeatMap`을 숨기고 백엔드 좌석 데이터를 기존 좌석도 그리드 렌더러에 주입해 재사용. 로드 실패 시에만 정적 데모 폴백 + 안내 배너. **첫 좌석 자동 선택 제거** — 명시적 선택 전에는 결제 불가.
3. 스텝 탭에도 `disabled` 가드 적용 + 완료된 스텝 체크 표시 (하단 버튼과 규칙 일원화).
4. `결제하기`를 `<button disabled>`로 변경하고 활성화 시 `router.push` (포커스/스크롤 점프 제거).
5. 타이머 live region을 상시 마운트로 변경하고, 잔여 60초 미만 시 색상 경고 + 상태 문구 갱신.

**대상 파일**: `booking-panel.tsx`, `seat-map.tsx`, `backend-seat-picker.tsx`, `checkout-panel.tsx`, `checkout/[slug]/page.tsx`, `reservation/[id]/page.tsx`

### 2-3. 디자인 시스템 분열 (우선순위 3)

**진단**
- **px 임의값 362건 / 55개 파일**: `--fs-*`, `--r-*` 토큰 스케일을 정의해 놓고도 `text-[13px]`, `text-[14px]`, `rounded-[8px]` 같은 임의값이 광범위하게 사용됨. 주의: **최빈값인 `text-[14px]`와 `text-[11px]`, `text-[22px]`는 대응 토큰이 없어**(fs 스케일: 12/13/15/16/18/20/23/28…px) 단순 1:1 치환이 불가능 — 치환 시 실제 렌더 크기가 변하므로 매핑 결정과 시각 검증이 필요한 작업.
- **hex 하드코딩 135건 / 20개 파일**: `#eee`/`#666`/`#29292d`/`#f8f8f8` 등이 `checkout-panel.tsx`(19건), `reservation/[id]/page.tsx`(24건), `mypage/page.tsx`(14건)에 집중. `#4154ff`(checkout 라디오 accent)는 토큰 팔레트에 존재하지 않는 색.
- **페이지군별 스타일 체계 이원화**: booking/홈 계열은 `font-black` + 시맨틱 토큰, checkout/mypage/reservation 계열은 `font-bold` + hex 색 — 사실상 두 개의 디자인 언어가 공존.
- `components/ticketground/primitives.tsx`의 프리미티브(Surface/Chip/Tag 등)가 있으나 CTA 버튼 스타일은 파일마다 인라인 재작성. `ui/button.tsx`는 **import 0건인 데드코드**.
- **폰트 스택 1순위 "Pretendard Variable"이 어디서도 로드되지 않음** — 실제로는 Noto Sans KR로 폴백 중.
- 소소한 폴리시: `SectionHead` "더보기"가 `text-ink hover:text-ink`로 호버 시 시각 변화 없음(`home-cards.tsx:109`).

**개선안** — 규모가 크므로 2단계로 분할:
- **P3a (작고 안전)**: Pretendard Variable `next/font/local` 자체 호스팅 + `ui/button.tsx`를 cva 변형(variant: primary/dark/outline/ghost, size: sm/md/lg)으로 확장하고 주요 CTA부터 실제 채택(데드코드 해소).
- **P3b (광범위 치환, 시각 검증 필수)**: ① px 임의값 매핑 표 확정(`text-[14px]`→13px/15px 중 택일 등 비대응 값 결정 선행) 후 치환, ② hex 색상 → 시맨틱 토큰 치환, ③ `bg-white` 하드코딩 → `bg-background`/`bg-card` 치환(2-5의 다크모드 대비 작업을 여기에 병합), ④ 타이포 위계(본문 normal/medium, 강조 bold, 헤딩 black) 확정 후 `DESIGN.md`에 명문화. 완료 기준에 **주요 페이지 스크린샷 대조(시각 회귀 없음)** 포함.

### 2-4. 접근성 (우선순위 4)

**진단**
- 좌석 버튼이 `size-6`(24px, `seat-map.tsx:86`) — 모바일 터치 타깃 권장 44px에 크게 미달. 단, **44px로 키우면 22열 그리드 폭이 ~550px에서 1000px+로 늘어 모바일 가로 스크롤이 오히려 악화**되는 트레이드오프 존재.
- 22열 좌석도가 가로 스크롤인데 스크롤바 숨김이라 잘림을 인지하기 어려움.
- ~~`TicketgroundModal` 포커스 트랩 부재~~ → 검증 결과 **이 컴포넌트는 import 0건인 데드코드**로 확인되어 재구현 대상에서 제외(§5 참조). 삭제만 수행. 실사용 Dialog 패턴은 P1 드로어에서 base-ui 기반으로 확보됨.

**개선안**
1. 좌석 버튼을 모바일에서 `size-9`(36px) + 간격 확대 — 단 이는 **임시조치**임을 명시. 정공법은 **2단 선택(등급/구역 선택 → 해당 구역 확대 그리드)** 이며, 이 Phase에서 설계까지 확정하고 구현 여부는 범위 협의.
2. 좌석도 스크롤 영역에 스크롤 힌트(가장자리 그림자/화살표) 추가.
3. 데드코드 정리: `TicketgroundModal` 삭제.

### 2-5. 다크모드 정리 + 이미지 최적화 (우선순위 5)

**진단**
- `globals.css:203-235`의 `.dark` 블록은 shadcn 계열 토큰만 덮고, 실제 화면이 쓰는 `--ink`/`--bg`/`--line`은 미정의. `html{background:var(--bg)}` 흰색 고정, `color-mix(... white)` 틴트(56-58행)도 라이트 전제. **다크모드를 켜면 깨지는 반쪽 구현이 데드코드로 존재.**
- 홈 포스터·히어로가 raw `<img>`(eslint-disable 처리) — `next/image`는 전체에서 4개 파일만 사용. LCP 이미지 최적화 안 됨.

**개선안**
1. `.dark` 블록과 데드 토큰 제거, "라이트 온리" 명시(다크모드는 별도 프로젝트로 분리). `bg-white`→시맨틱 토큰 치환은 P3b에 병합했으므로 여기서는 CSS 정리만.
2. 홈 히어로/랭킹/장르 포스터를 `next/image`로 전환(`fill` + `sizes`), 히어로는 `priority` 지정으로 LCP 개선.

---

## 3. 실행 계획 (Phase)

| Phase | 내용 | 범위 | 예상 규모 |
|---|---|---|---|
| **P1** | 모바일 내비게이션 (드로어 메뉴, 스크롤 힌트, 모바일 로그인 진입점) | 2-1 | 신규 1파일 + 헤더 수정 |
| **P2** | 예매 플로우 (금액 URL 제거 ×2구간, 좌석 단일화·자동선택 제거, 스텝 가드, 타이머 a11y) | 2-2 | 6파일 수정 |
| **P3a** | Pretendard 로드 + Button cva 통합·채택 | 2-3 | 소규모 |
| **P3b** | px 임의값 362건 + hex 135건 + bg-white 치환, 타이포 가이드 | 2-3, 2-5 일부 | 대규모(~60파일), 매핑 결정 선행 |
| **P4** | 접근성 (좌석 터치 타깃 임시 확대 + 2단 선택 설계, 스크롤 힌트, 데드코드 삭제) | 2-4 | 2~3파일 + 설계 문서 |
| **P5** | 다크모드 데드 CSS 정리 + next/image 전환 | 2-5 | CSS + 홈 컴포넌트 |

**Phase별 완료 기준**
- 공통: `npm run lint && npm run typecheck` 통과, 390px / 768px / 1240px 폭에서 가로 오버플로 없음. `npm test`(full build 포함, 무거움)는 Phase 마지막에 1회.
- P1/P2/P4: 키보드만으로 해당 플로우 완주 가능.
- P3b/P5: 주요 페이지 스크린샷 대조로 의도치 않은 시각 회귀 없음 확인.

## 4. 작업 방식

- 구현은 전역 규칙에 따라 **`$codex-implement`(codex 5.5 xhigh)로 위임**, Phase 단위로 순차 진행.
- 각 Phase 결과물은 Claude가 리뷰 후 다음 Phase 착수.
- P2(예매 플로우)와 P3b(대규모 치환)는 검증-테스트-수정 반복이 필요하므로 `$ulw-loop` 적용 후보.
- 계획 승인 후 착수 시 `$start-work`를 먼저 실행.

## 5. 이번에 다루지 않는 것 (Out of Scope)

- 홈 콘텐츠 목데이터(`home-content.ts` 등)의 실데이터 전환 — 백엔드 과제
- 대기열(`queue-waiting-room.tsx`) 시뮬레이션 로직의 실서버 연동
- 관리자 페이지 UI (별도 내역서 존재)
- 전면적인 다크모드 신규 구현 (P5는 데드코드 정리만)
- **인증 UX 전반**: mypage가 로그인 게이트 없이 데모 예매내역 노출, resale이 `sessionUserId`를 쿼리스트링으로 수용(`resale/page.tsx:34`), login 페이지 방문만으로 데모 세션 자동 연결(`login-panel.tsx:102-105`) — 프로토타입 데모 편의로 판단되나, 실서비스 전환 시 별도 과제로 다뤄야 함
- `TicketgroundModal` 등 데드코드의 base-ui 재구현 — 삭제로 대체 (P4에 포함)
