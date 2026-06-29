# Ticketground — Technical Specification (SPEC)

> `PRD.md`의 요구사항을 **정확한 구현 수치**로 옮긴 문서. Codex는 이 명세의 토큰·구조·인터랙션을 그대로 따른다.
> 임의 색·폰트·간격을 새로 발명하지 말 것. 모든 값은 토큰 변수로만 사용.

---

## 1. 기술 스택 / 제약

- **순수 정적 파일**: HTML5 + CSS(커스텀 프로퍼티) + 바닐라 JS. 번들러·프레임워크·빌드 스텝 없음.
- 외부 의존성 화이트리스트:
  - Pretendard Variable 웹폰트: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css`
  - **Tweaks 패널 한정** React 18.3.1 + ReactDOM + Babel standalone 7.29.0 (핀 버전 + integrity). 다른 화면엔 React 사용 금지.
- 파일은 더블클릭(file://)으로 열려야 하며 콘솔 에러 0.
- 뷰포트: `<meta name="viewport" content="width=1280">` (데스크톱 고정).
- HTML 규범: 모든 비-void 요소 명시적 종료, 속성 더블쿼트, UI 그룹은 `display:flex/grid` + `gap`(인라인 플로우 금지).
- 각 화면 루트에 `data-screen-label="<번호> <이름>"` 부여.

---

## 2. 파일 구조

```
/
├─ index.html  category.html  detail.html  booking.html  confirm.html
├─ mypage.html  search.html  login.html  queue.html  cancel.html
├─ open.html  event.html  venue.html  artist.html  help.html
├─ watchlist.html  resale.html  transfer.html  inquiry.html
├─ tweaks-panel.jsx
└─ assets/
   ├─ tokens.css   (디자인 토큰)
   └─ app.css      (사용자 페이지 공용)
```

- 사용자 페이지는 `<link rel="stylesheet" href="assets/app.css">` (app.css가 tokens.css와 폰트를 `@import`).
- 현재 Next.js public frontend에는 관리자 페이지를 포함하지 않는다. 관리자 기능은 50084 포트의 backend API로만 유지한다.

---

## 3. 디자인 토큰 (`assets/tokens.css`) — 정확값

### 3.1 타이포그래피
| 변수 | 값 | 변수 | 값 |
| --- | --- | --- | --- |
| `--font-sans` | Pretendard Variable, … | `--fs-xs` | 12px |
| `--font-display` | Pretendard Variable | `--fs-sm` | 13px |
| `--font-mono` | ui-monospace, … | `--fs-md` | **15px (본문)** |
| `--fs-lg` | 16px | `--fs-xl` | 18px |
| `--fs-2xl` | 20px | `--fs-3xl` | 23px |
| `--fs-4xl` | 28px | `--fs-5xl` | 37px |
| `--fs-6xl` | 50px | `--fs-7xl` | 72px |

- line-height: `--lh-tight 1.15` / `--lh-snug 1.3` / `--lh-base 1.5` / `--lh-loose 1.7`
- weight: regular 400 / medium 500 / semibold 600 / bold 700 / **black 800**
- 본문 ≥ 13px 절대 준수(접근성). 슬라이드/포스터 캡션도 12px 미만 금지.

### 3.2 컬러
| 그룹 | 변수 = 값 |
| --- | --- |
| 잉크 | `--ink #1a1a1d` · `--ink-2 #29292d` · `--ink-3 #6b6b70` · `--ink-4 #999999` |
| 라인 | `--line rgba(0,0,0,.08)` · `--line-strong rgba(0,0,0,.16)` |
| 배경 | `--bg #fff` · `--bg-2 #f7f7f8` · `--bg-3 #f3f3f3` · `--bg-4 #ebebed` |
| 강조 | `--link #1a47ff` · `--accent #ff2d3f`(sale/urgent) · `--accent-2 #ffe92e`(highlight/티켓) · `--ok #1f8a5b` · `--warn #c47a00` |
| 좌석 티어 | VIP `#1a1a1d` · R `#c2410c` · S `#1a47ff` · A `#1f8a5b` · B `#6b6b70` |

### 3.3 스페이싱 (4px 베이스 변형)
`--s-1 2` `--s-2 4` `--s-3 6` `--s-4 8` `--s-5 12` `--s-6 16` `--s-7 20` `--s-8 24` `--s-9 32` `--s-10 48` `--s-11 64` `--s-12 96` (px)

### 3.4 라디우스 / 섀도 / 레이아웃
- radius: `--r-xs 4` `--r-sm 8` `--r-md 11` `--r-lg 12` `--r-xl 20` `--r-2xl 32` `--r-pill 100` (px)
- shadow: `--shadow-1 rgba(0,0,0,.08) 0 1px 3px 0` / `--shadow-2 rgba(0,0,0,.13) 0 0 8px 0` / `--shadow-3 rgba(0,0,0,.16) 0 8px 24px -4px, rgba(0,0,0,.06) 0 2px 6px 0`
- layout: `--max-w 1240px` · `--header-h 64px` · `--catnav-h 48px`

---

## 4. 공용 컴포넌트 (`assets/app.css`)

| 클래스 | 정의 |
| --- | --- |
| `.shell` | `max-width:1240px; margin:0 auto; padding:0 20px` — 모든 콘텐츠 래퍼 |
| `.utility` | 상단 유틸바(우정렬, 32px, 11px 회색, 고객센터/마이/로그인/회원가입) |
| `.gheader` | sticky top:0, 64px. `.brand`(워드마크+`.dot` 빨강 점) + `.gsearch`(pill 검색) + `.gnav-icons`(관심공연/예매내역/마이) |
| `.catnav` | sticky top:64px, 48px. 홈·콘서트·뮤지컬·연극·클래식·전시·아동·스포츠 + 우측 "티켓오픈 캘린더"(빨강) |
| `.gfooter` | 4컬럼 그리드(브랜드/예매/마이/고객센터) + copyright 줄. public footer에는 관리자 진입 링크를 노출하지 않는다. |
| `.btn` | 높이 40, radius 8, semibold. 변형: `-primary`(ink/white) `-accent`(red) `-outline` `-ghost` `-lg`(52) `-block` |
| `.chip` | pill 보더 토글. `.active` = ink 배경 white |
| `.tag` | 10px bold 라벨. `-open`(red) `-soon`(ink) `-sale`(yellow) `-new`(green) |
| `.section` / `.section-head` | 섹션 상단 패딩 + 타이틀(`h2` 28px black)·`small` 서브·`.more` 우측 링크 |
| `.poster` | `aspect-ratio:3/4`, radius 8, 하단 그라데이션 오버레이. `.ptitle`(공연명 타이포) `.psub` `.pmeta`. **그라데이션 변형 `.g1`~`.g12`** 정의(아래 5.1) |
| `.pcard` | 포스터+태그+제목(`h3`)+정보(`.pinfo`). hover 시 포스터 살짝 상승·제목 밑줄 |

### 4.1 포스터 그라데이션 `.g1`~`.g12` (정확값)
- `.g1` `linear-gradient(135deg,#ff2d3f,#ff6a3d 50%,#ffce4a)`
- `.g2` `linear-gradient(160deg,#0a0a1a,#1a47ff 70%,#6ec3ff)`
- `.g3` `linear-gradient(135deg,#2b0a4a,#ff2d8e)`
- `.g4` `linear-gradient(135deg,#0d3b2e,#1f8a5b 60%,#f0e6c2)` (글자색 #0d2418)
- `.g5` `linear-gradient(135deg,#1a1a1d,#29292d 60%,#ffe92e)` (글자 #1a1a1d)
- `.g6` `linear-gradient(135deg,#6a1b9a,#d81b60)`
- `.g7` `linear-gradient(160deg,#ff6a3d,#ffce4a)` (글자 #2b1100)
- `.g8` `linear-gradient(135deg,#0a1a3f,#4a2a7a)`
- `.g9` `linear-gradient(135deg,#f3f3f3,#d6d6d8 60%,#999)` (글자 #1a1a1d)
- `.g10` `linear-gradient(135deg,#5c1212,#1a1a1d)`
- `.g11` `linear-gradient(135deg,#ffe6d6,#ffb88a)` (글자 #4a1a00)
- `.g12` `linear-gradient(160deg,#1f8a5b,#0d3b2e)`

---

## 5. 화면별 명세 (핵심 인터랙션·DOM·JS)

> 각 화면은 utility→gheader→catnav→main.shell→gfooter 골격을 공유(거래/관리자 화면 제외).

### 5.1 `index.html` — 홈
- **히어로**: 좌(1.55fr) Featured 큰 카드(IU 월드투어, `예매하기→`는 `queue.html`로) + 우(1fr) 미니 2개(레미제라블·베를린필). 중첩 `<a>` 금지 — 카드 컨테이너는 `<div role="link">` + onclick.
- **실시간 랭킹**: 5열 그리드, 1~10위. 각 항목 `.rnum`(37px black, hover red) + 미니 포스터 + 제목/정보 + 등락(`▲`/`▼`/`—`).
- **티켓오픈 예정**: 4열 카드(날짜 50px black + 회차 + 공연 + D-day 태그 + 알림).
- **기획전**: 3카드(dark/red/cream) → `event.html`.
- **장르 추천**: 콘서트·뮤지컬·연극+클래식 각 5열 그리드(`.pcard` → `detail.html`).
- **바로가기**: 6열(지방/대학로/할인/VIP/오픈캘린더→`open.html`/당일).

### 5.2 `category.html` — 카테고리 리스트 (+ Tweaks)
- `.cat-head`(50px 타이틀) + `.filterbar`(장르/지역/상태 칩) + `.toolbar`(건수·정렬·**레이아웃 토글 3종**).
- `.listing[data-layout]` 3모드 CSS: `grid`(4열) / `list`(가로 행, 포스터 120px + 설명 2줄 + CTA) / `magazine`(6열 비대칭 그리드, 풀블리드 포스터 + 오버레이 텍스트, `:nth-child`로 span 지정).
- **Tweaks**: `copy_starter_component` 동급의 `tweaks-panel.jsx` 사용. `useTweaks({layout:'grid'})`는 **튜플 `[tweaks,setTweak]` 반환**. `TweakRadio options`는 문자열 배열 `['grid','list','magazine']`, `TweakSection`은 `label` prop. 툴바 버튼과 패널이 양방향 동기화.

### 5.3 `detail.html` — 공연 상세
- 3컬럼 히어로: 포스터(320) + 정보(메타 테이블) + **sticky 예매 패널**(360, top = header+catnav+12). 패널 `예매하기→`는 `queue.html`.
- 탭: 공연소개/출연진/공연일정/장소/유의사항(앵커). 출연진 6열 아바타. 공연일정 = 미니 캘린더(공연일 도트) + 회차 칩 + "선택 회차 예매".

### 5.4 `queue.html` — 대기열
- 다크 풀스크린. 좌측 공연 정보, 우측 카드(스피너 + 대기 인원 72px + 진행률 바 + 내 번호·처리속도 + "새로고침 금지" 경고).
- JS: `ahead`(시작 12,847) 400ms마다 150~280 감소, 진행률·ETA 갱신. 0 도달 → `.ready` 상태 전환 → 5초 카운트다운 → `location.href='booking.html'`. `prefers-reduced-motion`에서 스피너 정지.

### 5.5 `booking.html` — 예매 플로우
- 슬림 헤더(7분 타이머 `07:00` 카운트다운) + 4스텝 인디케이터 + 2컬럼(콘텐츠 + 우측 요약 패널 sticky).
- **STEP1**: 미니 캘린더(공연일 클릭) + 회차 리스트 + 매수 스테퍼(최대 4).
- **STEP2 좌석맵**: JS로 생성. 행 A~T(티어 매핑 VIP:A~C, R:D~H, S:I~N, A:O~T), 1~22열에 12열 위치 통로(`.aisle`). 사전 매진 `sold` Set 고정. 좌석 클릭 → 최대 2매 선택(초과 시 가장 오래된 것 해제), `.picked` 시 ✓ 표시. 선택 목록·카운트·`toPayBtn` 활성화.
- **STEP3 결제**: 예매자 정보 + 결제수단 4종(신용카드/간편결제/계좌이체/휴대폰; **무통장입금=입금대기**도 옵션 표기) + 할인/포인트 + 약관. `결제하기`는 `confirm.html`.
- 요약 패널: 좌석·매수·금액·수수료(장당 2,000) 실시간 갱신. `prices={vip:190000,r:160000,s:120000,a:80000}`.

### 5.6 `confirm.html` — 예매 완료 / 가상 티켓
- 완료 헤드(체크 아이콘 + 예매번호 `CTI-…`).
- **3단계 QR 배너**: 구매직후(가상 티켓·done) / 공연 1일 전(준비·기기확인) / 공연 2~3시간 전(동적 QR 활성화).
- 티켓 카드(포스터 헤더 + **펀치 절취선 `.perf`** + DATE/VENUE/SEAT 셀). QR 영역은 **`.qr.locked`(blur) + 🔒 + "가상 티켓·입장 불가" 칩**. "앱에서 열림" 버튼 disabled.
- 2번째(동반자) 티켓: `양도` 버튼 → `transfer.html`.
- 하단 tips: 동적 QR 정책·대표자 동반 입장 안내.

### 5.7 `mypage.html` — 마이페이지
- 회원 카드(아바타·등급·통계 4) + 2컬럼(사이드 네비 + 콘텐츠).
- 사이드: 예매내역/취소내역→`cancel`/공식 재판매→`resale`/관심공연→`watchlist`/알림신청→`watchlist`, 혜택, 계정(1:1 문의→`inquiry`).
- 예매내역 행: 포스터 + 메타 + **`.qrstate` 칩**(virtual=가상 티켓 / active=입장 QR 활성화) + 일정 + 액션(가상 티켓 보기 / 재판매·양도 / 취소). **D-DAY 행**은 `btn-accent` "입장 QR 열기(앱)" + "20초마다 갱신".

### 5.8 `search.html` — 검색 결과
- 검색 헤드(37px, 키워드 강조) + 연관 검색어 칩 + 탭(전체/공연/아티스트/장소/기획전).
- 공연 4열 그리드(`.highlight` 노랑 하이라이트), 아티스트 카드(→`artist.html`), 공연장 카드(→`venue.html`), 빈 결과 힌트.

### 5.9 `login.html` — 로그인/회원가입
- 2컬럼: 좌 다크 브랜드 패널(`justify-content:flex-start` + `gap`, perks는 `margin-top:auto` — **`space-between` 금지**, 짧은 뷰포트 겹침 방지), 우 폼.
- 탭 전환 `data-mode`(login/signup). `body[data-mode="login"] .signup-only{display:none!important}`로 가입 전용 블록 숨김(소스 뒤 규칙 우선). 가입 버튼이 `.block`이어도 flex 중앙정렬 유지(`a.btn.signup-only.block{display:flex}`).
- 소셜: 카카오(#FEE500)·네이버(#03C75A)·Apple(ink).

### 5.10 `cancel.html` — 취소·환불
- 4단계 패널: ①예매 확인(부분취소 좌석 칩) ②사유(라디오 그리드) ③**수수료 정책 테이블**(현재 시점 행 강조) ④환불 계산. 동의 체크 시에만 `btn-accent` 활성화 → 처리 후 `mypage.html`.

### 5.11 `open.html` — 티켓오픈 캘린더
- 2컬럼: 월별 그리드(셀당 `.cal-ev` 색상=장르: concert red/musical blue/classic green) + 오픈 임박 리스트(알림 토글 `🔔/🔕`).

### 5.12 `event.html` / `venue.html` / `artist.html`
- event: 에디토리얼 히어로(72px) + 큐레이션 소개 + 라인업 4열(번호 매김) + CTA.
- venue: 히어로 + 소개 + 좌석 배치도(층별 색상 바) + 현재 공연중 3열 + 교통 + sticky 정보 카드.
- artist: 원형 아바타 히어로 + 통계 3 + 예매중 공연 + 지난 공연 타임라인.

### 5.13 `help.html` — 고객센터
- 다크 검색 히어로 + 카테고리 4 + 2컬럼(FAQ 네비 + **`<details>` 아코디언** 7건) + 상담 채널 3(전화/1:1→`inquiry`/카톡).

### 5.14 `watchlist.html` — 관심공연·알림
- 2컬럼: 관심 목록(행 + `.sw` 토글 스위치 + D-day) + 사이드(**알림 타임라인** done/next/대기 + 채널 설정 카톡/푸시/이메일/SMS 토글).

### 5.15 `resale.html` — 공식 재판매 (차별점)
- 상단 "클린 티켓" 설명 배너(왜 좌석 지정 불가) + 정책 수치(0~10%, 3~5%).
- 탭 **팔기/구하기**.
- **팔기**: 보유 티켓 선택 → 가격 입력. `.price-track`에 ok-zone + 마커, 입력값을 정가의 90~100%로 검증(`policy-msg ok/err`), 수수료 4% 자동 차감 → 정산액. 등록 시 토스트.
- **구하기**: 조건 칩(등급/구역/가격/연석·매수) → **조건부 랜덤 매칭**: `.pool-seats` 60칸 중 일부 `match`, `drawBtn` 클릭 시 90ms 간격으로 후보를 순환 점등(14회) 후 확정 → `.result-card`에 좌석·금액·수수료·**랜덤 시드 `0x…` + 원장 #** 노출 → `confirm.html`. 하단 "현재 열린 풀" 테이블.

### 5.16 `transfer.html` — 공식 양도
- 3패널: ①양도할 티켓(좌석 칩 선택) ②받는 사람(카톡/이메일/폰 + 입력 + 비회원 안내) ③양도 금액(정가 0~10% 범위, 수수료 양수자 부담 건당 2,000) → 요청 토스트.

### 5.17 `inquiry.html` — 1:1 문의함
- 2컬럼: 스레드 목록(상태 칩 대기/완료/종료) + 상세(컨텍스트 칩 예매번호·공연·티켓 + **말풍선 스레드** me/agent/sys + 작성창). 전송 시 본인 말풍선 추가 + sys 자동응답. Enter 전송(Shift+Enter 줄바꿈). 데이터는 JS `threads` 객체.

### 5.18 관리자 기능 — backend API
- public Next.js app에는 관리자 페이지를 빌드하지 않는다.
- 관리자 기능은 50084 포트의 backend API로만 제공한다.
- 유지 API 범위: 운영현황, 판매 정보 수정, 좌석도/좌석 재고, 계정 상태, 암표 대응, 고객문의 답변, 감사 원장.
- public 서버에서는 `/admin`, `/admin.html`, `/admin/*`, `/api/admin/*`에 관리자 기능을 노출하지 않고 404로 응답한다.

---

## 6. 라우팅 맵 (死링크 0)

| 출발 | 트리거 | 도착 |
| --- | --- | --- |
| index 히어로/카드 | 예매하기 | queue.html |
| index 기획전 | 카드 | event.html |
| detail 예매 패널 | 예매하기 | queue.html |
| queue | 카운트다운 종료 | booking.html |
| booking step3 | 결제하기 | confirm.html |
| confirm 동반자 티켓 | 양도 | transfer.html |
| mypage 예매행 | 재판매/양도/취소 | resale / transfer / cancel |
| 전 페이지 푸터 | 1:1 문의 | inquiry.html |
| 전 페이지 헤더 ♡ | 관심공연 | watchlist.html |
| 전 페이지 catnav 우측 | 티켓오픈 | open.html |
| 전 페이지 유틸바 | 고객센터 | help.html |
| search | 아티스트/장소 카드 | artist / venue |

---

## 7. 목업 데이터 일관성 규칙

- 대표 공연: **레미제라블 40주년**(블루스퀘어, VIP 190,000/R 160,000/S 120,000/A 80,000), 예매번호 `CTI-260513-A4F2K9`, 좌석 VIP H-14·H-15, 총 결제 ₩346,000(신한카드 10% 할인 후).
- IU 2026 WORLD TOUR(잠실), DAY6, SEVENTEEN, NCT WISH, 하데스타운, 오페라의유령, 베를린필, 조성진 등 라인업 공유.
- 예매번호 prefix `CTI-`, 회사 `Ticketground Inc.`, 대표 `박지원`, 도메인 `ticketground.kr`, CS `1577-0000`.
- 동일 공연·금액·좌석이 detail/booking/confirm/mypage/cancel에서 **일치**해야 함.

---

## 8. 검증 체크리스트

- [ ] 21 HTML + 3 CSS + 1 JSX 생성, 콘솔 에러 0.
- [ ] 본문 ≥ 13px, 토큰 외 색·폰트 없음.
- [ ] 좌석맵 선택/요약, 재판매 매칭, 대기열 카운트다운, 취소 게이트, 문의 전송, admin 8섹션 전환 동작.
- [ ] 가상 티켓 🔒 ↔ 동적 QR 단계 시각 구분.
- [ ] 6장 라우팅 맵 전 링크 연결.
- [ ] 사용자/관리자 chrome 분리.
