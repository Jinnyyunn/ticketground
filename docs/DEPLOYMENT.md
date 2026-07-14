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

1. 로컬에서 `npm run build` 실행 (Next.js 프로덕션 빌드)
2. `rsync`로 서버에 전송 — `.next/dev`, `.next/cache`, `.next/trace*`, `.next/diagnostics` 등 dev 전용 산출물은 제외
3. 서버에서 `npm ci --omit=dev` 실행 (sharp 등 네이티브 모듈을 리눅스 x64용으로 재설치하기 위해 서버에서 직접 설치)
4. `sudo systemctl restart ticketground-backend`
5. `curl http://132.145.109.87:4174/api/catalog` 등으로 정상 응답 확인

## 다른 개발자에게 접근 권한을 줄 때

- **GitHub 저장소**: private 저장소이며 Collaborator 초대로 접근 권한을 부여합니다.
- **서버 SSH**: 현재 서버 SSH 키는 배포 담당자 로컬에만 있습니다. 다른 사람이 서버에 직접 접속해야 하면 Oracle Cloud 콘솔에서 별도 SSH 공개키를 추가하거나, 새 사용자 계정을 만들어야 합니다 (현재는 별도로 되어 있지 않음).
- **모바일 개발자**: 서버에 직접 접속할 필요 없이 `docs/API_REFERENCE.md`의 API 주소(`http://132.145.109.87:4174`)만 있으면 됩니다.
