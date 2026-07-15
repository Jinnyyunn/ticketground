# Ticketground Backend Server Branch

## 이 브랜치는 무엇인가

`backend_server`는 모바일 앱이 호출하는 API-only 서버 브랜치다. 이 브랜치의 `server.js`는 사용자 페이지 서버와 관리자 콘솔 서버에 더해 세 번째 HTTP 서버를 띄운다. 이 서버는 `API_PORT`에서 뜨며, 기본값은 `PORT + 1`, 운영값은 `4174`다.

API-only 서버는 `/api/*`에만 응답하고 나머지 경로는 404를 반환한다. `/api/admin/*`와 `/api/ledger`도 이 포트에서는 항상 404다. 모바일 앱 표면에는 optional-enforcement session token, push-token 등록, app-attestation nonce flow, `/api/health`, `/api/app/config` 같은 hardening이 포함되어 있다.

관리자 콘솔과 전체 웹 UI는 이 브랜치의 운영 관심사가 아니다. 코드에는 함께 남아 있지만 외부 배포에서는 API-only 포트만 열고, 관리자 포트와 사용자 웹 포트는 방화벽에서 막는다.

엔드포인트 상세는 README가 아니라 `docs/API_REFERENCE.md`를 기준으로 갱신한다.

## 독자별 시작점

- 모바일 개발자: [docs/API_REFERENCE.md](docs/API_REFERENCE.md)를 본다. 기본 API 주소는 `http://132.145.109.87:4174`이며, 서버 SSH 접근 없이 앱 연동을 진행할 수 있다.
- 배포/운영 담당: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)를 본다. Oracle Cloud VM, systemd 서비스 `ticketground-backend`, 로컬 빌드 후 rsync 배포, 방화벽에서 4174만 여는 정책이 정리되어 있다.
- 백엔드 코드 수정 담당: [백엔드.md](백엔드.md)를 본다. 이 브랜치의 문서만 3-server 구조를 설명한다. `main`과 `admin` 브랜치의 `백엔드.md`는 사용자 서버와 관리자 서버의 2-server 구조만 다룬다.

## 로컬 실행

```bash
npm install
npm run dev
curl localhost:4174/api/health
```

기본 설정에서는 사용자 서버가 `4173`, API-only 서버가 `4174`에 뜬다. 나머지 로컬 환경 구성은 `main` 브랜치의 [README.md](https://github.com/Jinnyyunn/ticketground/blob/main/README.md)를 기준으로 맞춘다.

운영 환경과 같은 포트만 확인하려면 `API_PORT=4174 npm run dev`로 띄운 뒤 `/api/health`와 `/api/app/config`를 먼저 확인한다.

## 브랜치 동기화 주의사항

이 브랜치는 `admin`의 `c45aef9`에서 갈라졌다. 그 뒤 `admin`에서 확장된 event picker, inventory/finance/audit/support 작업공간은 의도적으로 포함하지 않는다. 이 브랜치의 관심사는 모바일 앱이 호출하는 `/api/*` 표면이다.

`admin`이나 `main`의 UI 확장을 통째로 병합하면 이 브랜치의 목적이 흐려질 수 있다. 필요한 API, 보안 수정, 데이터 스키마 변경만 선별해서 가져온다.

보안 수정은 관련성이 있으면 cherry-pick한다. 선례로 `9c04f25`의 timing-safe password comparison 수정이 있다.

운영 배포는 서버에서 `git pull`하는 방식이 아니다. 로컬에서 빌드한 결과를 rsync로 전송하고, VM에서 production dependency를 맞춘 뒤 systemd 서비스를 재시작한다. 자세한 절차는 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)를 따른다.

`fly.toml`은 Fly.io 배포를 준비하며 남아 있는 파일이지만 현재 실제 배포 대상은 아니다. 지금 운영 표면은 Oracle Cloud VM 하나이며, 외부에는 API 전용 포트 `4174`만 열어 둔다.
