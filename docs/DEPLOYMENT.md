# Backend Server 배포 안내

`backend_server` 브랜치의 API 전용 서버가 실제로 어디서, 어떻게 떠 있는지 정리한 문서입니다. 코드 작업은 API 레퍼런스([docs/API_REFERENCE.md](API_REFERENCE.md))를 참고하고, 이 문서는 운영/배포 관점만 다룹니다.

## 아키텍처

`server.js` 하나의 Node 프로세스가 서로 다른 세 개의 HTTP 서버를 띄웁니다.

| 서버 | 기본 포트 | 바인딩 | 용도 |
|---|---|---|---|
| 사용자 페이지(UI) | `PORT` (4173) | `HOSTNAME` | Next.js 전체 웹사이트 — **아직 미완성이라 외부 비공개** |
| 관리자 콘솔 | `ADMIN_PORT` (50084) | `ADMIN_HOSTNAME` (기본 127.0.0.1) | `/console` UI + `/api/admin/*` — 로컬/사내 전용 |
| API 전용 | `API_PORT` (PORT+1) | `API_HOSTNAME` | `/api/*`만 응답, UI 없음 — **모바일 앱이 호출하는 곳** |

## 현재 운영 서버

- **호스트**: Oracle Cloud Always Free VM, `ubuntu@132.145.109.87`
- **외부에 열려 있는 포트**: `4174`(API 전용)만. `4173`(전체 웹), `50084`(admin)은 OCI Security List + OS 방화벽(iptables) 양쪽에서 차단되어 있습니다. 전체 웹사이트가 완성되기 전까지는 이 상태를 유지해야 합니다.
- **프로세스 관리**: systemd 서비스 `ticketground-backend` (`/etc/systemd/system/ticketground-backend.service`), `Restart=always`로 크래시/재부팅 시 자동 재시작.
- **환경변수 파일**: `/home/ubuntu/app/.env.production` (서버에만 존재, git에는 올라가지 않음, 권한 600). 여기에 `TIG_SECRET`, `TIG_ADMIN_TOKEN`, `TIG_ADMIN_SESSION_SECRET`, `TIG_ADMIN_USERNAME`/`PASSWORD`, `TIG_APP_ATTESTATION_SECRET` 등 실제 비밀값이 들어있습니다 — **이 값들은 어떤 문서/커밋에도 그대로 적지 않습니다.**

### 서버 점검 명령 (SSH 접속 후)

```bash
sudo systemctl status ticketground-backend    # 실행 상태
sudo journalctl -u ticketground-backend -f    # 실시간 로그
sudo systemctl restart ticketground-backend   # 재시작 (env 파일 수정 후 반영할 때 필요)
```

### 코드 업데이트 배포 절차

VM이 메모리가 작아서(약 954MB) 직접 빌드하지 않고, 로컬에서 빌드한 결과물만 옮깁니다.

1. 로컬에서 `backend_server` 브랜치를 최신으로 체크아웃(또는 worktree로 분리)한 뒤 `npm install` → `npm run build` 실행 (Next.js 프로덕션 빌드)
2. `rsync`로 서버에 전송 — `node_modules`, `.git`, `data`(로컬 DB), `.env*`(서버의 실제 비밀값 보존), `.next/dev`, `.next/cache`, `.next/trace*`, `.next/diagnostics` 등은 제외:
   ```bash
   rsync -avz --delete \
     --exclude 'node_modules' --exclude '.git' --exclude 'data' --exclude '.env*' \
     --exclude '.next/dev' --exclude '.next/cache' --exclude '.next/trace*' --exclude '.next/diagnostics' \
     -e "ssh -i <SSH_KEY_PATH>" \
     <로컬 backend_server 체크아웃>/ ubuntu@132.145.109.87:/home/ubuntu/app/
   ```
3. 서버에서 `npm ci --omit=dev` 실행 (sharp 등 네이티브 모듈을 리눅스 x64용으로 재설치하기 위해 서버에서 직접 설치)
4. `sudo systemctl restart ticketground-backend`
5. `curl http://132.145.109.87:4174/api/health`, `/api/app/config`, `/api/catalog`로 정상 응답 확인. 세션 관련 변경을 배포했다면 `GET /api/users/:userId/session` 응답에 `sessionToken`이 없는지도 같이 확인(있으면 안 됨 — 데모 세션 조회는 토큰을 발급하지 않는 것이 의도된 동작).

### 배포 이력

- **2026-07-16 재배포**: 그동안 로컬/브랜치에만 반영되고 운영 서버에는 오랫동안 재배포가 안 된 상태였음 — `/api/health`가 404로 응답해서 발견함(모바일 개발자가 최신 API 레퍼런스 문서를 보고 신규 엔드포인트를 호출했는데 실제 서버엔 없어서 계속 404가 났음). 아래 항목들을 포함해 최신 `backend_server`(커밋 `aa7f7ca`)로 재배포 완료:
  - Round 2 모바일 하드닝: API 전용 포트 rate limiting, `GET /api/health`·`GET /api/app/config`, app-attestation nonce 기반 재사용 방지, 세션 토큰(로그인 시에만 발급, 데모 세션 조회/프로필 수정 경로에서는 미발급), push-token 등록(`POST /api/devices/push-token`), `/api/state`·`/api/catalog` 페이로드 축소/페이지네이션.
  - 보안 수정: 직접양도(`/api/security/direct-transfer-attempt`) 스푸핑 방지(티켓 소유권 무조건 확인, bearer 토큰 유무와 무관하게 적용), 부트스트랩 관리자 비밀번호 및 QR·기기토큰 비교를 `crypto.timingSafeEqual`로 전환.
  - Next dev 모드 HMR 업그레이드 배선 수정(로컬 개발 편의용, 운영 동작에는 영향 없음).
  - 재배포 후 라이브 확인: `/api/health`·`/api/app/config` 정상 응답, 기존 `/api/catalog` 회귀 없음, `/api/users/:userId/session` 응답에 `sessionToken` 미포함 확인(세션 토큰 보안수정이 운영에도 반영됐음을 확인).
- **재배포 시점 확인 방법**: `curl http://132.145.109.87:4174/api/health`가 404가 아니라 `{"ok":true,"data":{"status":"UP",...}}`를 반환하면 최소 Round 2 하드닝 이후 코드가 떠 있는 것. 그 이전 배포인지 이후 배포인지는 이 엔드포인트 존재 여부로 가늠할 수 있다.

### HTTPS/TLS 미적용 (의도적, 임시)

현재 운영 서버는 `http://132.145.109.87:4174` 평문으로만 서비스합니다. Let's Encrypt 등 공인 인증서는 **도메인 이름이 있어야** 발급 가능하고 bare IP로는 발급이 안 되기 때문에, 도메인을 아직 마련하지 않은 지금 단계에서는 자체서명 인증서 외에 대안이 없고 자체서명은 모바일 OS/앱스토어 심사에서 신뢰되지 않아 실효성이 없습니다. 지금은 모바일 앱 연동 테스트 단계라 평문 HTTP로 유지하기로 결정했습니다(2026-07-16).

**실제 출시 전에는 반드시** 도메인 구매 → DNS A 레코드를 `132.145.109.87`로 연결 → 리버스 프록시(Nginx 또는 Caddy — Caddy는 Let's Encrypt 인증서 발급/갱신을 자동 처리) 구성 → 443을 프록시가 받아 로컬 `4174`로 전달하는 순서로 전환해야 합니다. App Store의 ATS와 Android 9+의 cleartext 차단 정책 때문에 평문 HTTP로는 스토어 심사 자체가 불가능합니다.

## 다른 개발자에게 접근 권한을 줄 때

- **GitHub 저장소**: private 저장소이며 Collaborator 초대로 접근 권한을 부여합니다.
- **서버 SSH**: 현재 서버 SSH 키는 배포 담당자 로컬에만 있습니다. 다른 사람이 서버에 직접 접속해야 하면 Oracle Cloud 콘솔에서 별도 SSH 공개키를 추가하거나, 새 사용자 계정을 만들어야 합니다 (현재는 별도로 되어 있지 않음).
- **모바일 개발자**: 서버에 직접 접속할 필요 없이 `docs/API_REFERENCE.md`의 API 주소(`http://132.145.109.87:4174`)만 있으면 됩니다.
