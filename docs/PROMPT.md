# Ticketground — Codex 실행 지시문 (PROMPT)

> 아래 블록을 Codex에 그대로 붙여넣어 사용한다. `PRD.md`, `SPEC.md`, `Design.md`, `사업계획서(260624).md`를 같은 작업 폴더에 함께 제공할 것.
> (참고 산출물이 있다면 `/reference/*.html`로 함께 두고 "동일 또는 그 이상" 기준으로 삼게 한다.)

---

## ▶ 메인 프롬프트 (복사해서 사용)

```
역할: 너는 시니어 프로덕트 디자이너 겸 프런트엔드 엔지니어다. 한국어 UI의 티켓 예매 플랫폼
"Ticketground" 데스크톱 웹 하이파이 프로토타입을 만든다.

[입력 문서]
- PRD.md : 무엇을·왜 (제품 요구사항, 화면 인벤토리, 인수 기준)
- SPEC.md : 어떻게 (디자인 토큰 정확값, 컴포넌트, 화면별 인터랙션, 라우팅 맵)
- Design.md : 디자인 토큰 원본 (단, 본문 10px는 접근성 위반 → 13px 이상으로 상향)
- 사업계획서(260624).md : 원본 비즈니스 PRD (암표 통제·공식 재판매·QR 정책의 근거)
- /reference/*.html : (있다면) 목표 산출물. 동일하거나 더 나은 품질을 낸다.

[목표]
순수 정적 HTML/CSS/바닐라JS로 21개 화면을 만든다. 빌드 스텝·프레임워크 없음
(Tweaks 패널만 React+Babel 인라인 허용). 모든 파일은 file://로 더블클릭해 열리고
콘솔 에러가 0이어야 한다.

[절대 규칙]
1. SPEC.md의 디자인 토큰(색·폰트·간격·라디우스·섀도)만 사용. 새 색/폰트 발명 금지.
   모든 값은 CSS 커스텀 프로퍼티 변수로 참조한다.
2. 본문 글자 ≥ 13px (WCAG 2.2 AA). 12px 미만 텍스트 금지.
3. AI slop 금지: 과한 그라데이션 배경, 이모지 남발, "둥근 모서리+좌측 보더 액센트"
   카드, Inter/Roboto 같은 흔한 폰트 금지. 폰트는 Pretendard Variable.
4. 포스터는 실사 없이 "그라데이션(.g1~.g12) + 공연명 타이포"로 표현.
5. UI 그룹 배치는 flex/grid + gap. 인라인 플로우 금지. 비-void 요소는 명시적 종료,
   속성은 더블쿼트. 중첩 <a> 금지(필요 시 div role=link + onclick).
6. 한국 실제 공연 컨텍스트로 채운다(IU 월드투어, 레미제라블 40주년, 베를린필, 조성진,
   SEVENTEEN, 하데스타운 등). 목업 데이터는 화면 간 일치(공연·예매번호·금액·좌석).
7. 사용자 페이지와 관리자 콘솔(admin.html)은 chrome를 분리한다(관리자는 다크 사이드바).

[파일 구조]
assets/tokens.css, assets/app.css, assets/admin.css, tweaks-panel.jsx 와
21개 HTML(SPEC 2장 목록). app.css가 tokens.css와 Pretendard CDN을 @import.

[구현 순서 — 단계마다 링크·콘솔 점검]
P0: tokens.css → app.css → index → category → detail → booking → confirm → mypage → search
P1: queue → login → cancel → open → event → venue → artist → help
P2: admin → resale → transfer → watchlist → inquiry → (confirm·mypage에 QR 상태 분리 반영)
마지막: SPEC 6장 라우팅 맵대로 전 페이지 상호 링크.

[반드시 동작해야 하는 인터랙션]
- booking.html 좌석맵: 20행(A~T)×22열, 12열 위치 통로, VIP/R/S/A 4티어, 사전 매진석.
  클릭 선택/해제(최대 2매), ✓ 표시, 우측 요약(좌석·매수·금액·수수료 2,000/장) 실시간 갱신.
- queue.html: 대기 인원 400ms마다 감소 → 0이면 5초 카운트다운 후 booking.html 이동.
  "새로고침 금지" 경고. prefers-reduced-motion에서 스피너 정지.
- resale.html: (팔기) 정가 90~100% 범위 검증 + 4% 수수료 자동계산. (구하기) 등급·구역·
  가격·연석 조건 → 조건부 랜덤 매칭 애니메이션 → 좌석·랜덤시드·원장# 공개 → confirm.
- confirm.html + mypage.html: 가상 티켓(🔒 blur, 입장 불가) ↔ 동적 QR 3단계
  (구매직후/공연 1일전/2~3시간전 앱 20초 갱신)를 시각적으로 구분.
- admin.html: 8섹션 전환. 판매행→폼 자동채움→저장 확인 모달, 계정 상태 변경 토스트,
  좌석도 공연장별 동적 렌더, 감사 원장 해시 체인 표현.
- category.html: 그리드/리스트/매거진 레이아웃 토글(Tweaks 패널 + 툴바 양방향).
- cancel.html: 4단계 + 동의 게이트. inquiry.html: 말풍선 스레드 + 전송/자동응답.

[Tweaks 패널 주의]
useTweaks(defaults)는 튜플 [tweaks, setTweak] 반환. TweakRadio options는 문자열 배열,
TweakSection은 label prop. React/ReactDOM/Babel은 핀 버전+integrity로만 로드.

[완료 기준 = SPEC 8장 체크리스트]
21 HTML + 3 CSS + 1 JSX, 콘솔 0, 본문≥13px, 토큰 외 색 없음, 위 인터랙션 전부 동작,
라우팅 맵 死링크 0, 가상/동적 QR 구분, 사용자/관리자 chrome 분리.

먼저 SPEC.md를 정독하고, P0부터 순서대로 구현하라. 각 단계 끝에 무엇을 만들었고 다음에
무엇을 할지 한 줄로 보고하라. 추측으로 토큰을 바꾸지 말고, 모호하면 SPEC을 우선한다.
```

---

## ▶ 보조 운용 팁 (사람이 Codex를 다룰 때)

1. **분할 실행**: 한 번에 21개를 요구하면 품질이 떨어진다. 위 프롬프트로 시작하되,
   실제로는 "P0만 먼저", "다음 P1", "다음 P2"처럼 단계별로 끊어 지시하면 안정적이다.
2. **토큰 고정 먼저**: 첫 턴에서 `assets/tokens.css`와 `assets/app.css`만 완성시키고
   리뷰한 뒤 화면 구현으로 넘어가면 일관성이 유지된다.
3. **참고 산출물 비교**: `/reference`를 제공했다면 "reference/booking.html과 좌석맵
   상호작용을 비교해 누락된 동작을 채워라"처럼 차이 기반으로 지시한다.
4. **회귀 방지**: 새 화면 추가 시 "기존 파일의 토큰·헤더·푸터·라우팅을 변경하지 말고
   새 파일만 추가하라"를 명시한다.
5. **검증 루프**: 각 단계 후 "브라우저 콘솔 에러와 死링크를 점검하고 목록으로 보고"를
   요구한다. 에러가 있으면 수정 후 재보고하게 한다.
6. **데이터 일관성**: "SPEC 7장의 대표 공연/예매번호/금액을 단일 소스로 사용"을 반복
   강조한다(화면마다 숫자가 달라지는 흔한 실패를 막는다).
7. **금지 목록 재강조**: 결과가 흔한 웹 템플릿처럼 나오면 "AI slop 금지 규칙(3번)을
   다시 적용해 재작업"이라고 짧게 지시한다.

---

## ▶ 단계별 마이크로 프롬프트 (선택)

- **1턴**: "SPEC 3장 토큰값으로 assets/tokens.css를, SPEC 4장으로 assets/app.css(헤더/
  카테고리바/푸터/버튼/칩/태그/포스터 .g1~.g12/카드)를 작성하라. 화면은 아직 만들지 마라."
- **2턴**: "index.html을 SPEC 5.1대로. 히어로 예매하기는 queue.html로. 중첩 a 금지."
- **3턴**: "detail → booking(좌석맵 JS 포함) → confirm을 SPEC 5.3/5.5/5.6대로."
- **4턴**: "mypage·search·category(Tweaks 토글)."
- **5턴**: "queue·login·cancel·open·event·venue·artist·help."
- **6턴**: "admin.html(assets/admin.css, 8섹션)·resale·transfer·watchlist·inquiry."
- **7턴**: "SPEC 6장 라우팅 맵대로 전 페이지 링크 연결 + confirm·mypage에 QR 상태 분리
  반영 + 8장 체크리스트 자가 점검 후 보고."
```
