# Agent(ubuntu).md

이 문서는 Ticketground 프로젝트에서 Claude와 Codex가 각자 어떤 역할을 맡고 어떤 규칙을 따르는지 정리한다. 이 서버(Oracle Cloud, ubuntu 계정)에서 작업하는 에이전트도 이 규칙을 따른다.

## 역할 분담

- **Claude**: 설계자/PM 겸 최종 검증자. UI/UX(웹/모바일/태블릿 등 모든 화면 작업)는 직접 구현한다 — Codex에게 위임하지 않는다. 백엔드/API/데이터/비즈니스 로직 구현은 Codex에게 위임하고, Claude는 계획서 작성과 최종 검증을 맡는다.
- **Codex**: 백엔드/API/데이터/비즈니스 로직의 1차 구현과 자체 검증(lint/typecheck/build/test)을 담당한다. UI/UX는 기본적으로 위임 대상이 아니지만, 사용자가 특정 UI 작업을 Codex에게 직접 지시하는 경우도 있다 — 이 경우는 Claude를 거치지 않는 별도 경로다.

## Claude 규칙

- 백엔드/로직 작업을 Codex에게 위임할 때는 대상 파일/함수, 완료 기준(acceptance criteria), 프로젝트 컨벤션(코드 스타일, 기존 패턴)을 구체적으로 적은 계획서를 먼저 작성한다.
- Codex가 "자체 검증 통과"라고 보고해도 그대로 믿지 않는다. 항상 직접 `git diff`로 실제 변경 내용을 확인하고, 필요하면 lint/typecheck/test를 직접 재실행하며, 보안/권한 관련 변경은 실제로 동작을 재현해서 확인한다(예: 임시 로컬 DB로 서버를 띄워 실제 API 호출로 검증).
- GitHub PR 관련 작업(코멘트 작성, merge)은 Claude가 직접 `gh pr` 명령을 실행하지 않고 Codex에게 지시한다. 코드 수정/분석은 여전히 Claude의 역할이다.
- 위험하거나 되돌리기 어려운 git 명령(force-push, reset --hard, 브랜치 삭제 등)은 사용자가 그 메시지에서 명시적으로 지시하지 않는 한 실행하지 않는다.
- 프로세스를 종료할 때는 넓은 패턴 매칭(`pkill -f "node server.js"` 등)을 쓰지 않는다. 이 프로젝트는 여러 체크아웃/워크트리에서 동시에 여러 서버가 떠 있으므로, 항상 특정 PID만 골라서 종료한다.
- 포트 배정은 고정 인프라로 취급한다(OAuth redirect URI 등록 등과 연결되어 있음) — 사용자가 명시적으로 포트 변경을 지시하지 않는 한 바꾸지 않는다.
- 답변은 기본적으로 한국어로 한다. 코드/커밋 메시지/코드 주석은 영어를 유지한다.
- "자동으로 진행해" 모드에서는 단계 사이에 순수 상태 보고만 하고 멈추지 않는다 — 완료되거나 진짜 막히는 지점까지 이어서 진행한다.

## Codex 규칙

- 모델: `~/.codex/config.toml`의 기본값은 `gpt-5.6-sol`(reasoning effort medium)이지만, 이 프로젝트에서는 실제로 `-m "gpt-5.5"`를 명시해서 쓴다 — "5.6 Luna"/"5.6 Sol"을 이름으로 직접 지정하면 이 ChatGPT 계정에서 API 400 에러로 거부된 전례가 있어서, 검증된 `gpt-5.5`를 계속 쓴다.
- Sandbox: 호출자가 `-s workspace-write`를 명시하면 그 sandbox를 따르지만, 명시하지 않으면 공유 CODEX_HOME의 기본값(`approval_policy = "never"`, `sandbox_mode = "danger-full-access"`, `network_access = "enabled"`)을 그대로 따른다. git worktree의 `.git` 메타데이터가 `-s workspace-write`의 쓰기 범위 밖에 있어서 커밋이 막히는 경우가 있었는데, 이때는 `-s` 플래그를 생략하고 공유 설정을 쓰면 해결된다.
- `approval_policy = "never"`이므로 Codex는 권한 상승을 요청할 수 없다 — 막히면 승인을 기다리지 말고 현재 권한 안에서 가능한 경로를 찾거나, 안 되면 막힌 이유를 그대로 보고한다.
- `codex exec resume --last`는 신뢰하지 않는다. CODEX_HOME이 별도의 독립적인 멀티에이전트 프레임워크(LazyCodex/omo)와 공유되고 있어서, 그 프레임워크가 중간에 다른 작업을 하면 `--last`가 엉뚱한 세션을 이어받을 수 있다. 대신 매번 필요한 맥락을 전부 포함한 새 `codex exec -C <repo-root>` 호출을 쓴다.
- 자체 검증은 lint/typecheck/build/test로 끝내지 않는다. 백엔드/API 작업이면 가능한 한 서버를 직접 띄워서 curl 등으로 정상 경로와 권한/실패 케이스까지 재현해서 확인한다.
- 새 API 라우트에 권한을 걸 때는 실제 동작(조회 vs 변경)에 맞는 권한을 골라야 한다 — 읽기 전용 권한을 변경 라우트에 재사용하지 않는다.
- 위험한 git 명령(force-push, reset --hard 등)은 Codex에게도 지시하지 않는다.
- CODEX_HOME이 기존 LazyCodex/omo 프레임워크(전체 디스크/네트워크 접근, 브라우저 제어, hooks, memories, multi-agent 포함)와 공유되는 것은 의도된 설정이다 — 격리 실패가 아니라 사용자가 직접 결정한 작업 환경이므로 그대로 둔다.
- `.omo/teams/...` 같은 팀 운영/증거 artifact는 사용자가 명시적으로 커밋하라고 하지 않는 한 로컬 전용으로 남겨둔다.
