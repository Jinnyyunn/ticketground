# Ticketground UI 개선 계획서

- 대상: https://github.com/Jinnyyunn/ticketground `main` 브랜치 (v0.3.1, §1~§5 기준 커밋 `746c96b`, §6~§7 기준 커밋 `e39c10e`, §8 기준 커밋 `9bff10b`, §10 기준 커밋 `e0dfc83`, §11 기준 커밋 `71c00d2`)
- 스택: Next.js 16 / React 19 / Tailwind v4 / shadcn·base-ui(설치만 됨) / lucide-react
- 작성일: 2026-07-03 (§6~§7 추가: 2026-07-04, §8 추가: 2026-07-04, §9 추가: 2026-07-04, §10 추가: 2026-07-05, §11 추가: 2026-07-05)
- 검증: §1~§5 초안을 별도 리뷰 에이전트가 소스와 파일:라인 단위로 대조 검증, 지적사항 반영 완료 (v2). §6~§7은 Opus 4.8이 작성하고 Fable advisor가 소스·테스트 대조 검증(치명 3건·수정 5건·제안 5건) 후 반영 완료 (v3). §8은 codex의 1차 구현(커밋 `9bff10b`)을 Sonnet 5가 1차 검증하고 Fable advisor가 재검증(수정 4건 반영)한 결과 (v4). §9(P6 다크모드)는 사용자 요청으로 신설, Sonnet 5가 작성하고 Fable advisor가 재검증(치명 1건·수정 3건 반영)한 결과 (v5). §10은 codex의 2차 구현(P3b 대량 치환 등, 커밋 `e0dfc83`)을 Sonnet 5가 1차 검증하고 Fable advisor가 재검증(수정 1건 반영)한 결과 (v6). §11은 codex의 P3b 잔여 정리 완료(커밋 `71c00d2`)를 Sonnet 5가 1차 검증하고 Fable advisor가 재검증(수정 2건 반영)한 결과 — **P3b 완료, P6(다크모드) 착수 가능 판정** (v7)

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
- ~~전면적인 다크모드 신규 구현 (P5는 데드코드 정리만)~~ → **2026-07-04 사용자 요청으로 철회, §9 P6(다크모드 도입)으로 정식 편입**. P5는 여전히 데드 `.dark` CSS 정리만 수행했고, 실다크모드 구현은 P3b 완료 후 P6에서 별도 진행
- **인증 UX 전반**: mypage가 로그인 게이트 없이 데모 예매내역 노출, resale이 `sessionUserId`를 쿼리스트링으로 수용(`resale/page.tsx:34`), login 페이지 방문만으로 데모 세션 자동 연결(`login-panel.tsx:102-105`) — 프로토타입 데모 편의로 판단되나, 실서비스 전환 시 별도 과제로 다뤄야 함
- `TicketgroundModal` 등 데드코드의 base-ui 재구현 — 삭제로 대체 (P4에 포함)
- **§6 P1 수용 편차(보안/인증 게이트):** `9bff10b`의 데스크톱 유틸바 `MY`/`예매내역` 미인증 숨김 처리는 유지한다. §6 P1은 데스크톱 유틸바 마크업/텍스트 변경 금지를 요구했지만, 현재 서비스 보안 요구가 “로그인 전 MY 및 예매내역 접근 차단”이므로 모바일 드로어 조건부 노출과 같은 방향으로 맞춘다.
- **§6 P5 수용 편차(Next 16 이미지 API):** §6에는 FeaturedCard의 LCP 이미지에 `priority` prop을 추가하라고 되어 있으나, 현재 `next@16.2.1` 문서에서는 `priority`가 deprecated이고 `preload`가 대체 속성이다. 따라서 수동 `loading`/`fetchPriority`는 제거하되, 실제 구현은 `preload={size === "large"}`로 맞춘다.
- ~~**§8 부재:** 현재 `main` 문서에는 `## 8` 섹션이 존재하지 않아, 이번 라운드 검증 기준은 §6의 Phase별 DoD와 별도 QA 산출물로 추적한다.~~ → **2026-07-05 정정: 이 문구는 codex가 §8·§9 반영 이전 시점의 로컬 사본으로 작업하며 남긴 것으로, 현재 문서에는 §8·§9가 모두 존재한다(사실과 불일치하여 삭제).**

---

## 6. Phase별 구현 계획서 (codex 실행 지시서)

> 본 섹션은 구현 담당 AI(codex)가 이 문서만으로 자율 구현할 수 있도록 작성한 실행 지시서다. 대상 리비전은 `main` 최신(`e39c10e`, "fix: render virtual tickets per seat"). 계획서 §1~§5 작성 시점(`746c96b`) 이후 4개 커밋(`d77f059`, `acf0981`, `dffe428`, `e39c10e`)이 추가되었으며, 그 변경사항은 아래 각 Phase에 반영되어 있다. 본 섹션은 Opus 초안을 별도 advisor(Fable)가 소스·테스트와 파일:라인 단위로 대조 검증해 치명 지적 3건(자동선택 제거 vs 테스트 충돌, `data-booking-expired` 상시 마운트 vs 테스트 충돌, `text-xs`=13px 오매핑)을 반영한 판이다.
>
> **최신 실측치(리비전 `e39c10e` 기준, `src/` 한정):**
> - px 임의값: **약 563건 / 68파일** (`grep -roE "\-\[[0-9]+px\]" src`). 계획서 §2-3의 362건/55파일보다 증가.
> - hex 하드코딩: **약 214건 / 24파일** (`grep -roE "#[0-9a-fA-F]{3,8}" src`, `globals.css` 등 토큰 **정의부는 치환 대상에서 제외**). 계획서 §2-3의 135건/20파일보다 증가.
> - 신규 파일 반영: `src/components/ticketing/virtual-ticket-card.tsx`(좌석별 가상티켓, 53줄), `src/components/mypage/reservation-history-search.tsx`(예매내역 검색·기간필터, 249줄).
>
> **공통 검증 명령(모든 Phase 공통 DoD 전제):**
> - `npm run lint`
> - `npm run typecheck`
> - `npm test` — **주의: `npm test`는 `next build`를 먼저 돌린 뒤 `tests/*.test.mjs`(playwright, chrome 채널, `--test-concurrency=1`)를 실행하므로 무겁다.** Phase 도중에는 관련 테스트만 개별 실행(`node --test tests/<name>.test.mjs`, 단 build 산출물 필요 시 `npm run build` 선행)하고, Phase 마지막 커밋에서 `npm test` 1회 전량 통과를 확인한다.
> - 뷰포트 수동 확인 기준: **390px / 768px / 1240px** 3폭에서 가로 오버플로 없음.

---

### P1 — 모바일 내비게이션 (드로어 + 스크롤 힌트 + 모바일 로그인 진입점)

#### 1. 목표
모바일(`sm` 미만)에서 사라지는 로그인/회원가입·유틸 링크를 햄버거 드로어로 복구하고, 카테고리 가로 스크롤에 시각적 스크롤 단서를 추가한다.

#### 2. 구현 상세

**신규 `src/components/mobile-nav.tsx`** (`"use client"`)
- base-ui `Dialog`(`@base-ui/react/dialog`, `package.json`에 `^1.3.0` 선언됨. 임포트 경로는 리포 내 기존 base-ui 사용례를 grep해 확인 — `ui/button.tsx:3`이 `@base-ui/react/button`을 쓰므로 동일 규약 `@base-ui/react/dialog`)로 드로어 구현. base-ui Dialog는 포커스 트랩·`Esc` 닫기·`aria-modal`·스크롤 락을 기본 제공하므로 직접 구현하지 말 것. **착수 전제: `npm install`로 의존성 설치 후 `node_modules/@base-ui/react`의 실제 export(`Dialog.Root/Trigger/Portal/Backdrop/Popup/Close/Title`)를 확인하고 사용할 것.**
- 컴포넌트 구조:
  - `MobileNav` (default/named export) — 내부에 `Dialog.Root`(제어형: `open`/`onOpenChange` state), `Dialog.Trigger`(햄버거 버튼, `lucide-react`의 `Menu` 아이콘 또는 `src/components/icons.tsx` 내 아이콘 확인 후 재사용), `Dialog.Portal`+`Dialog.Backdrop`+`Dialog.Popup`(좌측 슬라이드 드로어, `fixed inset-y-0 left-0 w-[84%] max-w-[320px]`).
  - props: `{ readonly categories: readonly { label: string; href: string }[]; readonly highlightCategories: readonly { label: string; href: string }[] }`. 카테고리 데이터는 `site-header.tsx`가 이미 갖고 있는 `categoryNav`/`categoryNavHighlight`/`categoryHrefs`를 props로 주입받는다(중복 정의 금지). **`categoryHrefs`는 `site-header.tsx:25-39`의 비export 로컬 상수이므로, `site-header.tsx`에서 `categoryNav.map((c) => ({ label: c, href: categoryHrefs[c] ?? "/contents/search" }))` 형태의 `{label, href}` 배열로 가공해 넘긴다**(상수 export보다 결합도 낮음).
  - 상단 계정 영역: `HeaderAuthLinks`의 로그인 상태 판별 로직을 재사용해야 한다. **현재 `HeaderAuthLinks`는 `site-header.tsx` 내부 비export 컴포넌트다.** 로직 중복을 피하려면 인증 상태 판별 훅을 `src/lib/use-session-auth.ts`(신규, `"use client"`)로 추출해 `site-header.tsx`와 `mobile-nav.tsx`가 공유하도록 리팩터. 훅은 `{ signedIn: boolean; signOut: () => void }` 반환. 내부는 기존 `site-header.tsx:76-101`의 effect(storedSessionUserId → getSession → SESSION_USER_CHANGED_EVENT/storage 리스너)를 그대로 옮긴다. **`active` 플래그 가드와 `storedSessionUserId() === userId` 재확인 로직을 "정리"하거나 단순화하지 말 것** — `header-utility-label.test.mjs:58-106`("늦게 도착한 세션 응답 무시")이 이 세부 동작의 회귀 감지선이다.
  - 드로어 본문 순서: (1) 계정 영역 — 미로그인 시 `로그인`/`회원가입` 링크, 로그인 시 `로그아웃` 버튼 + `MY(/mypage)` 링크, (2) 카테고리 전체(`categories`), (3) 하이라이트(`티켓오픈 캘린더`/`티켓 재판매` 등 `highlightCategories`), (4) `고객센터(/help)`.
  - 링크 클릭 시 드로어 닫힘: `Dialog.Close`로 감싸거나 `onClick`에서 `setOpen(false)`.

**`src/components/site-header.tsx` 수정**
- `:73-121` `HeaderAuthLinks`는 위 훅 추출 후 훅 사용으로 축약(동작 동일 유지 — 테스트 `header-utility-label.test.mjs`가 로그인/로그아웃 텍스트 전환을 검증하므로 데스크톱 유틸바 마크업/텍스트는 절대 바꾸지 말 것).
- `:156` 빠른 메뉴 `nav` 시작부, 즉 `iconLinks` 렌더 직전 또는 `ml-auto` 그룹 앞에 **모바일 전용 햄버거 트리거**를 배치: `<div className="sm:hidden"> <MobileNav categories=… highlightCategories=… /> </div>`. 데스크톱(`sm` 이상)에서는 숨김.
- `:178` 카테고리 `nav` 스크롤 힌트 추가: 현재 `no-scrollbar flex … overflow-x-auto`. 이 `nav`를 감싸는 relative wrapper `<div className="relative min-w-0 flex-1">`를 만들고, 양끝에 fade 오버레이 `<span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent" />`(좌측은 `left-0 from-white bg-gradient-to-r`)를 절대배치. **결정: `mask-image` 대신 그라데이션 오버레이 사용** — 근거: `mask-image`는 스크롤 위치와 무관하게 항상 양끝을 흐리게 해 첫 항목("홈")이 상시 반투명해지는 부작용이 있고, 오버레이는 배경색(`bg-white`)과 정확히 합성되어 시각 회귀 위험이 낮다.
- **주의:** `header > div` 구조 순서에 의존하는 테스트가 있다(`header-utility-label.test.mjs`의 `page.locator("header > div").first()` = 유틸바). 햄버거/오버레이 추가로 인해 `header`의 **직계 자식 div 순서·개수**가 바뀌면 이 테스트가 깨진다. 햄버거는 기존 두 번째 div(로고/검색/아이콘 행) **내부**에 넣고, 스크롤 힌트 wrapper는 세 번째 div(카테고리 바) **내부**에 넣어 `header`의 직계 자식 구조는 그대로 유지할 것.

#### 3. 구현 순서(커밋 단위)
1. `use-session-auth.ts` 훅 추출 + `site-header.tsx`가 훅 사용하도록 리팩터(동작 무변경, 테스트 그린 확인).
2. `mobile-nav.tsx` 신규 + 헤더에 `sm:hidden` 트리거 연결.
3. 카테고리 스크롤 힌트 오버레이 추가.

#### 4. 완료 기준(DoD)
- `npm run lint && npm run typecheck` 통과.
- 개별 테스트 그린: `header-utility-label`, `header-secondary-link-order`, `header-search-bar`, `mobile-footer-sections`.
- 390px: 햄버거 노출 → 클릭 → 드로어 열림 → 로그인/회원가입/카테고리/고객센터 모두 노출 → 링크 클릭 시 이동+드로어 닫힘 → `Esc`로 닫힘. **키보드만으로 트리거 포커스→열기→항목 순회→닫기 완주 가능.**
- 768px/1240px: 햄버거 미노출, 데스크톱 유틸바·카테고리 바 시각 회귀 없음. 카테고리 바 양끝 fade 오버레이 확인.

#### 5. 주의/리스크
- base-ui Dialog 임포트 서브패스를 추측하지 말고 `node_modules/@base-ui/react` 실제 export 또는 리포 사용례로 확인.
- 드로어가 `header`의 `z-50`·sticky 컨텍스트에 갇혀 backdrop이 헤더 아래에만 깔리지 않도록 `Dialog.Portal` 사용(포털로 body에 렌더).
- 스크롤 힌트 오버레이에 `pointer-events-none` 누락 시 첫/마지막 카테고리 링크 클릭이 막힌다 — 반드시 지정.

---

### P2 — 예매 플로우 (금액 URL 제거 ×2구간, 좌석 단일화·자동선택 제거, 스텝 가드, 타이머 a11y)

#### 1. 목표
금액을 URL로 신뢰하는 구조를 제거해 클라이언트 금액 위·변조 여지를 없애고, 이원화된 좌석 UI를 단일화하며 자동 좌석 선택을 제거하고, 스텝 가드와 타이머 접근성을 보강한다.

#### 2. 구현 상세

**핵심 설계 결정 — 금액 URL 제거 방식**
- booking→checkout URL에서 `base`/`fee`/`total` **쿼리 파라미터를 링크 생성 시점에 제거**한다. 대신 **좌석 식별자(`seats`, `ticketId`)와 회차(`date`/`time`/`count`)만** 전달하고, checkout 페이지가 금액을 **자체 재계산**한다.
- **하지만 checkout 페이지(`checkout/[slug]/page.tsx:38-48`)의 쿼리 수용 로직은 삭제하지 말고 "폴백"으로 남긴다.** 근거: `tests/checkout-catalog-routes.test.mjs`가 `/checkout/{slug}?…&base=…&fee=…&total=…&count=1` 형태의 **직접 URL 12건을 status 200으로 검증**한다. 쿼리 파싱을 제거하면 이 URL들이 그대로 200이긴 하나(쿼리는 무시 가능), 금액 표시가 달라질 수 있다. 안전책: checkout는 `ticketId`가 있으면 백엔드 좌석 가격으로 재계산, 없으면 기존 `query.base||query.price||fallbackBase` 로직 유지. 즉 **역산 할인(`discount = base+fee-total`) 표시만 제거**하고(`checkout/[slug]/page.tsx:46` `discountAmount` 계산에서 total 쿼리 기반 역산 삭제 → 0 고정), 금액 자체는 좌석/상품 데이터에서 도출.
- **결정 요약:** booking-panel은 더 이상 `base/fee/total`을 **생성**하지 않는다. checkout page는 그 파라미터가 **오더라도 무시하고 자체 계산**하되, 하위호환을 위해 파서는 남긴다(테스트 URL 200 유지). checkout→reservation도 동일 원칙.

**`src/components/ticketing/booking-panel.tsx`**
- `:94` `checkoutHref` 재작성:
  ```
  const checkoutHref = `/checkout/${show.slug}?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&seats=${encodeURIComponent(selectedLabels)}&count=${selectedCount}&ticketId=${encodeURIComponent(selectedBackendTicketId)}`;
  ```
  (`base`/`fee`/`total` 제거. `seats`/`count`/`ticketId`는 유지 — reservation 페이지가 `seats`에 의존하므로 절대 제거 금지, 아래 리스크 참조.)
- `:68-70` **첫 가용 좌석 자동 선택 제거.** `getSeatMap` `.then` 안에서 `setSelectedBackendTicketId(firstAvailableSeat?.id ?? "")` 라인 삭제하고 `setSelectedBackendTicketId("")` 유지(빈 값). `const firstAvailableSeat = …` 라인도 미사용이면 제거. 결과적으로 좌석 로드만으로는 `selectedBackendSeat`가 undefined → 금액 0 → `결제하기` 비활성.
  - **테스트 갱신 필수(치명):** 자동 선택 제거는 `tests/booking-single-checkout-flow.test.mjs:14-21`의 전제 — **좌석을 하나도 클릭하지 않은 상태**에서 `결제하기` link가 존재·클릭 가능 — 를 의도적으로 깨는 변경이다(현재 이 테스트가 통과하는 유일한 이유가 자동 선택이며, 테스트 서버는 `server.js`가 백엔드를 함께 띄워 seatMap이 항상 로드된다). **같은 커밋에서 이 테스트를 갱신**한다: `BackendSeatPicker`의 좌석 버튼에 `data-backend-seat` 속성을 부여하고, 테스트에서 `결제하기` 클릭 전에 `await page.locator("[data-backend-seat]").first().click();` 스텝을 추가한다. 이후의 `결제하기` link 계약 검증은 그대로 유지.
- `:218-226` **좌석 UI 단일화.** 백엔드 `seatMap` 로드 성공 시 정적 `SeatMap`을 숨긴다. 구체:
  - `const seatMapLoaded = Boolean(seatMap);`
  - 로드 성공(`seatMapLoaded`)이면 `<BackendSeatPicker … />`만 렌더, `<SeatMap … />` 블록(`:224-226`)은 렌더하지 않음.
  - 로드 실패(`seatMap === null && seatMapStatus`가 에러 문구)이면 정적 `SeatMap` 폴백 + 상단에 `role="status"` 안내 배너("실시간 좌석도를 불러오지 못해 데모 좌석도를 표시합니다"). 로딩 중(`seatMapStatus === "좌석도 로딩 중"`)에는 스켈레톤/로딩 텍스트만.
  - **결정:** 계획서 §2-2는 "백엔드 좌석 데이터를 기존 좌석도 그리드 렌더러에 주입"을 이상적 방향으로 제시하나, 그리드 렌더러 재사용은 데이터 스키마 매핑(row/col/tier) 작업량이 커 P2 범위를 초과한다. **P2에서는 "성공 시 BackendSeatPicker 단독, 실패 시 정적 SeatMap 폴백"으로 단일화만 확정**하고, 그리드 통합은 P4 2단 선택 설계에 위임한다(근거: 좌석 위·변조·이중 UI 혼란 제거가 P2의 핵심이고, 렌더러 통합은 접근성/터치타깃 재설계인 P4와 강하게 결합).
- `:140` 스텝 탭 가드: `onClick={() => setStep(item.id)}`를 `disabled` 가드와 결합. `seats` 스텝 탭은 `disabled={!canChooseSeats}`. `schedule` 탭은 항상 활성. 완료 표시(선택 완료된 스텝에 체크 아이콘) 추가는 선택사항.
- `:228-230` **`결제하기` 링크 → 버튼 전환.** 현재 `<Link href={canPay ? checkoutHref : "#"} aria-disabled>`.
  - **주의(테스트 파괴 위험, 최중요):** `tests/booking-single-checkout-flow.test.mjs`는 `page.getByRole("link", { name: "결제하기", exact: true })`로 **link 역할**을 찾아 클릭하고 `/checkout/les-miserables`로의 이동을 검증한다. `<button onClick={router.push}>`로 바꾸면 이 테스트가 즉시 깨진다.
  - **결정:** `결제하기`를 **`<button>`이 아니라 `<Link>`로 유지**하되, 비활성 시 `href="#"` 대신 렌더 자체를 분기한다. 활성(`canPay`) 시 `<Link href={checkoutHref}>`(role=link 유지 → 테스트 그린), 비활성 시 `<button type="button" disabled aria-disabled>`로 렌더해 Enter 시 `#` 스크롤 점프가 없도록 한다. 근거: 활성 상태의 link 계약을 지키면서 비활성 상태의 `#` 점프 문제만 제거. (단 자동 선택 제거로 테스트의 초기 상태가 "비활성"이 되므로, 위 `:68-70` 항목의 테스트 갱신 — 좌석 클릭 스텝 추가 — 이 반드시 선행돼야 한다.)
- `:152-163` 타이머 만료 섹션 a11y: 현재 `timerExpired && (<section aria-live="polite">…)`로 **조건부 마운트**. `aria-live`는 이미 DOM에 존재하던 요소의 내용이 바뀔 때 공지되므로, 만료 시점에 새로 마운트되면 스크린리더 공지가 보장되지 않는다.
  - 수정: 만료 섹션의 **DOM 요소(aria-live 컨테이너)는 상시 마운트**하되, **`data-booking-expired` 속성은 만료 시에만 조건부 부착**한다: `<section aria-live="polite" data-booking-expired={timerExpired ? "" : undefined}>{timerExpired ? (<>만료 문구+재예매 링크</>) : null}</section>`.
  - **근거(치명 — 속성을 상시 부착하면 테스트 2개가 깨진다):** `queue-timer-qa.test.mjs:35`와 `open-issues-regression.test.mjs:118`이 타이머 **미만료** 상태에서 `[data-booking-expired]` 개수 **0**을 검증한다. 만료 시를 대기하는 `queue-timer-qa.test.mjs:75`는 `waitFor()`(attached)라 조건부 속성으로도 통과한다. aria-live 공지는 속성이 아니라 컨테이너 상주로 확보되므로 접근성 목표도 유지된다. 빈 상태의 레이아웃 점프는 내용이 null이면 발생하지 않는다(높이 0).
  - 잔여 60초 미만 경고: `:118-127` 타이머 배지에 `timerSeconds < 60 && !timerExpired` 시 경고색(`bg-warn` 또는 `bg-accent`) + `aria-label`에 "곧 만료" 문구 갱신. 별도 `aria-live` 상태 문구를 만료 섹션 껍데기에 넣어 1분 경고를 공지.

**`src/components/ticketing/checkout-panel.tsx`**
- `:69-80` reservation으로의 `router.push` 파라미터: 현재 `base`/`fee`/`total`을 재전달. reservation 페이지는 `total`로 가격을 표시하고 `seats`로 가상티켓을 렌더하므로(아래 참조), **`seats`/`ticketId`는 유지, `base`/`fee`는 제거, `total`은 유지 여부를 reservation 표시 요구와 맞춰 결정.** 
  - **결정:** reservation 페이지가 `total` 쿼리로 PRICE를 표시하고 없으면 `reservation.price`로 폴백하므로(`reservation/[id]/page.tsx:38-39`), 위·변조 방지를 위해 **`total`도 제거**하고 reservation이 서버 데이터(`reservation.price` 또는 `purchase.ticket.faceValue` 기반)에서 표시하도록 한다. checkout-panel은 `purchase.ticket.faceValue`를 알고 있으므로, 신뢰 가능한 금액을 넘기려면 URL 대신 이미 백엔드가 확정한 `purchase`(구매 응답)에서 reservation이 재조회하는 것이 정석이나, 데모 범위상 **reservation 표시는 `reservation.price` 폴백으로 충분**하다. 따라서 push 파라미터는 `date`/`time`/`seats`/`count`/`ticketId`만 전달.
  - 단, `seats`는 `purchase.ticket.seatLabel`을 그대로 넘긴다(가상티켓 좌석 표시 근거).

**`src/app/checkout/[slug]/page.tsx` + `checkout-panel.tsx` 금액 재계산**
- `:43-46` 금액 산출: `base`/`fee`/`total` 쿼리 파서는 **하위호환 폴백으로 유지**(테스트 URL 200). 단 `:46` `discountAmount = Math.max(0, baseAmount+feeAmount-totalAmount)` 역산 제거 → `discountAmount = 0` 고정. **URL의 total만 낮춰 "할인" 표시되는 취약점 제거가 목표.**
- **재계산 층 결정: 금액 재계산은 `checkout-panel.tsx`(클라이언트)에서 수행한다.** `checkout/[slug]/page.tsx`는 서버 컴포넌트라 클라이언트 API 훅을 쓸 수 없고, 기존 `getState()` 호출(`checkout-panel.tsx:59-63`)은 결제 버튼 클릭 시점의 ticketId 폴백 선택용이지 금액 표시 경로가 아니다. 따라서: `selection.ticketId`가 있으면 **mount 시 `useEffect`로 `getSeatMap(backendEventId)`(또는 `getState()`)를 1회 호출**해 해당 좌석의 price(`faceValue`)를 얻고, 이를 `baseAmount`/`totalAmount` **표시값**으로 덮어쓴다(조회 실패·ticketId 부재 시 기존 `selection.baseAmount` 폴백).

**`src/app/reservation/[id]/page.tsx`** (최신 리팩터 반영)
- 이 페이지는 이미 `virtual-ticket-card.tsx` 추출 + `resolveVirtualTicketSeats`(좌석별 다중 티켓) + `seats` 쿼리 사용으로 리팩터됨. **P2에서 구조 변경은 최소화**하고 금액 신뢰 부분만 손본다:
  - `:38-39` `total` 쿼리 기반 `price` 계산 제거 또는 `reservation.price` 폴백 우선. checkout-panel이 `total`을 더 넘기지 않으므로(위 결정), `queryParam(query.total)`은 자연히 undefined → `reservation.price` 사용. **단, `query.total` 파서 자체는 남겨도 무해**(하위호환).
  - `:37`, `:41` `seats` 쿼리 의존은 **그대로 유지**. `resolveVirtualTicketSeats`가 `seats`/`seat` 오버라이드 → `reservation.seats`/`reservation.seat` 폴백 순으로 동작하므로, checkout-panel이 `seats`를 계속 넘기는 한 좌석별 티켓 렌더가 정상. **`seats` 파라미터를 P2에서 실수로 제거하면 다중 좌석 티켓이 단일 폴백으로 붕괴하고 `reservation-virtual-ticket-visual.test.mjs`가 깨진다**(아래 리스크).

**`src/components/ticketing/seat-map.tsx`, `backend-seat-picker.tsx`**
- P2에서 좌석 버튼 크기(터치타깃)는 **건드리지 않는다** — P4 소관. P2는 렌더 분기(성공/실패 폴백)만.

#### 3. 구현 순서(커밋 단위)
1. 자동 좌석 선택 제거 + `booking-single-checkout-flow` 테스트 갱신(좌석 클릭 스텝) + `결제하기` 활성/비활성 렌더 분기(link 계약 유지) + 스텝 탭 가드.
2. 좌석 UI 단일화(성공 시 BackendSeatPicker 단독, 실패 시 정적 폴백 + 배너, status 배지 유지).
3. 금액 URL 제거(booking `checkoutHref`, checkout-panel push, checkout page 역산 할인 제거 + panel 재계산, reservation total 표시 폴백).
4. 타이머 live region 컨테이너 상시 마운트(`data-booking-expired` 조건부 속성) + 60초 경고.

#### 4. 완료 기준(DoD)
- `npm run lint && npm run typecheck` 통과.
- 개별 테스트 그린: `booking-single-checkout-flow`(**좌석 클릭 스텝 추가로 갱신 후**), `checkout-catalog-routes`, `event-id-mapping`, `queue-timer-qa`, `open-issues-regression`, `reservation-virtual-ticket-visual`, `admission-flow`, `queue-booking-transition`, `cancel-flow-state`.
- 수동(390/768/1240): 좌석도 로드 후 **아무 좌석도 선택 안 하면 `결제하기` 비활성**이며 Enter 시 스크롤 점프 없음. 좌석 선택 시 금액 채워지고 checkout 이동. checkout URL에 `base/fee/total` 없음. checkout에서 total 조작 URL(`?total=1`)로 접근해도 화면에 허위 "할인" 미표시. **키보드만으로 날짜→회차→좌석→결제 완주 가능.** 타이머 만료 시 만료 안내가 스크린리더에 공지되고, 잔여 60초 미만에서 배지 경고색.

#### 5. 주의/리스크
- **`결제하기` role 계약:** `booking-single-checkout-flow.test.mjs`는 **활성 상태 link**를 기대한다. 활성 시 반드시 `<Link>`(role=link) 유지. 이 계약을 어기면 테스트 실패.
- **`seats` 파라미터 제거 금지:** reservation 페이지의 `resolveVirtualTicketSeats`가 `seats`/`seat`에 의존한다. `reservation-virtual-ticket-visual.test.mjs`는 `figure[aria-label="소유 확인용 가상 티켓 이미지"]`가 **정확히 2개**(VIP H-14, VIP H-15) 렌더됨을 검증하는데, 이는 `reservation.seats` 폴백 경로다. checkout→reservation에서 `seats`를 넘기던 것을 제거하면 폴백으로 여전히 2개가 나올 수 있으나, `count`/`seats` 조합을 잘못 건드리면 개수가 틀어진다. **금액 파라미터(`base/fee/total`)만 제거하고 좌석 파라미터(`seats/ticketId/count`)는 유지**할 것.
- **checkout 직접 URL 200 유지:** `checkout-catalog-routes.test.mjs`의 12개 URL에 `base/fee/total`이 들어 있다. checkout page 파서를 제거하면 파라미터가 무시되어도 200이지만, 방어적으로 파서는 남겨 하위호환을 유지하라(테스트 갱신 최소화).
- 좌석 UI 단일화 시 `backendSeats`(`booking-panel.tsx:85`, `.slice(0,48)`) 의존 컴포넌트가 여전히 유효한지 확인. 정적 `SeatMap`을 숨겨도 `seats`(`createSeatMap` 결과)를 참조하는 요약(`selectedSeats`, `baseAmount`)이 백엔드 미선택 시 0이 되는 흐름을 검증.
- **`BackendSeatPicker` status 배지 제거 금지:** `event-id-mapping.test.mjs:56`은 "좌석 선택으로 이동" 클릭 후 백엔드 이벤트 제목("Midnight Sonata")이 화면에 보이길 기대하는데, 이 텍스트는 status 배지(`booking-panel.tsx:71`의 `${event.title} · N석 로드`)에서 온다. 좌석 UI 단일화 시 이 배지를 유지할 것.

---

### P3a — Pretendard 로드 + Button cva 통합·채택

#### 1. 목표
1순위 폰트 `Pretendard Variable`를 자체 호스팅으로 실제 로드하고, `import 0건 데드코드`인 `ui/button.tsx`를 프로젝트 규약에 맞춰 정리한 뒤 주요 CTA부터 채택한다.

#### 2. 구현 상세

**폰트 로드 — `src/app/layout.tsx`**
- 현재 `layout.tsx:2`(import)와 `:5-10`(로더 정의)은 `Noto_Sans_KR`만 로드(`--font-noto`). `globals.css:8-9,105-106`의 폰트 스택 1순위 `"Pretendard Variable"`은 미로드 → Noto로 폴백 중.
- **결정: `next/font/local`로 Pretendard Variable 자체 호스팅.** 근거: Pretendard는 next/font/google 미지원. Variable 폰트(`.woff2` 1개, `weight: 45 920`)를 `src/app/fonts/`(또는 `public/fonts/`)에 배치하고 `next/font/local`로 로드, `variable: "--font-pretendard"` 지정. `globals.css`의 `--font-sans`/`--font-display` 1순위를 `"Pretendard Variable"`에서 `var(--font-pretendard)`로 교체(하드코딩 폰트명 대신 next/font가 부여하는 CSS 변수 사용 — FOUT/이름 불일치 방지).
- **폰트 파일 확보:** 리포에 `.woff2`가 없으면 codex는 임의 다운로드 금지. **폰트 바이너리가 리포에 없으면 이 서브태스크는 "차단"으로 보고**하고, next/font/local 배선 코드만 준비하되 파일 경로를 TODO로 남긴다(또는 사용자에게 폰트 파일 제공을 요청). 근거: 라이선스/바이너리 커밋은 사람 결정 사항.
- `layout.tsx`에서 `<html>` 또는 `<body>` className에 `pretendard.variable` 추가.

**Button cva 정리 — `src/components/ui/button.tsx`**
- **현황:** 파일은 이미 cva 기반으로 잘 구성됨. **단, 계획서 §2-3이 기대한 variant 이름(`primary/dark/outline/ghost`)과 실제 구현이 다르다.** 실제 variant: `default`(bg-primary), `accent`(bg-ticketground), `clean`(bg-accent-2), `outline`, `secondary`, `ghost`, `destructive`, `link`. size: `default/xs/sm/lg/xl/icon/…`.
- `default`/`outline` 등이 **shadcn 다크모드 토큰(`dark:…`, `bg-primary`, `border-input`)에 묶여 있는데, 이 프로젝트는 라이트 온리이며 해당 토큰 상당수가 데드**다(P5에서 `.dark` 정리 예정). **결정:** variant 이름을 프로젝트 CTA 실사용에 맞춰 정비:
  - 실사용 CTA는 두 계열뿐 — 빨강 강조(`bg-ticketground`)와 검정(`bg-ink`). 기존 `accent`(=ticketground 빨강) 유지, 신규 `dark`(`bg-ink text-white hover:bg-ink/90`) 추가. `clean`(노랑) 유지. `outline`/`ghost`는 라이트 온리로 단순화(`dark:` 접두 규칙 제거는 P5에서, P3a에서는 최소 변경).
  - size는 실사용 높이에 맞춰 `md`(h-11/h-12급 CTA) 존재 확인. 현재 `xl: h-12 … px-6`가 CTA에 해당하므로 이를 표준 CTA size로 채택.
- **채택 범위(데드코드 해소 목적, 최소 침습):** 인라인으로 CTA를 재작성한 대표 지점 3~5곳만 치환:
  - `booking-panel.tsx:202` "좌석 선택으로 이동"(`bg-ticketground` CTA, `<button>`) → `<Button variant="accent" size="xl">`.
  - `booking-panel.tsx:158` "다시 예매하기"(`bg-ink` `next/link`), `reservation/[id]/page.tsx:53` "내 예약 보기"(`bg-[#29292d]` `next/link`) — **주의: `ui/button.tsx:64-77`의 `ButtonLink`는 raw `<a>`를 렌더하므로 그대로 치환하면 클라이언트 내비게이션(prefetch/SPA 전환)을 잃는다.** 두 가지 중 택일: (a) `<Link href={…} className={cn(buttonVariants({ variant: "dark", size: "xl" }))}>` 형태로 **`buttonVariants`만 채택**(권장, 최소 침습), (b) `ButtonLink`를 `next/link` 기반으로 개조 후 사용(기존 `<a>` 사용처 없음 확인됨 — import 0건이라 개조 안전).
  - **주의:** `결제하기`(booking-panel)는 P2에서 link 계약이 걸려 있으니 P3a에서 함부로 바꾸지 말 것(role=link 유지 필수). 치환 대상에서 제외.

#### 3. 구현 순서
1. Pretendard next/font/local 배선(+파일 없으면 차단 보고).
2. Button variant 정비(`dark` 추가, 라이트 온리 정리).
3. 대표 CTA 3~5곳 `Button`/`ButtonLink` 채택.

#### 4. 완료 기준(DoD)
- `npm run lint && npm run typecheck` 통과(`ui/button.tsx` import 0건 → 1건 이상으로 데드코드 해소).
- 폰트: 브라우저 devtools에서 본문 `computed font-family` 1순위가 Pretendard로 적용(파일 확보 시). 미확보 시 배선만 + TODO 명시.
- 개별 테스트 그린: `booking-single-checkout-flow`(CTA 텍스트/role 불변), `queue-timer-qa`(다시 예매하기 href 불변 — `queue-timer-qa.test.mjs:79`가 "다시 예매하기" link href `/queue/…` 검증).
- 수동(390/768/1240): 치환 CTA 시각 회귀 없음(높이/색/포커스링 동일).

#### 5. 주의/리스크
- **"다시 예매하기" href 계약:** `queue-timer-qa.test.mjs`가 이 link의 href가 `/queue/les-miserables`로 시작함을 검증. `ButtonLink` 치환 시 `href` 반드시 보존.
- Button variant 이름 변경 시 계획서 문구(`primary/dark`)를 맹신하지 말고 **실제 파일의 기존 variant를 확인 후** 최소 확장(신규 `dark`만 추가) — 기존 `default/accent/clean` 삭제 금지(다른 곳에서 참조될 수 있음. 실제로는 import 0건이나 방어적).
- next/font/local에서 폰트 파일 경로 오타 시 빌드는 통과하나 폴백 렌더 → devtools로 실제 적용 확인 필수.

---

### P3b — px 임의값 · hex 하드코딩 · bg-white 치환 + 타이포 가이드

#### 1. 목표
디자인 토큰 스케일(`--fs-*`/`--r-*`/시맨틱 색)로 광범위 치환해 스타일 이원화를 해소하고, 타이포 위계를 `DESIGN.md`에 명문화한다. **시각 회귀 없음이 최우선 제약.**

#### 2. 구현 상세 — 매핑 표 확정 선행

**(A) px → 토큰 매핑 표 (`text-[Npx]`, 실측 최빈값 기준)**

`--fs` 스케일(px): xs=12, sm=13, md=15, lg=16, xl=18, 2xl=20, 3xl=23, 4xl=28, 5xl=37, 6xl=50, 7xl=72. Tailwind v4 매핑(globals.css:12-33): `text-xs=text-sm=fs-sm(13)`, `text-base=fs-md(15)`, `text-lg=fs-lg(16)`, `text-xl=fs-xl(18)`, `text-2xl=fs-2xl(20)`, `text-3xl=fs-3xl(23)`, `text-4xl=fs-4xl(28)`.

| px 임의값 | 빈도 | 대응 토큰 유틸 | 매핑 결정 | 근거 |
|---|---|---|---|---|
| `text-[13px]` | 91 | `text-sm` (=13) | **그대로 `text-sm`** | 정확히 일치, 무손실 |
| `text-[14px]` | 63 | 없음(13↔15 사이) | **`text-sm`(13px)로 통일** | 본문 보조 텍스트. 15로 올리면 밀도 저하·줄바꿈 변동 위험. -1px는 시각 영향 최소. 대량이라 한 방향 통일이 안전 |
| `text-[15px]` | 34 | `text-base` (=15) | **그대로 `text-base`** | 정확히 일치 |
| `text-[12px]` | 21 | 없음(`text-xs`도 **13px**로 매핑됨 — `globals.css:12` `--text-xs: var(--fs-sm)`) | **`text-xs`(13px)로 +1px 통일**, 캡션·법적 고지 등 밀도 민감 지점은 유지 | Tailwind `text-xs`가 `--fs-sm`(13)에 물려 있어 12px 무손실 유틸이 없음. 14px→13px과 같은 "±1px 본문급" 범주 |
| `text-[16px]` | 20 | `text-lg` (=16) | **그대로 `text-lg`** | 정확히 일치 |
| `text-[18px]` | 17 | `text-xl` (=18) | **그대로 `text-xl`** | 정확히 일치 |
| `text-[22px]` | 15 | 없음(20↔23) | **`text-2xl`(20px)** | 서브헤딩. 23(3xl)은 과대. -2px 허용 |
| `text-[20px]` | 14 | `text-2xl` (=20) | **그대로 `text-2xl`** | 정확히 일치 |
| `text-[26px]` | 12 | 없음(23↔28) | **`text-4xl`(28px)** 또는 유지 | 헤딩. +2px 허용. 시각검증 필수. **불확실 시 임의값 유지 허용** |
| `text-[30px]` | 10 | 없음(28↔37) | **유지 또는 `text-4xl`(28)** | 헤딩. 큰 폭 변동 위험 → **유지 권장** |
| `text-[34px]`,`[32px]`,`[37px]`,`[50px]`,`[64px]`,`[44px]`,`[31px]`,`[25px]`,`[23px]`,`[24px]`,`[19px]`,`[17px]`,`[10px]`,`[11px]` | 저빈도 | 부분 대응 | `[23px]→text-3xl`, `[28px]→text-4xl`, `[37px]→text-5xl`, `[50px]→text-6xl`만 무손실 치환. **그 외 비대응 헤딩·저빈도값은 유지**(치환 이득 < 회귀 위험) | 헤딩은 시각 임팩트가 커 임의 px 유지가 안전 |

> **핵심 규칙:** **무손실 치환(정확 일치)은 전량 수행**, **±1~2px 통일은 본문급(12/14/22)만 결정값대로**, **헤딩급 비대응값(26/30/34/32/44/64…)은 유지**한다. 즉 이 Phase는 "본문·보조 텍스트 토큰화"에 집중하고 헤딩 임의값은 다음 라운드로 남긴다.

**(B) `rounded-[Npx]` → 반경 토큰 (`--r`: xs=4, sm=8, md=11, lg=12, xl=20, 2xl=32)**

| px | 빈도 | 매핑 | 근거 |
|---|---|---|---|
| `rounded-[8px]` | 59 | `rounded-sm`(=8) | 정확 일치 |
| `rounded-[10px]` | 30 | `rounded-md`(=11) | 근사(+1). 대량 통일. **또는 유지** — 시각검증 후 결정. **권장: `rounded-md`로 통일**(카드 반경 일관) |
| `rounded-[12px]` | 18 | `rounded-lg`(=12) | 정확 일치 |
| `rounded-[6px]` | 5 | 없음(4↔8) | **`rounded-xs`(4) 또는 유지** — 작은 배지, 유지 권장 |
| `rounded-[4px]` | 1 | `rounded-xs`(=4) | 정확 일치 |
| `rounded-[20px]`,`[24px]`,`[3px]` | 저빈도 | `[20px]→rounded-xl`, 그 외 유지 | |

**(C) hex → 시맨틱 토큰 매핑 표 (실측 최빈값)**

globals.css 팔레트: `--ink=#1a1a1d`, `--ink-2=#29292d`, `--ink-3=#6b6b70`, `--ink-4=#999999`, `--line=rgba(0,0,0,.08)`, `--line-strong=rgba(0,0,0,.16)`, `--bg-2=#f7f7f8`, `--bg-3=#f3f3f3`, `--bg-4=#ebebed`, `--link=#1a47ff`, `--accent=#ff2d3f`, `--accent-2=#ffe92e`, `--ok=#1f8a5b`, `--warn=#c47a00`. 유틸: `text-ink/ink-2/ink-3/ink-4`, `border-line/line-strong`, `bg-surface(=bg-2)/surface-2(=bg-3)/surface-3(=bg-4)`, `text-link/bg-link`, `text-ticketground(=accent)`, `text-accent-2`, `text-ok`, `text-warn`.

| hex | 빈도 | 시맨틱 토큰 | 매핑 결정 | 근거 |
|---|---|---|---|---|
| `#29292d` | 36 | `--ink-2` | `text-ink-2`/`bg-ink-2`/`border-ink-2` | 정확 일치 |
| `#eee` | 20 | ≈`--line`(테두리)/`--bg-3`(면) | 문맥 판별: `border-[#eee]`→`border-line`, `bg-[#eee]`→`bg-surface-2` | `#eee`는 약한 경계선. line은 rgba지만 시각상 근사 |
| `#7e7e81` | 10 | ≈`--ink-3`(#6b6b70) | `text-ink-3` | 근사 회색. 통일 |
| `#666` | 10 | ≈`--ink-3` | `text-ink-3` | 보조 텍스트 회색 |
| `#ffe92e` | 7 | `--accent-2` | `text-accent-2`/`bg-accent-2` | 정확 일치 |
| `#ff2d3f` | 6 | `--accent`(ticketground) | `text-ticketground`/`bg-ticketground` | 정확 일치 |
| `#ddd` | 6 | ≈`--line`/`--line-strong` | `border-line`(약)/`border-line-strong`(진) | 문맥 |
| `#1a47ff` | 6 | `--link` | `text-link`/`bg-link` | 정확 일치 |
| `#4154ff` | 2 | 없음(근사: `--link`) | `checkout-panel.tsx:123,140`의 `accent-[#4154ff]`(라디오/체크박스 accent-color) → **`accent-link`로 치환** | 근사(#1a47ff). 폼 컨트롤 accent라 시각 위험 낮음 |
| `#1a1a1d` | 6 | `--ink` | `text-ink` | 정확 일치 |
| `#f3f3f3` | 5 | `--bg-3` | `bg-surface-2` | 정확 일치 |
| `#d8d8d8` | 5 | ≈`--bg-4`/`--ink-4` | 면=`bg-surface-3`, 비활성텍스트=근사 | 문맥(disabled 버튼 면은 `bg-surface-3`) |
| `#777` | 5 | ≈`--ink-3` | `text-ink-3` | 회색 통일 |
| `#eef0ff` | 4 | 없음(연보라 틴트) | **`bg-tint-blue`** (`color-mix(link 8%, white)`) | link 계열 연틴트에 대응 |
| `#f8f8f8` | 2 | ≈`--bg-2` | `bg-surface` | 근사 |
| `#999` | 2 | `--ink-4` | `text-ink-4` | 정확 일치 |
| `#6b6b70` | 2 | `--ink-3` | `text-ink-3` | 정확 일치 |
| 그 외 저빈도(`#bdbdbd`,`#9b9b9b`,`#e0e0e0`,`#d9cffb`,`#652cb2`,`#f7f7f8`…) | 각 1~4 | 근사 토큰 또는 유지 | `#f7f7f8→bg-surface`, `#1f8a5b→text-ok`. 브랜드성 특이색(`#652cb2` 보라, `#d9cffb`)은 **유지**(대응 토큰 없음) | 무대응 브랜드색은 회귀 위험 |

**(D) `bg-white` → 시맨틱 (P5의 다크 대비 준비를 여기 병합)**
- `bg-white`가 **카드/패널 면**이면 `bg-card` 대응 토큰 확인 후 치환, 없으면 `bg-background`. **결정: `--color-background`/`--color-card`의 실제 정의를 globals에서 확인 후, 라이트 온리 프로젝트이므로 값이 흰색이면 `bg-background`로 통일.** 단 `site-header.tsx`의 `bg-white`(sticky 헤더 배경)처럼 스크롤 힌트 오버레이 그라데이션(`from-white`)과 색을 맞춰야 하는 곳은 동일 토큰으로 함께 치환(P1 오버레이의 `from-white`도 같이 교체).
- **주의:** `reservation-virtual-ticket-visual.test.mjs`가 `virtual-ticket-card.tsx`의 클래스(`border-dashed` 부재 등)와 텍스트를 검증한다. 가상티켓 카드의 `bg-white`/`bg-surface` 치환은 시각 회귀만 없으면 안전하나, `border-dashed`를 새로 도입하지 말 것(테스트가 대시 구분선 0개를 요구).

**(E) 타이포 위계 명문화 — 신규 `DESIGN.md`(리포 루트)**
- 위계 확정: **본문 `font-normal`, 보조/라벨 `font-medium`, 강조 `font-bold`, 헤딩 `font-black`.**
- 현재 이원화(booking/홈=`font-black`, checkout/mypage/reservation=`font-bold`) 중 **헤딩은 `font-black`으로 통일**, 본문 강조는 `font-bold`. checkout/reservation 계열의 헤딩(`text-[28px] font-bold` 등)을 `font-black`으로 승격.
- `DESIGN.md`에 fs/r/색 토큰 표 + 폰트 웨이트 규칙 + "임의 px·hex 금지, 토큰 사용" 규약 기록.

#### 3. 구현 순서(커밋 단위 — 파일군별 분할로 리뷰·롤백 용이)
1. `DESIGN.md` 작성 + 매핑 표 확정(코드 무변경, 리뷰 게이트).
2. **무손실 치환만** 전량(정확 일치 px/rounded/hex) — 자동화 가능하나 파일군별로 나눠 커밋(예: `checkout-panel.tsx`+`reservation` / `mypage`+`account-summary-panel` / `poster-card`+홈카드 계열).
3. **±1~2px 통일**(14→text-sm, 22→text-2xl, 10→rounded-md) — 시각검증 커밋.
4. hex 근사색 통일(#7e7e81/#666/#777→ink-3 등) + `bg-white`→시맨틱.
5. `font-bold`→`font-black` 헤딩 승격.

#### 4. 완료 기준(DoD)
- `npm run lint && npm run typecheck && npm test` 전량 통과.
- **잔여량 감소 확인:** `grep -roE "text-\[[0-9]+px\]" src | wc -l`가 본문급 치환 후 유의미 감소(헤딩 유지분 제외). `grep -roE "#[0-9a-fA-F]{3,8}" src | wc -l`가 대응표 처리 후 감소.
- **시각 회귀 없음(최우선):** 주요 페이지(홈, `/booking/les-miserables`, `/checkout/les-miserables?…`, `/reservation/CTI-260513-A4F2K9`, `/mypage`) 스크린샷을 치환 전/후 대조. 390/768/1240 3폭.
- 개별 테스트 그린: `reservation-virtual-ticket-visual`(클래스/텍스트 계약), `mypage-history-search`, `mypage-account-actions`, `search-mobile-layout`(버튼 텍스트 줄바꿈), `detail-poster-image`.

#### 5. 주의/리스크
- **비대응 헤딩값을 억지 치환하지 말 것** — 26/30/34px 등을 근사 토큰으로 밀면 헤딩 크기가 눈에 띄게 변해 회귀. 유지가 정답.
- **`#eee`/`#ddd` 문맥 판별:** `border-`인지 `bg-`인지에 따라 line/surface로 갈린다. 일괄 sed 금지, 클래스 접두 확인.
- **테스트가 검증하는 클래스/텍스트 불변:** `reservation-virtual-ticket-visual.test.mjs`는 `figure[aria-label]`·`VIRTUAL TICKET`·`APP ONLY`·`border-dashed` 부재를 검증. `virtual-ticket-card.tsx` 치환 시 이 마크업/텍스트/클래스 계약을 깨지 말 것.
- **`search-mobile-layout.test.mjs`**는 검색 폼 버튼(`form[action='/contents/search'] button`)의 `white-space: nowrap`/1줄 렌더를 검증하는데, 이 버튼은 헤더 SearchBar가 아니라 **`discovery/search-panels.tsx:73-74`의 검색 페이지 폼 버튼**이다(검색 페이지는 헤더 검색바를 숨김). 이 파일 치환 시 `whitespace-nowrap`/폰트 크기 계약을 유지할 것. 헤더에 같은 selector에 걸리는 텍스트 버튼을 새로 만들지도 말 것.
- 자동화 스크립트로 치환하더라도 커밋을 파일군별로 쪼개 시각검증·롤백 단위를 작게 유지.

---

### P4 — 접근성 (좌석 터치타깃 임시 확대 + 2단 선택 설계, 스크롤 힌트, 데드코드 삭제)

#### 1. 목표
좌석 버튼 터치타깃을 모바일에서 임시 확대하고 좌석도 스크롤 힌트를 추가하며, 근본 해법인 2단 선택(등급/구역→구역 확대 그리드)을 설계 문서로 확정하고, 데드코드를 삭제한다.

#### 2. 구현 상세

**`src/components/ticketing/seat-map.tsx`**
- `:86` 좌석 버튼 현재 `size-6`(24px). **결정: 반응형 `size-6 sm:size-9`(모바일 24px 유지, sm 이상 36px)가 아니라, 모바일에서 확대**가 목표이므로 트레이드오프를 명시적으로 처리. 계획서 §2-4가 지적한 대로 22열×44px는 1000px+로 모바일 오버플로 악화.
  - **결정값: 모바일 `size-8`(32px), sm+ `size-9`(36px)** — `className`의 `size-6`을 `size-8 sm:size-9`로. 근거: 44px 권장에는 못 미치나 24→32px로 터치 실패율을 유의미하게 낮추면서, 32px×22열≈704px로 모바일 가로 스크롤을 감내 가능한 수준으로 유지(44px의 1000px+ 대비). **이는 임시조치임을 코드 주석과 설계문서에 명시.**
  - `:92` 체크 아이콘 `size-3.5`도 버튼 확대에 맞춰 `size-4`로 소폭 상향.
- 좌석도 스크롤 힌트: 22열 그리드 스크롤 컨테이너(`seat-map.tsx`의 `overflow-x-auto` 래퍼 위치 확인)에 P1과 동일한 **양끝 그라데이션 오버레이 + 우측 화살표 힌트**. `data-*` 스크롤 훅이 있으면 재사용.

**2단 선택 설계 — 신규 `docs/design/seat-selection-2step.md`**
- **구현이 아니라 설계 문서만 P4에서 산출**(계획서 §2-4: "설계까지 확정하고 구현 여부는 범위 협의"). 문서 내용:
  - 1단계: 등급(VIP/R/S/A) 또는 구역 선택 UI(큰 터치타깃 카드).
  - 2단계: 선택 구역만 확대 렌더(적은 열 수 → 44px 터치타깃 확보 가능).
  - 백엔드 `seatMap.seats`의 구역/등급 필드 매핑, `BackendSeatPicker`와의 통합 지점, P2에서 미룬 "그리드 렌더러에 백엔드 데이터 주입"을 여기서 흡수.
  - 접근성: 각 단계 `role`/`aria`, 키보드 순회, 라이브 리전.

**데드코드 삭제**
- `src/components/ticketground/primitives.tsx`의 `TicketgroundModal` — **import 0건 확인 후 삭제**(`grep -rn "TicketgroundModal" src`로 참조 0 재확인 필수). 실사용 Dialog는 P1 드로어로 확보됨.
- 삭제 전 `TicketgroundModal`만 export하는지, 같은 파일의 다른 프리미티브(Surface/Chip/Tag)가 사용 중인지 확인 — **사용 중 프리미티브는 남기고 Modal만 제거**.

#### 3. 구현 순서
1. 데드코드 삭제(`TicketgroundModal`, 참조 0 재확인).
2. 좌석 터치타깃 `size-8 sm:size-9` + 아이콘 상향.
3. 좌석도 스크롤 힌트.
4. `seat-selection-2step.md` 설계 문서.

#### 4. 완료 기준(DoD)
- `npm run lint && npm run typecheck` 통과(삭제로 인한 미사용 import 정리 포함).
- 개별 테스트 그린: `admission-flow`, `booking-single-checkout-flow`. (`open-calendar-mobile-size`는 `/open` 캘린더 전용(`[data-open-calendar-grid]`)으로 seat-map과 **무관 확인됨** — 공통 스크롤 힌트 유틸을 캘린더에 적용하지 않는 한 영향 없음.)
- 수동(390): 좌석 버튼 탭 타깃 32px 확인, 가로 스크롤 존재하되 힌트로 인지 가능. 좌석 선택 키보드 순회 가능.
- 768/1240: 좌석 36px, 회귀 없음.

#### 5. 주의/리스크
- **`open-calendar-mobile-size.test.mjs`**가 `[data-open-calendar-grid]` 등 그리드 요소 크기를 검증한다. 좌석도(seat-map)와 오픈 캘린더는 다른 컴포넌트지만, 공통 스크롤 힌트 유틸을 만들 경우 캘린더 쪽 마크업을 건드리지 말 것.
- 좌석 확대로 22열 폭이 늘어 **390px에서 요약 사이드바/컨테이너가 밀리는지** 확인 — 좌석도는 자체 `overflow-x-auto` 내부에서만 넓어져야 하고 페이지 전체 가로 스크롤을 유발하면 안 됨(공통 DoD 위반).
- `TicketgroundModal` 삭제 시 같은 파일 다른 export 동반 삭제 금지.

---

### P5 — 다크모드 데드 CSS 정리 + next/image 전환

#### 1. 목표
켜면 깨지는 반쪽 `.dark` 구현을 제거해 "라이트 온리"를 명시하고, 홈 raw `<img>`를 `next/image`로 전환해 LCP를 개선한다.

#### 2. 구현 상세

**다크 데드코드 정리 — `src/app/globals.css`**
- `:203-235` `.dark { … }` 블록 삭제(shadcn oklch 토큰만 덮고 실제 화면이 쓰는 `--ink`/`--bg`/`--line` 미정의 → 데드).
- `ui/button.tsx` 등에 남은 `dark:` 유틸 접두(P3a에서 일부 정리)도 라이트 온리 기조에 맞춰 제거 검토(단, 삭제가 시각 변화를 유발하지 않는지 확인 — `dark:`는 다크 미적용 시 무효과이므로 안전하게 제거 가능).
- `bg-white`→시맨틱 치환은 P3b에 병합됨. P5에서는 **CSS 데드 토큰/블록 정리만**.
- 라이트 온리 명시 주석을 globals.css 상단과 `DESIGN.md`에 추가.

**next/image 전환 — 홈 컴포넌트 8파일**
- 대상(raw `<img>` + `eslint-disable no-img-element`): `poster-card.tsx`, `time-deal.tsx`, `promo-row.tsx`, `ticketground-play.tsx`, `best-reviews.tsx`, `opening-soon.tsx`, `home/home-cards.tsx`, `ticketing/show-card.tsx`.
- 전환 규칙:
  - 고정비율 카드 이미지: `<Image fill sizes="…" className="object-cover" />` + 부모 `relative` + 종횡비 지정. 참고 구현: 이미 `next/image`를 쓰는 `watchlist/watchlist-show-card.tsx`, `discovery/show-tile.tsx`, `goods/[slug]/page.tsx` 패턴을 그대로 따를 것.
  - 히어로/최상단 LCP 이미지(홈 첫 화면 포스터): `priority` 지정.
  - `sizes`는 뷰포트별 카드 폭에 맞춰 지정(예: `"(max-width:768px) 50vw, 240px"`).
  - `eslint-disable @next/next/no-img-element` 주석 제거.
- **이미지 출처 확인 완료:** 8개 파일의 이미지 src는 **전부 로컬**(`/images/...`, `public/` 하위)이고 `next.config.ts`에 `images` 설정이 없음 — **`remotePatterns` 등록 불필요.** 단 `/images/mini/*.gif` 등 **애니메이션 GIF**가 있어 next/image 전환 시 해당 이미지에 `unoptimized` 지정이 필요할 수 있다(최적화 파이프라인이 GIF 애니메이션을 깨뜨릴 수 있음).

#### 3. 구현 순서
1. `.dark` 블록 + 데드 토큰 삭제 + 라이트 온리 명시.
2. 파일별 `next/image` 전환(1~2파일씩 커밋, 스크린샷 대조. GIF는 `unoptimized` 검토).

#### 4. 완료 기준(DoD)
- `npm run lint && npm run typecheck && npm test` 전량 통과(전 Phase 최종 게이트 겸).
- `grep -rn "no-img-element" src` 0건, `grep -rln "<img" src` 0건.
- 시각 회귀 없음: 홈 스크린샷 전/후 대조(포스터 비율/크롭 동일). 390/768/1240.
- LCP 이미지에 `priority` 적용 확인(devtools Network에서 preload).

#### 5. 주의/리스크
- **`detail-poster-image.test.mjs`, `watchlist-posters.test.mjs`, `home-card-routes.test.mjs`**가 포스터 이미지/링크를 검증할 수 있다 — `next/image`는 `<img>`를 srcset과 함께 렌더하므로 이미지 `alt`/부모 링크 구조를 보존해야 셀렉터가 유지된다. 전환 후 개별 실행 필수.
- `next/image`는 부모에 크기/`relative`가 없으면 레이아웃 붕괴. `fill` 사용 시 부모 `relative` + 명시적 종횡비/높이 필수.
- 원격 도메인 미등록 시 런타임 에러 → 반드시 config 선확인.
- `.dark` 삭제로 `--card`/`--border` 등 shadcn 토큰을 참조하던 컴포넌트가 라이트값을 잃지 않는지 확인(`:root`에 라이트 정의가 있으면 안전, 없으면 P3b의 `bg-background`/`bg-card` 치환과 정합 확인).

---

## 7. Phase 진행 순서 및 게이트

| Phase | 선행 의존 | 병행 가능 | 게이트에서의 Claude 리뷰 포인트 |
|---|---|---|---|
| **P1** | 없음 | P3a와 병행 가능(파일 거의 안 겹침) | base-ui Dialog 포털/포커스 트랩 실동작, `header > div` 직계 구조 불변(헤더 테스트), 스크롤 힌트 `pointer-events-none` |
| **P2** | 없음(P1과 독립) | P1과 병행 가능하나 **P3a·P3b보다 먼저** 완료 권장(치환 대상 파일 안정화) | `결제하기` link 계약 유지 + `booking-single-checkout-flow` 테스트 갱신(좌석 클릭 스텝)의 타당성, `seats` 파라미터 보존, checkout URL 200 유지, 금액 위·변조 방지 실검증, live region 컨테이너 상시 마운트 + `data-booking-expired` 조건부 속성 |
| **P3a** | 없음 | P1과 병행 가능 | Pretendard 실제 적용(파일 확보 여부), Button variant 정비가 기존 이름 삭제 없이 확장인지, "다시 예매하기" href 계약 |
| **P3b** | **P2·P3a 완료 후 착수**(치환 파일이 P2에서 바뀌고, Button 채택이 P3a에서 선행) | 파일군별로만 내부 병행 | 매핑 표 결정값 준수(무손실 우선/헤딩 유지), 시각 회귀 스크린샷 대조, 테스트 검증 클래스·텍스트 계약 불변 |
| **P4** | P2 완료 후(좌석 렌더 분기 확정 위) | P3b와 부분 병행 가능(seat-map 충돌 주의) | 터치타깃 32/36px 트레이드오프 수용, 2단 선택 설계 문서 타당성, 데드코드 삭제가 사용 중 프리미티브를 건드리지 않는지 |
| **P5** | P3b 완료 후(`bg-white`·시맨틱 토큰 정합) | 단독 | `.dark` 삭제가 라이트값 손실 없는지, next/image 전환 후 포스터 테스트 그린, LCP `priority`, 원격 도메인 config |
| **P6(다크모드)** | **P3b 완료 필수**(시맨틱 토큰 사용이 끝나야 다크 값 추가가 안전) | P4·P5와 무관, 단독 진행 가능 | FOUC 없는지, 시스템 감지·수동 토글 우선순위 로직, 좌석 등급색·`bg-ink`+`text-white` 조합 다크 대비, tint 토큰(`color-mix(...white)`) 처리, 시각 회귀(라이트 쪽에 영향 없어야 함) |

**권장 실행 순서(원래 계획):** P1·P3a(병행) → P2 → P3b → P4 → P5.
**2026-07-04 갱신(§8 진행 현황 반영):** P1·P2·P4 완료 확인됨. 잔여 순서는 **P3b → P6(다크모드)**, P3a 마무리(Pretendard 폰트 확보 후)·P5 잔여 2건(§8-5)은 P6과 무관하므로 병행 가능. 상세 스펙은 §9 참조.
**2026-07-05 갱신(§10 진행 현황 반영):** P3b는 hex 210→146건, px 임의값 575→304건으로 크게 줄었으나 **완료 기준 미달**이며, 특히 `checkout-panel.tsx`·`reservation/[id]/page.tsx`·`mypage/page.tsx` 등 고위험 화면에 하드코딩이 다수 남아 있다. §9 P6 서문의 선행 조건("P3b가 먼저 끝나 있어야 한다")이 아직 충족되지 않았으므로 **P6(다크모드) 착수를 보류**하고, P3b 잔여분(§10-4 참조)부터 마저 정리한다. LCP `priority`/라이트 온리 주석/Pretendard 배선/커밋 분리 관행은 §10에서 완료 확인됨.
**2026-07-05 재갱신(§11 완료 확인):** 고위험 화면(checkout/reservation/mypage) 하드코딩이 모두 제거되고(hex 146→58, px 304→170, 잔존은 브랜드색·포스터 그라디언트·큐 대기실 다크 서페이스 등 정당한 예외) 시맨틱 토큰 채택이 정착된 것을 확인, **P3b는 P6 착수 조건을 충족한 것으로 판단한다. P6(다크모드, §9) 착수 지시를 전달해도 안전.** 단, §11-5에 정리된 대로 포스터/브랜드색은 다크에서도 반전 없이 유지하고, `queue-waiting-room.tsx`의 기존 하드코딩 다크 서페이스는 신규 다크 토큰과의 관계를 P6 착수 시 1차로 결정할 것.

**게이트 공통:** 각 Phase 종료 시 (1) `npm run lint && npm run typecheck` 그린, (2) 해당 Phase가 건드린 파일을 검증하는 개별 테스트 그린, (3) 390/768/1240 가로 오버플로 없음을 Claude가 확인한 뒤 다음 Phase 착수. **P3b·P5 게이트는 스크린샷 시각 회귀 대조를 필수**로 하고, **P5 종료 시 `npm test` 전량 1회**로 전체 회귀를 마감한다.

---

## 8. 1차 구현 검증 결과 및 후속 지시 (Sonnet 5, 2026-07-04)

> 검증 대상: main 브랜치 커밋 `9bff10b`("fix: polish auth booking and frontend surfaces") — §6 지시서(v3, 커밋 `7463dd7`) 이후 codex가 구현한 결과물. 검증 기준: (1) §6 지시서 준수 여부, (2) `사업계획서(260624).md` §2의 "대형 서비스처럼 보이는 UX" 목표 및 인터파크·티켓링크 등 메이저 예매 서비스 대비 완성도, (3) 자동 검증(lint/typecheck/build/test). 검증: Sonnet 5 1차 검증 → Fable advisor가 소스 대조 재검증(수정 4건 반영 완료).
>
> **커밋 구성에 대한 일반 지적**: §6은 Phase마다 커밋 분할을 지시했으나(P1 3커밋, P5 "1~2파일씩" 등) codex는 P1~P5 전체(42개 파일, +987/-509)와 계획 밖 인증 버그 수정을 **단일 커밋 `9bff10b`**로 제출했다. 개별 리뷰·부분 롤백이 어려우므로 다음 라운드부터는 Phase/성격별 커밋(또는 PR) 분리를 지시서에 재강조한다.

### 8-1. 자동 검증 결과

| 검사 | 결과 |
|---|---|
| `npm run lint` | 통과 (경고 0) |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 (137 라우트 정상 생성) |
| `npm test` (전체 88개 테스트, `--test-concurrency=1`) | **88 pass / 0 fail** |

### 8-2. Phase별 구현 이행 확인

| Phase | 이행 상태 | 확인 내용 |
|---|---|---|
| P1 모바일 내비게이션 | **완료(경미 편차)** | `use-session-auth.ts` 훅 추출, `mobile-nav.tsx` 신규(base-ui Dialog). **지시서(§6:163)는 좌측 슬라이드(`left-0`)를 지정했으나 구현은 우측 슬라이드·폭 360px(`mobile-nav.tsx:35` `right-0 w-[min(360px,...)]`)** — 기능·접근성 요건은 충족하나 지시와 다른 방향. 카테고리 스크롤 fade 오버레이 적용. `header-utility-label.test.mjs`에 드로어 테스트 **신규 2건 추가 + 기존 데스크톱 테스트 2건을 반대 방향으로 재작성**(발견 사항 참조), 전부 통과 |
| P2 예매 플로우 | **완료, 지시서 그대로 + 상회** | `checkoutHref`에서 `base/fee/total` 제거, 좌석 자동선택 제거(+`booking-single-checkout-flow.test.mjs`에 좌석 클릭 스텝 추가 반영됨), 좌석 UI 성공/실패 단일 분기, `결제하기` Link/button 조건부 렌더, `data-booking-expired` 조건부 속성 + 상시 aria-live 컨테이너, 60초 경고 배지. **checkout-panel.tsx는 지시서보다 한 단계 더 나아가 `getState()`로 실제 좌석 금액을 재조회해 "확인 중" 상태로 표시 후 검증되기 전엔 결제 버튼을 막는 방식으로 구현** — 금액 위·변조 방지 목표를 지시서보다 견고하게 달성 |
| P3a Pretendard + Button cva | **부분 완료(차단 처리 자체도 지시서 미이행)** | `Button`에 `dark` variant 추가(기존 variant 삭제 없음), `booking-panel.tsx`의 "좌석 선택으로 이동"/"다시 예매하기" 등에 채택 확인. **Pretendard Variable 폰트 파일은 여전히 미탑재** — 폰트 스택 1순위가 그대로 `"Pretendard Variable"`이고 실제로는 Noto Sans KR로 폴백 중. 지시서(§6)는 파일 부재 시 "next/font/local 배선 코드만 준비 + 파일 경로 TODO 기록"을 요구했는데 **배선도 TODO도 전혀 남기지 않아, 차단 시 행동 지시 자체가 미이행** 상태 |
| P3b 디자인 토큰 대량 치환 | **미착수, 부채 소폭 증가** | px 임의값 563→**575건(+12)**, hex 209건(동일) — 치환 미착수인 채로 이번 커밋의 신규 코드가 임의값을 추가로 얹었다. `checkout-panel.tsx`, `reservation/[id]/page.tsx`, `mypage` 계열은 여전히 hex 하드코딩과 `font-bold` 헤딩 체계를 유지 중 |
| P4 접근성 | **완료, 지시서 그대로** | `seat-map.tsx` 좌석 버튼 `size-8 sm:size-9`, 스크롤 힌트(그라데이션+안내 문구), `TicketgroundModal` 삭제, `docs/design/seat-selection-2step.md` 설계 문서 작성. `BackendSeatPicker`(실사용 경로)는 `min-h-11 sm:min-h-12`로 44px 이상 확보(지시서의 32/36px 절충안보다 더 나은 결과) |
| P5 다크모드 정리 + next/image | **대부분 완료(잔여 2건)** | `globals.css`의 `.dark` 블록/데드 토큰이 `theme-vars.css`로 분리·정리(다크 블록 완전 삭제 확인), raw `<img>` 8개 파일(`poster-card`, `time-deal`, `promo-row`, `ticketground-play`, `best-reviews`, `opening-soon`, `home-cards`, `show-card`) 전부 `next/image`로 전환, `.gif`는 `unoptimized` 처리 확인. **잔여**: (1) 히어로 LCP 이미지 `priority` 미지정(8-3 참조), (2) 지시서가 요구한 "라이트 온리 명시 주석"이 `globals.css`/`theme-vars.css`/`DESIGN.md` 어디에도 없음(grep 0건) |

### 8-3. 발견 사항

**[경미] 히어로 이미지에 `priority` 미지정 — LCP 최적화 목표 미완수**
`home-cards.tsx`의 `FeaturedCard`(size="large")가 `loading="eager"` + `fetchPriority="high"`만 수동 지정하고 Next.js의 `priority` prop은 사용하지 않음. 개발 서버 콘솔에 `Image ... was detected as the Largest Contentful Paint (LCP). Please add the loading="eager" property` 경고가 반복 출력됨 — `priority`만이 문서 `<head>`에 실제 preload 링크를 주입해 LCP를 앞당기므로, 수동 조합은 Next가 기대하는 최적화가 아님.
→ **후속 지시**: `FeaturedCard`의 `size === "large"` 이미지에 `priority` prop을 추가하고 `loading`/`fetchPriority` 수동 지정은 제거할 것.

**[지시 위반] 데스크톱 유틸바·빠른 메뉴에서 MY/예매내역 숨김 — §6이 명시적으로 금지한 마크업 변경**
비로그인 시 "MY"/"예매내역" 링크를 숨기는 동작은 **모바일 드로어에 한해서는 §6 P1 지시서(계획서:163 "미로그인 시 로그인/회원가입 링크 … MY(/mypage) 링크"의 로그인 조건부 노출) 그대로**이므로 문제가 없다. 그러나 **데스크톱 유틸바·빠른 메뉴는 §6 P1이 "데스크톱 유틸바 마크업/텍스트는 절대 바꾸지 말 것 — `header-utility-label.test.mjs`가 로그인/로그아웃 텍스트 전환을 검증하므로"라고 명시적으로 금지한 영역**인데, `site-header.tsx:81,94-99`에서 이를 변경했고, 이를 지키던 테스트 단언("로그아웃 후 MY link count = 1")을 반대 방향("= 0")으로 재작성했다. 즉 회귀 감지선을 지시 위반에 맞춰 바꾼 셈이다. UX 방향(비로그인 사용자에게 계정 전용 메뉴 비노출) 자체는 타당하나, **명시적 금지를 어긴 변경이므로 의도적 결정인지 확인이 필요**하다.
→ **후속 지시**: 데스크톱 쪽 변경을 유지할지 결정해 계획서 §5에 명문화(허용 범위 확장 기록) 또는 원복. 모바일 드로어 쪽은 지시 이행이므로 그대로 유지.

**[검토 필요] 인증(소셜 로그인) 버그 수정이 UI 계획과 한 커밋에 번들링됨**
`login-panel.tsx`/`login-mock-form.tsx`(신규)/`google-sign-in-card.tsx`의 소셜 로그인 상태 경합(race condition) 수정, `auth/google-config/route.ts` 신규 등은 UI 개선 계획(P1~P5)과 무관한 별도 버그 수정으로 보인다. 기능적으로는 테스트 통과로 안전이 확인되나, **계획 문서 기반 작업과 계획 밖 수정이 한 커밋(`9bff10b`)에 섞여 있어 개별 리뷰·롤백이 어렵다.**
→ **후속 지시**: 향후에는 계획 문서 기반 변경과 별도 이슈(버그 수정)를 분리된 커밋/PR로 요청.

**[정보] 프리뷰 도구의 클릭 이벤트 신뢰성 이슈(앱 결함 아님)**
검증 중 `preview_click`으로 햄버거 트리거·예매 단계 탭을 클릭했을 때 간헐적으로 첫 클릭이 반영되지 않는 현상을 관찰함. 그러나 동일 요소를 `element.click()`(DOM 직접 호출)로 호출하면 즉시 반영되었고, Playwright 기반 자동화 테스트(`mobile drawer ...` 등)는 모두 통과했으므로 **이는 앱의 결함이 아니라 이번 검증에 사용한 프리뷰 도구의 합성 클릭 타이밍 이슈**로 판단한다. 코드 변경 불필요.

### 8-4. "메이저 사이트처럼" 목표 대비 종합 평가

`사업계획서(260624).md` §2가 요구하는 "대형 서비스처럼 보이는 UX"(검색·카테고리 탐색·상세 탭·좌석도 팝업·고객센터를 갖춘 완성형 예매 화면) 관점에서:

- **구조적 완성도**: 히어로 배너 + 실시간 랭킹 + 티켓오픈 예정 섹션 구성, 카테고리 내비게이션, 좌석도, 예매 단계 UI 등 정보구조는 인터파크·티켓링크류 서비스와 동등한 수준에 도달했다. 모바일 햄버거 드로어(P1)와 예매 금액 위·변조 방지(P2)는 오히려 메이저 서비스보다 안전한 구조다.
- **가장 큰 잔여 격차는 P3b(디자인 토큰 통일)다.** hex 209건·px 임의값 575건이 그대로 남아 있어 checkout/mypage/reservation 계열(`font-bold`+hex)과 booking/홈 계열(`font-black`+시맨틱 토큰)의 두 디자인 언어가 여전히 공존한다. "메이저 사이트처럼 보이는" 인상은 정보구조보다 이런 디테일(타이포 위계 일관성, 색상 통일)에서 갈리므로, **다음 구현 우선순위는 P3b**로 판단한다.
- Pretendard 미탑재도 마이너하지만 체감 브랜드 품질에 영향을 준다 — 폰트 파일 확보(라이선스 포함) 후 P3a를 마무리할 것을 권고.

### 8-5. 다음 착수 우선순위 (갱신)

1. **P3b** — §6의 매핑 표를 그대로 사용해 대량 치환 착수(파일군별 커밋 분할, 스크린샷 시각 회귀 대조 필수).
2. FeaturedCard 히어로 이미지 `priority` prop 추가 + `globals.css`/`DESIGN.md`에 라이트 온리 명시 주석 추가(둘 다 경미하지만 즉시 수정 가능, P5 잔여 마무리).
3. 데스크톱 유틸바 MY/예매내역 숨김 결정 확정 및 계획서 반영, 또는 원복(모바일 드로어 쪽은 지시 이행이므로 유지).
4. Pretendard 폰트 파일 확보 후 P3a 마무리(배선 코드 + TODO 기록부터).
5. Phase/성격별 커밋 분리 관행 정착(§6 커밋 분할 지시 재확인) — 인증 버그 수정은 별도 커밋·이슈로 분리.

---

## 9. P6 — 다크모드 도입 (P3b 완료 후 착수)

> §5에서 "전면적인 다크모드 신규 구현"을 Out of Scope로 뒀던 것을 사용자 요청으로 철회하고 정식 Phase(P6)로 편입한다. **선행 조건: P3b(디자인 토큰 대량 치환)가 먼저 끝나 있어야 한다.** 지금 hex 209건이 컴포넌트에 하드코딩된 상태에서 다크 토큰을 얹으면 그 하드코딩된 값을 라이트/다크 두 번 손보게 되어 작업량이 배가된다. P3b로 시맨틱 토큰 사용이 끝난 뒤에 `.dark`에 값만 얹으면 됨.
>
> 전환 방식: **시스템 설정(`prefers-color-scheme`)을 기본값으로 따르되, 사용자가 수동 토글로 덮어쓸 수 있어야 한다.** 토글 선택은 `localStorage`에 저장해 재방문 시 유지한다.

### 9-1. 토글 아키텍처

- **저장 키**: `localStorage["ticketground:theme"]` — 값은 `"light" | "dark" | "system"`(기본값 `"system"`).
- **FOUC 방지**: 현재 `src/app/layout.tsx`는 App Router의 metadata API를 쓰고 있어 `<head>` JSX를 직접 작성하지 않는다(App Router는 레이아웃에서 `<head>` 태그 작성을 지원하지 않음). 대신 **`<body>` 최상단(children보다 먼저)**에 일반 인라인 `<script dangerouslySetInnerHTML={...}>`를 배치한다(next-themes와 동일한 패턴 — 이 시점에 `document.documentElement`는 이미 존재하므로 첫 페인트 전에 동기적으로 `.dark` 부여 가능). 페이지 렌더 전에 `localStorage` 값(또는 `system`이면 `window.matchMedia("(prefers-color-scheme: dark)")`)을 읽어 `<html>`에 `.dark` 클래스를 동기적으로 부여한다. 서버가 모르는 클래스가 클라이언트에서 붙으므로 `<html>`에 `suppressHydrationWarning` 필수. 같은 파일의 `<body className="... bg-white">` 하드코딩도 다크모드 최상위 배경이므로 `bg-background`로 치환됐는지 P6 체크리스트에서 재확인할 것(P3b 치환 범위와 겹침).
- **`globals.css`**: P5에서 제거한 `@custom-variant dark (&:is(.dark *));`를 다시 추가한다(클래스 기반 다크 variant — Tailwind v4 문법 유지).
- **신규 `src/lib/use-theme.ts`**: `{ theme: "light" | "dark" | "system"; resolvedTheme: "light" | "dark"; setTheme: (t) => void }`를 반환하는 훅. `setTheme`은 `localStorage` 갱신 + `document.documentElement.classList` 토글 + `system` 선택 시 `matchMedia` 리스너 등록/해제.
- **신규 `src/components/theme-toggle.tsx`**: 라이트/다크/시스템 3단 토글 또는 라이트↔다크 2단 토글(시스템은 최초 진입 시 자동 적용, 토글은 라이트/다크 명시적 전환용) 중 **2단 토글(라이트⇄다크, 아이콘 버튼)을 권장** — UI가 단순하고 "메이저 사이트"들의 일반적인 패턴과 일치. 최초 진입 시 `system` 값에 따라 자동으로 라이트/다크가 정해지고, 사용자가 토글을 누르면 그 순간부터 `system`이 아닌 명시적 값으로 `localStorage`에 고정된다.
- **배치 위치**: 데스크톱 헤더 유틸바(고객센터 옆) + 모바일 드로어 상단 계정 영역 근처. `site-header.tsx`와 `mobile-nav.tsx` 양쪽에 `ThemeToggle` 삽입.

### 9-2. 다크 토큰 정의 (`theme-vars.css`에 `.dark { … }` 블록 추가)

현재 라이트 토큰과 대응하는 다크 값 초안(시각 검증 후 조정 가능):

| 토큰 | 라이트 | 다크(안) | 비고 |
|---|---|---|---|
| `--ink` | `#1a1a1d` | `#f5f5f6` | 본문 텍스트 |
| `--ink-2` | `#29292d` | `#e4e4e6` | 보조 강조 텍스트 |
| `--ink-3` | `#6b6b70` | `#a3a3a8` | 캡션/보조 텍스트 |
| `--ink-4` | `#999999` | `#7a7a80` | 비활성/placeholder |
| `--line` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.12)` | 약한 경계선 |
| `--line-strong` | `rgba(0,0,0,.16)` | `rgba(255,255,255,.22)` | 진한 경계선 |
| `--bg` | `#ffffff` | `#121214` | 페이지 배경 |
| `--bg-2` | `#f7f7f8` | `#1c1c1f` | surface(카드/섹션 배경) |
| `--bg-3` | `#f3f3f3` | `#232327` | surface-2 |
| `--bg-4` | `#ebebed` | `#2b2b30` | surface-3(비활성 면) |
| `--link` | `#1a47ff` | `#5b7dff` | 다크 배경 대비 위해 밝게 |
| `--accent`(ticketground) | `#ff2d3f` | `#ff5a68` | 브랜드 레드, 다크에서 살짝 밝게(대비 확보) |
| `--accent-2` | `#ffe92e` | `#ffe14a` | 강조 옐로 |
| `--ok` | `#1f8a5b` | `#3fb37e` | |
| `--warn` | `#c47a00` | `#e0994a` | |
| `--tier-r/s/a/b` | 기존 값 | 채도·명도 유지, 다크 배경 위 대비만 확보(각 값에 밝기 +10~15% 조정) | 좌석 등급색은 브랜드 식별성이 중요하므로 색상 자체(hue)는 바꾸지 말 것 |
| `--tier-vip` | `#1a1a1d`(무채색 거의 검정) | **예외 처리 필요** — 단순 밝기 조정(+10~15% → `#2e2e33`)으로는 제안된 다크 배경(`#121214`~`#232327`)과 구분 안 됨. 밝은 회백/골드 계열 배경 + `text-black` 전환, 또는 어두운 면 유지 + `--line-strong` 테두리 강조 중 택해 시각 검증 | `seat-map.tsx` 좌석 버튼(`bg-tier-vip`)과 범례 스와치가 배경에 묻히는 것을 방지 |
| `--shadow-1/2/3` | `rgba(0,0,0,…)` | 다크에서는 그림자보다 `--line`/`--line-strong` 테두리가 더 잘 보이므로, 그림자 알파값을 낮추거나(`rgba(0,0,0,.4)` 등) 대신 테두리 강조 병행 | |

`shadcn` 계열 변수(`--background`, `--card`, `--primary` 등)는 모두 위 원시 토큰을 참조하므로 `.dark` 블록에서 원시 토큰만 재정의하면 대부분 전파된다. **단, 예외가 있다: `globals.css`의 `--color-tint-blue/red/yellow`는 `color-mix(in srgb, var(--link) 8%, white)`처럼 리터럴 `white`와 혼합하므로 다크에서 그대로 밝게 남아 어두운 화면에 흰 패널이 뜬다.** `white`를 `var(--bg)`로 바꾸고 혼합 비율을 다크 기준으로 재조정할 것 — 사용처(`poster-card.tsx`, `booking-panel.tsx`, `show-tile.tsx`, `open-calendar.tsx`, `resale-sell-panel.tsx`, `reservation-history-search.tsx`, `inquiry-thread-surface.tsx` 등 10여 파일)를 시각 대조에 포함한다.

### 9-3. 구현 시 주의

- **포스터/공연 이미지**: 사진 콘텐츠이므로 다크모드에서 색 반전 등 처리 하지 말 것. 카드 배경(`bg-surface` 등 프레임)만 다크 대응.
- **`bg-ink`/`bg-tier-*` + `text-white` 하드코딩 조합 전체가 위험**: 실사용 좌석 선택 경로인 `backend-seat-picker.tsx:34`가 선택 상태를 `border-ink bg-ink text-white`로 표현하는데, 다크에서 `--ink`가 밝은 값(`#f5f5f6`)으로 뒤집히면 흰 텍스트가 거의 흰 배경 위에 놓여 선택 좌석 라벨이 사라진다. 같은 패턴이 `booking-panel.tsx`(7건), `queue-waiting-room.tsx`(10건) 등 ticketing 컴포넌트 전반에 약 40건 존재 — `grep "text-white"`로 전수 점검해 `text-white`를 `text-primary-foreground`(또는 신설 `text-on-ink`) 같은 시맨틱으로 치환할 것. 좌석 등급 색(tier) 텍스트도 동일 기준(WCAG AA 대비 4.5:1 이상)으로 확인.
- **checkout 라디오 accent(`accent-[#4154ff]`/`accent-link` 등, P3b에서 토큰화 예정)**: 다크에서도 시맨틱 토큰(`--link`)을 참조하도록 이미 P3b에서 정리됐어야 함 — 이 부분이 안 됐다면 P6 착수 전 먼저 P3b 완료를 재확인.
- **QueueWaitingRoom/타이머 등 애니메이션 컴포넌트**: 하드코딩 배경색이 남아있지 않은지(P3b 완료 여부와 연동) 재확인.
- **접근성**: 토글 버튼에 `aria-label`("다크 모드로 전환"/"라이트 모드로 전환" 동적 텍스트), `aria-pressed` 또는 `role="switch"` + `aria-checked` 사용.

### 9-4. 완료 기준(DoD)

- `npm run lint && npm run typecheck && npm test` 통과.
- 시스템이 다크로 설정된 브라우저에서 첫 방문 시 자동으로 다크 테마 적용 확인(FOUC 없음 — 첫 페인트부터 다크).
- 토글 클릭 시 즉시 전환되고 새로고침·재방문 후에도 선택이 유지됨.
- 주요 페이지(홈, booking, checkout, mypage, reservation) 라이트/다크 각각 390/768/1240px 스크린샷 대조 — 텍스트 대비, 좌석 등급색 식별성, 포스터 카드 프레임 확인.
- 데스크톱 헤더·모바일 드로어 양쪽에 토글 노출 확인.

### 9-5. Phase 의존성 갱신

§7 표에 아래 행을 추가한다:

| Phase | 선행 의존 | 병행 가능 | 게이트에서의 Claude 리뷰 포인트 |
|---|---|---|---|
| **P6(다크모드)** | **P3b 완료 필수**(시맨틱 토큰 사용이 끝나야 다크 값 추가가 안전) | P4·P5와 무관, 단독 진행 가능 | FOUC 없는지, 시스템 감지·수동 토글 우선순위 로직, 좌석 등급색 다크 대비, 시각 회귀(라이트 쪽에 영향 없어야 함) |

**갱신된 권장 실행 순서(§8 현황 반영, 잔여 작업 기준):** P1·P2·P4는 §8에서 완료 확인됨. 남은 순서는 **P3b → P6(다크모드)**이며, P3a 마무리(Pretendard 폰트 파일 확보 후)와 P5 잔여 2건(§8-5 참조)은 P6과 무관하므로 병행 가능.

---

## 10. 2차 구현 검증 결과 (P3b + P5 잔여 정리, Sonnet 5, 2026-07-05)

> 검증 대상: main 브랜치 커밋 `e0dfc83`("test: verify social auth and image policy in rendered app") — §8-5 후속 지시(P3b 대량 치환, LCP `priority`, 라이트 온리 주석, Pretendard TODO, 커밋 분리 관행)에 대한 codex 구현 결과. 기준 커밋 `b7501f1` 이후 11개 커밋, 56개 파일 변경. 검증: Sonnet 5 1차 검증(자동 검사 + 소스 대조) → Fable advisor 재검증.

### 10-1. 자동 검증 결과

| 검사 | 결과 |
|---|---|
| `npm run lint` | 통과 (경고 0) |
| `npm run typecheck` | 통과 |
| `npm run build` | 통과 |
| `npm test` (전체 89개 테스트, `--test-concurrency=1`) | **89 pass / 0 fail** |

### 10-2. §8-5 후속 지시 이행 확인

| 항목 | 상태 | 확인 내용 |
|---|---|---|
| ① P3b 대량 치환 | **부분 완료 — P6 착수 조건 미충족** | hex 하드코딩 210건(§8 측정치 209건과 근사)→**146건**, px 임의값 575건→**304건**로 유의미하게 감소했으나 소거되지 않았다. 특히 고위험 화면인 `checkout-panel.tsx`(hex 19건, px 15건)·`reservation/[id]/page.tsx`(hex 13건, px 15건)·`mypage/page.tsx`(hex 9건, px 10건)는 해당 커밋(`cd7f644`, `1868d34`)에서 손을 대고도 대부분의 하드코딩 값이 그대로 남아 있다(`checkout-panel.tsx`는 `text-[#666]`, `bg-[#f8f8f8]`, `border-[#ddd]`, `text-[#7e7e81]` 등 다수 잔존). §9 P6 서문은 "P3b가 먼저 끝나 있어야 한다"를 다크모드 착수의 선행 조건으로 명시하므로, **현재 상태로 P6(다크모드) 지시를 보내면 안 된다.** |
| ② LCP `priority` 수정 | **완료(더 나은 방식으로 대체)** | `home-cards.tsx`의 `FeaturedCard`에 `loading`/`fetchPriority` 수동 지정을 제거하고 `preload={size === "large"}`로 교체(`9924317`). `next@16.2.1`은 `priority`가 deprecated, `preload`가 대체 API임을 타입 정의(`node_modules/next/dist/client/image-component.d.ts`)로 확인 — §8 지적보다 더 정확한 해결. 신규 테스트 `tests/next-dev-warning-sources.test.mjs`가 preload 링크 존재·수동 loading/fetchPriority 부재를 검증. |
| ③ 라이트 온리 명시 주석 | **완료** | `globals.css` 최상단 및 `DESIGN.md`에 "Light-only policy" 주석 추가(`8830e2c`). |
| ④ MY/예매내역 데스크톱 숨김 결정 | **완료** | §5에 "§6 P1 수용 편차" 항목으로 이미 명문화되어 있음(보안 요구상 숨김 유지 결정 확정). |
| ⑤ Pretendard 폰트 배선 | **완료(파일 부재 시 대응 그대로)** | 폰트 파일은 여전히 없으나, `layout.tsx`에 `next/font/local` 활성화 위치를 가리키는 TODO 주석, `DESIGN.md`에 필요한 파일 경로(`src/app/fonts/PretendardVariable.woff2`)와 활성화 방법 명시, `globals.css`의 `--font-sans`가 `var(--font-pretendard, var(--font-noto))`로 즉시 대체 가능한 형태로 배선됨. |
| ⑥ 커밋 분리 관행 | **완료, 크게 개선** | 이번 라운드는 파일군별(`shell`, `home`, `ticketing`, `mypage`)·목적별(폰트 정책 문서화, LCP 수정, 시각 QA 버그 수정, 테스트 추가)로 11개 커밋으로 분리되어 제출됨 — §8에서 지적한 "단일 커밋 번들링" 문제가 해소됨. |

### 10-3. 발견 사항

**[중요] P3b 미완료 상태에서 P6(다크모드) 착수 시 위험 — 착수 보류 권고**
hex 146건·px 304건이 남아 있고, 특히 결제 관련 `checkout-panel.tsx`처럼 실제 금액이 오가는 고위험 화면이 여전히 하드코딩 색상 위주다. §9 P6 서문이 이미 경고한 대로, 하드코딩이 남은 상태에서 `.dark` 토큰을 얹으면 나머지 값들을 라이트/다크 두 번 손봐야 하는 부채가 그대로 발생한다. **다크모드(§9/P6) 지시는 지금 보내지 말고, P3b 잔여분(특히 `checkout-panel.tsx`·`reservation/[id]/page.tsx`·`mypage/page.tsx`·`home-sections.tsx`·`queue-waiting-room.tsx` — 남은 건수 상위 파일)부터 마저 정리하도록 후속 지시가 필요하다.**

**[정보] §5의 "§8 부재" 기록은 현재 문서 상태와 불일치 — 정리 필요**
`8830e2c` 커밋에서 §5에 추가된 "**§8 부재:** 현재 `main` 문서에는 `## 8` 섹션이 존재하지 않아…" 문구는 codex가 그 시점에 §8·§9가 반영되기 전의 로컬 사본으로 작업하며 남긴 것으로 보인다. 현재 `UI-개선-계획서.md`에는 §8(1차 검증)·§9(P6 다크모드)가 이미 존재하므로 이 문구는 사실과 어긋난다. 이번 갱신에서 제거한다.

**[정보] 시각 회귀 스크린샷 대조 증적 없음**
§3 Phase별 완료 기준은 "P3b/P5: 주요 페이지 스크린샷 대조로 의도치 않은 시각 회귀 없음 확인"을 요구한다. codex 보고에 따르면 `.qa`(로컬 QA 증거)는 Git에 커밋하지 않았다고 하므로 저장소 상에서 이 기준 충족 여부를 직접 확인할 수 없다. 자동 테스트(89개)와 lint/typecheck/build가 모두 통과했고 `716f1a3`("fix(ui): resolve visual qa layout blockers")가 시각 QA 발견 사항을 반영한 정황은 있으나, 스크린샷 자체는 검증 범위 밖이었다.

### 10-4. 다음 착수 우선순위 (갱신)

1. **P3b 잔여 정리** — 남은 건수 상위 파일(`checkout-panel.tsx`, `reservation/[id]/page.tsx`, `mypage/page.tsx`, `home-sections.tsx`, `queue-waiting-room.tsx`, `account-summary-panel.tsx` 등)부터 §6 매핑 표 기준으로 마저 치환. hex/px 임의값 잔여 건수를 재계측해 0에 가깝게 수렴시킨다.
2. P3b 완료 확인 후에만 **P6(다크모드, §9)** 착수 지시를 전달한다.
3. Pretendard 폰트 파일 확보는 여전히 별도 트랙(라이선스 확보 필요)으로 P3a를 마무리한다.

---

## 11. P3b 완료 검증 (Sonnet 5, 2026-07-05)

> 검증 대상: codex 로컬 브랜치 `codex/ui-plan-main`의 8개 커밋("P3b 잔여 정리" 지시에 대한 후속 구현). 작업 기준점은 `e0dfc83`였으나 검증 시점에 `origin/main`이 이미 `28aff58`(§10 문서 커밋)로 갱신되어 있어, **충돌 없이 `28aff58` 위로 rebase 후 재검증**했다(rebase로 커밋 해시가 재작성되어 push 시점의 최종 해시는 `231a8a4`~`71c00d2`). 검증: Sonnet 5 1차 검증(자동 검사 + 소스 대조) → Fable advisor 재검증.

### 11-1. 자동 검증 결과 (rebase 후 재실행)

| 검사 | 결과 |
|---|---|
| `npm run lint` | 통과 (경고 0) |
| `npm run typecheck` | 통과 |
| `npm test` (전체 89개 테스트, `--test-concurrency=1`, build 포함) | **89 pass / 0 fail** |

### 11-2. §10-4 지시 이행 확인

| 항목 | 상태 | 확인 내용 |
|---|---|---|
| 고위험 파일 치환 | **완료** | `checkout-panel.tsx`(hex 19→0), `reservation/[id]/page.tsx`, `mypage/page.tsx`(hex 9→0), `home-sections.tsx`, `queue-waiting-room.tsx`, `account-summary-panel.tsx` 모두 hex/px 상위 목록에서 제외됨. 치환 방식도 매핑 표 그대로: `border-[#eee]`→`border-line`, `bg-[#f8f8f8]`→`bg-surface`, `text-[#666]/[#7e7e81]/[#777]`→`text-ink-3`, `rounded-[10px]`→`rounded-md`, `accent-[#4154ff]`→`accent-link`, `bg-[#eef0ff]`→`bg-tint-blue`, `font-bold` 헤딩→`font-black`(타이포 위계 가이드 반영) 확인. |
| 전체 잔여 건수 | **hex 146→58, px 304→170** | `src/app/theme-vars.css` 자체의 토큰 정의 18건은 정당한 잔존(원시 토큰 자체가 hex 값을 가져야 함). tsx 내 잔존 hex 40건은 poster-card.tsx(22, 포스터 그라디언트), social-login-buttons.tsx(6, 카카오/네이버 공식 브랜드 hex), review-cta.tsx(5), queue-waiting-room.tsx(3, 다크 서페이스), time-deal.tsx(2) 등 소수 파일에 집중. |
| `bg-white` 정확 일치 | **0건** | `grep -n 'bg-white' src --include='*.tsx' | grep -v 'bg-white/'` 결과 0 — P3b 지시 ③ 완전 이행. |
| 커밋 분리 | **양호** | 파일군별 8커밋(`ticketing`×2, `mypage`, `home`×2, `shared`, `content pages`, `final exact tokens`, `white surface tokens`)으로 분리 제출. |

### 11-3. 잔존 예외 항목 타당성 검토

codex가 "예외로 유지" 사유로 제시한 4가지 카테고리를 소스 대조로 확인:

- **포스터/브랜드 고유색**(`poster-card.tsx` 그라디언트, `social-login-buttons.tsx`의 `#FEE500`/`#03C75A` 카카오·네이버 공식색): 시맨틱 토큰화 대상이 아님이 타당. 유지 적절.
- **큐 대기실 다크 서페이스**(`queue-waiting-room.tsx` 잔존 3건 — 실제로는 다크 배경 `#08090d` 1건 + 그 위에 얹히는 대비용 라이트 핑크 텍스트 `#ffb8bf` 2건): 실제로 그 컴포넌트만 어두운 배경을 쓰는 특수 UI(대기 시뮬레이션)로, 라이트 테마의 시맨틱 토큰을 그대로 못 쓰는 맥락은 이해되나, **§9 P6(다크모드) 관점에서는 이 파일이 이미 하드코딩된 "다크" 배경+대비색 조합을 쓰고 있다는 뜻이라 오히려 다크모드 도입 시 이 컴포넌트를 어떻게 다룰지(그대로 둘지, 신규 다크 토큰에 흡수시킬지) 별도 결정이 필요**하다.
- **반투명 화이트 오버레이**: 코드베이스 전반에서 `white/NN` 형태(임의 hex 아님, Tailwind opacity 문법)로 쓰이는 경우가 대부분이라 애초에 이번 hex/px 정규식 집계 대상이 아니었을 가능성이 높음 — 실질적으로는 위 3개 카테고리(포스터·브랜드·큐)가 잔존의 대부분을 차지.
- **고정 레이아웃 수치**(`goods/[slug]/page.tsx` 13건, `virtual-ticket-card.tsx` 9건 등 px 잔존 상위): 티켓 카드 비율, 캐러셀 폭 등 디자인상 고정 크기가 의도된 값으로 보이며 무리하게 스케일 토큰화할 이유가 약함. 유지 적절.

### 11-4. P6(다크모드) 착수 가능 여부 판단

§9 P6 서문의 선행 조건("P3b가 먼저 끝나 있어야 한다")은 **hex/px를 0으로 만드는 것이 아니라, 시맨틱 토큰 사용이 충분히 정착되어 다크 값 추가 시 이중 작업이 발생하지 않는 상태**를 의미한다. 이번 라운드로:
- 결제·예매내역 등 고위험/고트래픽 화면의 하드코딩이 제거됨
- `accent-link`, `bg-tint-blue` 등 다크모드 전환 시 자동 반영되어야 할 토큰으로 이미 교체됨(§9-2에서 지적한 tint 토큰 이슈도 이제 원시 토큰 재정의만으로 전파 가능)
- 잔존 항목은 애초에 다크/라이트 구분이 무의미하거나(브랜드색), 다크모드 설계 시 별도 정책이 필요함이 이미 §9에 반영된 항목(큐 대기실)

**따라서 P3b는 P6 착수 조건을 충족한 것으로 판단하며, §9(P6 다크모드) 지시를 codex에 전달해도 안전하다.**

### 11-5. codex 제안 반영 — P6 착수 전 추가 확인 필요 사항

codex가 스스로 제안한 대로, §9에 아래 내용을 명시적으로 추가한다:
- **포스터 그라디언트/브랜드 로그인 버튼색**: 다크모드에서도 색 반전 없이 그대로 유지(사진과 동일하게 컨텐츠/브랜드 아이덴티티 성격).
- **`queue-waiting-room.tsx`의 기존 하드코딩 다크 서페이스**: 신규 `.dark` 토큰으로 흡수할지, 라이트/다크 무관하게 그대로 둘지 P6 착수 시 1차 결정 필요(현재는 라이트 테마에서만 노출되는 특수 배경이므로, 신규 다크 테마 배경과 시각적으로 겹치지 않는지 확인).
