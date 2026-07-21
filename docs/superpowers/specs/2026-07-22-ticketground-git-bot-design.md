# Ticketground GitHub Bot Design

## Goal

Ticketground의 이슈와 Pull Request를 일관된 기준으로 분류하고, 검증 누락을 줄이는 저장소 전용 자동화 봇을 구성한다.

## Chosen approach

첫 버전은 GitHub Actions의 기본 `GITHUB_TOKEN`을 사용하는 `github-actions[bot]`으로 운영한다. 별도 봇 계정, 비밀번호, 개인 액세스 토큰은 저장하지 않는다. 토큰 권한은 각 작업에 필요한 `contents: read`, `issues: write`, `pull-requests: write`로 제한한다.

GitHub App은 여러 저장소와 프로젝트 보드를 함께 운영하거나 카카오톡 같은 외부 알림 채널을 붙이는 단계에서 도입한다.

## Behavior

### Issues

- 새 이슈와 다시 열린 이슈에 `status: triage`를 붙인다.
- 제목과 본문을 기준으로 `bug`, `enhancement`, `documentation` 및 `area:*` 라벨을 붙인다.
- 같은 접수 댓글을 중복 작성하지 않고 기존 봇 댓글을 갱신한다.

### Pull requests

- 변경 파일을 기준으로 `area: frontend`, `area: backend`, `area: docs`, `area: automation`, `area: auth`를 분류한다.
- 검증 전에는 `status: qa-needed`를 붙인다.
- PR 댓글에 변경 영역, 연결 이슈, CI와 `localhost:5501` 수동 QA 체크리스트를 표시한다.
- 간편로그인 보호 파일이 변경되면 댓글에 명시적인 경고를 남긴다. 봇은 해당 파일을 수정하거나 자동 병합하지 않는다.
- 병합 완료 시 `status: merged`, 병합 없이 닫히면 `status: closed`로 상태를 갱신한다.

### CI

- 기본 브랜치인 `main`의 push와 PR에서 실행한다.
- lint, typecheck, build, 전체 Node 테스트를 순서대로 수행한다.
- 같은 브랜치의 이전 실행은 취소해 불필요한 중복 실행을 줄인다.

## Security boundaries

- `pull_request_target`에서는 PR 브랜치 코드를 실행하지 않는다.
- 봇 스크립트는 항상 기본 브랜치에서 checkout한다.
- 외부 저장소의 PR 내용은 API 메타데이터와 변경 파일 목록으로만 읽는다.
- 자동 승인, 자동 병합, 관리자 권한 변경은 하지 않는다.

## Verification

- 분류 로직을 Node 단위 테스트로 검증한다.
- workflow YAML의 트리거와 최소 권한을 정적 테스트로 검증한다.
- PR에서 CI를 통과시킨 뒤 main에 병합한다.
- 병합 후 테스트 이슈를 생성해 라벨과 봇 댓글을 실제 GitHub 화면/API에서 확인하고 테스트 이슈를 닫는다.
