# Ticketground

## 개요

Ticketground는 국내 콘서트, 뮤지컬, 스포츠, 페스티벌 예매를 한곳에서 검증하기 위한 티켓팅 플랫폼 MVP다. 사용자 예매 흐름뿐 아니라 공식 재판매(양도)를 핵심 기능으로 두고, 사업계획서의 NFT/블록체인 표현은 MVP 단계에서 해시 체인 감사 원장과 백엔드 정책 엔진으로 치환했다. 자세한 치환 기준과 정책 배경은 [ARCHITECTURE.ko.md](ARCHITECTURE.ko.md)를 본다. 사용자 사이트, 관리자 콘솔, 백엔드 API는 이 저장소 안에서 하나의 Node 프로세스로 함께 뜬다.

## 아키텍처 한눈에 보기

`server.js`가 Node 기본 `http` 모듈로 두 HTTP 서버를 부팅한다.

| 표면 | 기본 주소 | 역할 |
| --- | --- | --- |
| 사용자 사이트 | `PORT` 기본 `4173`, `0.0.0.0` 바인딩 | Next.js UI와 공개 `/api/*` |
| 관리자 콘솔 | `ADMIN_PORT` 기본 `50084`, `127.0.0.1` 바인딩 | `/console`과 `/api/admin/*` |

관리자 콘솔이 기본적으로 `127.0.0.1`에만 바인딩되는 것은 의도된 설계다. 운영자가 쓰는 내부 표면을 공개 포트에 노출하지 않기 위해서이며, 사용자 포트에서는 관리자 진입점을 열지 않는다.

백엔드는 Express 같은 웹 프레임워크 없이 Node `http`와 `backend/*.js` 도메인 모듈로 구성되어 있다. 별도 데이터베이스 서버도 없다. 기본 저장소는 JSON 파일 DB인 `data/db.json`이고, 주요 거래와 운영 이벤트는 append-only 해시 체인 원장에 이어 붙인다. 새로 들어오는 개발자가 가장 자주 놀라는 지점이 이 부분이다.

프론트엔드는 Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui를 쓴다. 결제 흐름은 BootPay를 통과하며, 로컬 기본값은 mock 모드다.

## 빠른 시작

Node 버전은 `.nvmrc`와 `package.json` 기준으로 24 이상을 사용한다.

```bash
nvm use
npm install
cp .env.example .env
cp .env.local.example .env.local
npm run dev
```

소셜 로그인 키가 없으면 QA mock 로그인으로 폴백한다. 실제 카카오, 네이버, 구글 로그인을 검증할 때는 `.env`와 `.env.local`의 역할을 구분해야 한다. 공개 식별자는 `.env.example`, 비밀값은 `.env.local.example`을 기준으로 채운다.

팀 내 개발 관례는 사용자 포트를 `PORT=5501`로 띄우는 것이다. OAuth redirect URI가 `localhost:5501` 기준으로 등록되어 있기 때문이다. 별도 스크립트로는 `npm run dev:4500`이 있으며, 이 경우 사용자 포트는 4500이고 관리자 포트는 50084다.

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | `node server.js`로 개발 서버 실행 |
| `npm run build` | Next.js 프로덕션 번들 생성 |
| `npm run start` | `NODE_ENV=production node server.js` 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run typecheck` | `tsc --noEmit` 타입 검사 |
| `npm test` | 프로덕션 번들을 먼저 빌드한 뒤 `node --test`로 테스트 실행 |
| `npm run check` | lint, typecheck, test 순서로 전체 검사 |

`npm test`는 먼저 `npm run build`를 실행하고, 약 57개 테스트 파일을 `node --test --test-concurrency=1 tests/*.test.mjs`로 직렬 실행한다. 빠른 smoke test가 아니라 전체 회귀 검사에 가깝기 때문에 시간이 걸린다.

개발 서버가 떠 있는 상태에서 `npm run build`, `npm test`, `npm run check`를 동시에 돌리면 `.next` 개발 캐시가 손상될 수 있다. 개발 서버를 내린 뒤 실행하거나, 타입 검사만 필요하면 `npm run typecheck`를 사용한다.

## 관리자 콘솔

관리자 콘솔은 기본적으로 다음 주소에서 접근한다.

```text
http://127.0.0.1:50084/console
```

최초 로그인 계정은 `.env.local`의 `TIG_ADMIN_USERNAME`, `TIG_ADMIN_PASSWORD`로 부트스트랩한다. 로그인은 IP별 rate limit이 적용된다.

현재 콘솔 작업공간은 11개다.

- `overview`: 운영 현황
- `catalog`: 공연 등록과 콘텐츠
- `sales`: 판매 상태, 할인, 일정
- `inventory`: 좌석 재고와 bulk action
- `accounts`: 계정 검색과 제재
- `support`: 고객 문의
- `finance`: 결제와 정산
- `resale`: 공식 재판매 운영
- `admission`: 입장 QR과 현장 보류
- `audit`: 감사 로그와 CSV export
- `acl`: 관리자 권한

전체 기능 요구사항과 완료 기준은 [관리자 페이지 세부작업 내역서.md](관리자%20페이지%20세부작업%20내역서.md)를 본다. 관리자 entry point는 공개 사용자 포트에 노출하지 않는다.

## 저장소 구조

```text
.
├─ server.js                 # 사용자 서버와 관리자 서버 부팅
├─ backend/                  # 도메인 모듈과 API 라우팅
├─ src/app/                  # Next.js App Router routes
├─ src/components/           # admin, ticketing, home 등 UI 컴포넌트
├─ data/db.json              # 로컬 JSON 파일 DB
├─ tests/                    # node --test 기반 회귀 테스트
├─ scripts/                  # 마이그레이션, QA, 동기화 스크립트
└─ docs/                     # PRD, SPEC, 디자인/조사 문서
```

백엔드 모듈별 책임은 [백엔드.md](백엔드.md)에 정리되어 있다.

## 문서 지도

- [백엔드.md](백엔드.md): API, 도메인 모듈, JSON DB, 원장 구조
- [ARCHITECTURE.ko.md](ARCHITECTURE.ko.md): NFT/블록체인 표현을 MVP 구조로 치환한 배경
- [관리자 페이지 세부작업 내역서.md](관리자%20페이지%20세부작업%20내역서.md): 관리자 콘솔 전체 기능 명세
- [티켓그라운드 페이지 세부작업 내역서.md](티켓그라운드%20페이지%20세부작업%20내역서.md): 사용자 페이지 세부 작업 내역
- [docs/PRD.md](docs/PRD.md): 제품 요구사항
- [docs/SPEC.md](docs/SPEC.md): 구현 스펙
- [CHANGELOG.md](CHANGELOG.md): 변경 이력
- [기관티켓예매.md](기관티켓예매.md): 기관 티켓 예매 정책
- [휴대폰 본인인증.md](휴대폰%20본인인증.md): 휴대폰 본인인증 정책
- [티켓판매흐름.md](티켓판매흐름.md): 티켓 판매 흐름
- [입장qr 문제점.md](입장qr%20문제점.md): 입장 QR 정책과 위험 지점

> 중요: [간편로그인-수정금지-지침.md](간편로그인-수정금지-지침.md)를 먼저 읽는다. 이 문서는 간편 로그인, 소셜 로그인, OAuth 작업이 명시적으로 지시되지 않은 경우 건드리면 안 되는 파일과 이유를 적는다. 또한 `.env.example`에는 공개 식별자, `.env.local.example`에는 비밀값 템플릿을 두는 이유도 여기서 설명한다.

## 브랜치 안내

`main`은 canonical/deployed 상태를 담는 기준 브랜치다.

`admin`은 관리자 콘솔 개발 브랜치이며, 작업 완료 후 PR로 `main`에 병합한다. 자세한 흐름은 해당 브랜치의 README를 본다.

`backend_server`는 모바일 앱이 호출하는 API-only 서버 브랜치이며, Oracle Cloud VM에 별도 배포된다. 자세한 운영 안내는 해당 브랜치의 README와 `docs/DEPLOYMENT.md`를 본다.

`frontend` 브랜치는 사용자 프론트엔드 작업 흐름을 분리해둔 브랜치다.

`new_design` 브랜치는 새 디자인 실험과 정리 작업을 위한 브랜치다.
